# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo rules

- **No AI attribution anywhere.** No `Co-Authored-By` trailers, "generated with" lines, or AI mentions in commits, PR descriptions, code comments, or docs.
- Target stack: GCP, Terraform, GitHub Actions, Postgres/Redis/Kafka/OpenSearch/ClickHouse, Datadog/Sentry/Metabase, TypeScript (Node) + Python. The existing AWS estate is CDK and is being migrated to Terraform. No new CDK stacks (see `infra/cdk/README.md`).
- Anything under `infra/terraform/byoc/`, `docs/release/`, `docs/self-hosted/`, and the call-home payload is **customer-facing public API**. Breaking changes need a major version (`docs/release/support-policy.md`).

## Commands

```sh
pnpm install && uv sync                 # uv.lock must be committed; CI runs `uv sync --locked`
pnpm affected                           # typecheck/test/build only what changed vs main
pnpm affected:list                      # which Nx projects are affected
pnpm test | pnpm build | pnpm typecheck # everything
pnpm lint                               # biome (TS/JSON); Python lint is the `worker:lint` Nx target
npx nx run <project>:<target>           # e.g. npx nx run @aip/api:test, npx nx run worker:test
npx nx show projects                    # project names (TS projects use package name, e.g. @aip/api)

# single test file / test name (TS, from the package dir):
cd apps/api && npx vitest run test/server.test.ts -t "reports unready"
# Python:
uv run pytest apps/worker/tests/test_health.py -k healthz

# e2e: start the stack, then run suites (E2E_PROJECTS=all|comma-separated Nx projects)
docker compose -f deploy/compose/docker-compose.yml up -d --build --wait
E2E_PROJECTS=@aip/api pnpm --filter @aip/e2e e2e

# Terraform (from infra/terraform/<module dir>): offline tests use mocked providers
terraform init -backend=false && terraform validate && terraform test

# golden-path scaffold
pnpm platform new service <name> --lang ts|py
```

Set `NX_DAEMON=false` if Nx behaves oddly in sandboxed shells.

## Architecture

**Build graph (Nx + pnpm + uv).** Nx is used package-based, without Nx plugins. TS project targets are the `scripts` in each `package.json`. Python projects declare targets in `project.json` as `uv run …` commands. Cross-project edges come from `workspace:*` deps (inferred) or `implicitDependencies` (Python, e2e). Edges Nx can't infer must be declared, or affected-only CI will skip tests it should run. `templates/` is excluded from the graph via `.nxignore`. Rationale: `docs/adr/0001-monorepo-tooling.md`.

**Incremental e2e.** `e2e` is an Nx project that implicitly depends on every service. CI (`.github/workflows/ci.yml`) passes the affected project list as `E2E_PROJECTS`. `e2e/select-suites.ts` maps it to `e2e/suites/<project-without-@aip/>/`, plus `_shared/`. `main` runs all suites. `e2e/vitest.e2e.config.ts` is the e2e config. Plain `vitest run` in `e2e/` runs only the harness's own unit tests.

**Service conventions** (all services, enforced by templates):

- Config only from env vars, validated at startup. Crash with the variable name on bad config.
- `/healthz` = liveness (never checks dependencies), `/readyz` = readiness (returns 503 naming the failing dependency), `/version`.
- JSON logs to stdout using Datadog reserved attributes (`status`, `service`, `version`). The TS logger is `@aip/telemetry`. Python mirrors it in `worker/main.py`.
- Graceful SIGTERM shutdown. Containers run non-root (uid 65532). Dockerfiles build from repo root (`docker build -f apps/<svc>/Dockerfile .`).

**Call-home** (`packages/telemetry/src/call-home.ts`). Only enabled for `AIP_EDITION=self-hosted` with an `AIP_INSTALL_ID`. Disabled by `AIP_TELEMETRY_DISABLED=1`. The payload is an allowlisted schema, documented to customers in `docs/release/call-home.md`. Tests assert the exact key set. Adding a field means updating the doc and bumping `CALL_HOME_SCHEMA_VERSION`. It must never throw or block serving.

**Golden path.** `tools/platform-cli` copies `templates/service-{ts,py}`, replacing `__name__` (kebab) and `__module__` (snake) in paths and contents. It also creates an e2e suite, and registers Python services as uv workspace members. When changing a service convention, update `apps/*`, `templates/*`, and `tools/platform-cli/test` together.

**Terraform.** `modules/gcp/*` are internal building blocks other teams consume. `byoc/<cloud>` are the roots customers apply. Keep them small and stable. Secure defaults are asserted in `tests/*.tftest.hcl`: private nodes, Workload Identity, Binary Authorization on, a dedicated node SA, deletion protection. Weakening one should fail a test. Provider is `hashicorp/google ~> 6.0`. Only GCP BYOC exists so far. AWS/Azure roots are planned.

**Releases** (`.github/workflows/release.yml`, on tag `vX.Y.Z`): multi-arch images to GHCR, cosign keyless-signed by digest, with SBOM + SLSA provenance. Plus a Terraform bundle with signed `SHA256SUMS`. The customer verification steps in `docs/release/verifying-releases.md` depend on the workflow path and tag pattern. Keep them in sync.

## Security defaults

- pnpm blocks dependency install scripts. Only packages in `pnpm-workspace.yaml` `allowBuilds` may run them. Don't add to it casually.
- Workflows default to `permissions: contents: read`. Grant more per job only.
- LLM-generated changes follow `docs/llm-assisted-changes.md`. For IaC, read the `terraform plan`, not just the code.
