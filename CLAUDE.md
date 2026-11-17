# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo rules

- **No AI attribution anywhere.** No `Co-Authored-By` trailers, "generated with" lines, or AI mentions in commits, PR descriptions, code comments, or docs.
- Target stack: GCP, Terraform, GitHub Actions, Postgres/Redis/Kafka/OpenSearch/ClickHouse, Datadog/Sentry/Metabase, TypeScript (Node) + Python. The existing AWS estate is CDK and is being migrated to Terraform. No new CDK stacks (see `infra/cdk/README.md`).
- Anything under `infra/terraform/byoc/`, `docs/release/`, `docs/self-hosted/`, the Helm chart's values, and the call-home payload is **customer-facing public API**. Breaking changes need a major version (`docs/release/support-policy.md`).
- Remote: `github.com/leeclarkuk/agentic-integration` (private), default branch `main`. Every push to `main` runs CI. Debug with `gh run list` and `gh run view <id> --log-failed`.
- Branch protection and rulesets are **unavailable**: the repo is private on a free personal account (API returns 403 "Upgrade to GitHub Pro"). Nothing enforces PRs or checks on `main`, so don't push to it directly unless asked. Use a PR so CI runs first.
- Branches pushed by a workflow's `GITHUB_TOKEN` (e.g. `chore/uv-lock`) don't trigger CI. Open the PR with `gh pr create` from the user's account to get checks.
- Pushing to a PR branch cancels its in-progress CI run (`concurrency: cancel-in-progress` off `main`). Batch fixes before pushing.

## Commands

```sh
pnpm install && uv sync --all-packages  # uv.lock must be committed; CI runs `uv sync --locked --all-packages`
gh workflow run uv-lock.yml             # no local uv? regenerates uv.lock in CI, pushes branch chore/uv-lock
pnpm affected                           # typecheck/test/build only what changed vs main
pnpm affected:list                      # which Nx projects are affected
pnpm test | pnpm build | pnpm typecheck # everything
pnpm lint                               # biome: TS, JSON, YAML and Markdown; CI runs `biome ci .`
pnpm lint:fix                           # also reformats docs/tables; run after editing Markdown
                                        # Python lint is the `worker:lint` Nx target (ruff)
npx nx run <project>:<target>           # e.g. npx nx run @aip/api:test, npx nx run worker:test
npx nx show projects                    # project names (TS projects use package name, e.g. @aip/api)

# single test file / test name (TS, from the package dir):
cd apps/api && npx vitest run test/server.test.ts -t "reports unready"
# Python:
uv run --all-packages pytest apps/worker/tests/test_health.py -k healthz

# e2e: start the stack, then run suites (E2E_PROJECTS=all|comma-separated Nx projects)
docker compose -f deploy/compose/docker-compose.yml up -d --build --wait
E2E_PROJECTS=@aip/api pnpm --filter @aip/e2e e2e

# Terraform (from infra/terraform/<module dir>): offline tests use mocked providers
terraform init -backend=false && terraform validate && terraform test

# Helm chart (needs helm + kubeconform)
npx nx run @aip/helm-chart:lint          # helm lint --strict + kubeconform for defaults and ci/*.yaml
npx nx run @aip/helm-chart:test          # schema tests; render tests run when helm is on PATH

# golden-path scaffold
pnpm platform new service <name> --lang ts|py
```

Set `NX_DAEMON=false` if Nx behaves oddly in sandboxed shells.

## Toolchain gotchas

The pinned versions are recent majors (TypeScript 7, Nx 24, Vitest 5, Biome 2.6, pnpm 12). Some config differs from older docs and examples:

- pnpm 12 allowlists install scripts with an `allowBuilds:` map in `pnpm-workspace.yaml`, managed by `pnpm approve-builds <pkg>`. `onlyBuiltDependencies` is ignored.
- Biome 2.6 uses `linter.rules.preset`, not `recommended: true`. It parses YAML, so Go-templated files (`deploy/helm/aip/templates/`, `templates/`) are excluded in `biome.json`. Add any new templated directory there too.
- `tsconfig.base.json` enables `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Use precise object types rather than `Record<string, T>` when keys are known, and spread optional props conditionally (`...(x ? { x } : {})`).
- Biome reads `.gitignore` only because `vcs.useIgnoreFile` is on in `biome.json`. Without it, `biome ci` lints `.venv/` (created by `uv sync` in CI) and fails on package JSON there.
- GitHub Actions: check that a tag exists before referencing it (`gh api repos/<owner>/<repo>/git/ref/tags/<tag>`). Some actions publish no floating major tag (e.g. TruffleHog). Pin those to a release commit SHA with a `# vX.Y.Z` comment.

## Architecture

**Build graph (Nx + pnpm + uv).** Nx is used package-based, without Nx plugins. TS project targets are the `scripts` in each `package.json`. Python projects declare targets in `project.json` as `uv run --all-packages …` commands. The root `pyproject.toml` is a virtual workspace root (`package = false`), so plain `uv sync`/`uv run` install no workspace members. Always pass `--all-packages`, or imports like `worker` fail. Cross-project edges come from `workspace:*` deps (inferred) or `implicitDependencies` (Python, e2e). Edges Nx can't infer must be declared, or affected-only CI will skip tests it should run. `templates/` is excluded from the graph via `.nxignore`. Rationale: `docs/adr/0001-monorepo-tooling.md`.

**Incremental e2e.** `e2e` is an Nx project that implicitly depends on every service. CI (`.github/workflows/ci.yml`) passes the affected project list as `E2E_PROJECTS`. `e2e/select-suites.ts` maps it to `e2e/suites/<project-without-@aip/>/`, plus `_shared/`. `main` runs all suites. `.github/workflows/ci.yml` is in `sharedGlobals` (`nx.json`), so a change to it marks every project affected and runs the full CI, including e2e and the kind Helm install. `e2e/vitest.e2e.config.ts` is the e2e config. Plain `vitest run` in `e2e/` runs only the harness's own unit tests.

**Service conventions** (all services, enforced by templates):

- Config only from env vars, validated at startup. Crash with the variable name on bad config.
- `/healthz` = liveness (never checks dependencies), `/readyz` = readiness (returns 503 naming the failing dependency), `/version`.
- JSON logs to stdout using Datadog reserved attributes (`status`, `service`, `version`). The TS logger is `@aip/telemetry`. Python mirrors it in `worker/main.py`.
- Graceful SIGTERM shutdown. Containers run non-root (uid 65532). Dockerfiles build from repo root (`docker build -f apps/<svc>/Dockerfile .`).

**Call-home** (`packages/telemetry/src/call-home.ts`). Only enabled for `AIP_EDITION=self-hosted` with an `AIP_INSTALL_ID`. Disabled by `AIP_TELEMETRY_DISABLED=1`. The payload is an allowlisted schema, documented to customers in `docs/release/call-home.md`. Tests assert the exact key set. Adding a field means updating the doc and bumping `CALL_HOME_SCHEMA_VERSION`. It must never throw or block serving.

**Golden path.** `tools/platform-cli` copies `templates/service-{ts,py}`, replacing `__name__` (kebab) and `__module__` (snake) in paths and contents. It also creates an e2e suite, and registers Python services as uv workspace members. When changing a service convention, update `apps/*`, `templates/*`, and `tools/platform-cli/test` together.

**Terraform.** `modules/gcp/*` are internal building blocks other teams consume. `byoc/<cloud>` are the roots customers apply. Keep them small and stable. Secure defaults are asserted in `tests/*.tftest.hcl`: private nodes, Workload Identity, Binary Authorization on, a dedicated node SA, deletion protection. Weakening one should fail a test. Provider is `hashicorp/google >= 6.0, < 9.0`, the same range in every module. The BYOC root is customer-facing, so raising the lower bound forces customers to upgrade and needs a major version. Test the whole range before widening it. Only GCP BYOC exists so far. AWS/Azure roots are planned.

**Helm chart** (`deploy/helm/aip`, Nx project `@aip/helm-chart`). One generic template set loops over `.Values.components` (api, worker). Add a component by adding a `components.<name>` block and a matching `values.schema.json` entry, not new templates. `values.yaml` + `values.schema.json` are customer-facing API. The schema is strict (`additionalProperties: false`), so a new key must be added to both. The install ID is rendered only in the `aip-install` Secret (kept on uninstall, reused on upgrade via `lookup`); workloads read it through `secretKeyRef`. Tests: `deploy/helm/test/schema.test.ts` (always runs) and `render.test.ts` (needs `helm` on PATH or `HELM_BIN`; skipped locally without it, hard failure in CI). `ci/*.yaml` are extra values files that lint, kubeconform and render tests all run. They are partial overrides: the schema tests merge them over `values.yaml` the way Helm does (maps merge, arrays replace, `null` deletes a key). To test a missing key, set it to `null`, not `{}`. CI's `helm-install` job does a real install/upgrade/`helm test` on kind with Helm 3 and 4.

**Releases** (`.github/workflows/release.yml`, on tag `vX.Y.Z`, or `vX.Y.Z-rc.N` for a release candidate that publishes the same way but is marked pre-release): multi-arch images to GHCR, cosign keyless-signed by digest, with SBOM + SLSA provenance attached by buildx. The extra GitHub attestation (`gh attestation verify`) is skipped while the repo is private, because GitHub rejects it for private user-owned repos and fails the release. Plus the Helm chart pushed to `oci://ghcr.io/<owner>/charts/aip` and cosign-signed, and a Terraform bundle with signed `SHA256SUMS`. Chart version and appVersion are stamped from the tag at package time. Every artifact drops the tag's leading `v` (`v1.2.3` → `1.2.3`): the chart's default image tag is its appVersion, so image tags must match it exactly. `Chart.yaml` stays at `0.0.0` in git. The release also rewrites the default `global.imageRegistry` (`ghcr.io/leeclarkuk` in git) to the repo owner. Keep the `imageRegistry: ghcr.io/<name>` line shape the `sed` expects. The customer verification steps in `docs/release/verifying-releases.md` depend on the workflow path and tag pattern. Keep them in sync. Releases sign with cosign v2 (pinned in `release.yml`); moving to cosign v3 changes the signature format customers verify, so it needs a doc update and a release note.

## Security defaults

- pnpm blocks dependency install scripts. Only packages in `pnpm-workspace.yaml` `allowBuilds` may run them. Don't add to it casually.
- Workflows default to `permissions: contents: read`. Grant more per job only.
- LLM-generated changes follow `docs/llm-assisted-changes.md`. For IaC, read the `terraform plan`, not just the code.
