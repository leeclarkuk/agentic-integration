# ADR 0001: Monorepo build and test tooling

- Status: Accepted
- Date: 2026-11-16

## Context

One repository holds every service (TypeScript and Python), shared libraries, Terraform, and tooling. CI must stay fast as the repo grows. That means only building and testing what a change can affect, and never redoing work that has already been done for the same inputs.

## Decision

| Concern                                 | Choice                                         | Why                                                                                                                                        |
| --------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Task graph, affected detection, caching | **Nx** (package-based, no Nx plugins required) | Polyglot: non-JS projects join the graph with a `project.json`. Mature `affected` and computation caching, with no bespoke build language. |
| JS package manager                      | **pnpm** workspaces                            | Strict dependency isolation, content-addressed store, fast CI installs. Install scripts blocked unless allowlisted (`allowBuilds`).        |
| Python                                  | **uv** workspace (single `uv.lock`)            | One lockfile for the Python estate, fast resolver, reproducible container builds.                                                          |
| Lint/format (TS)                        | **Biome**                                      | Single binary, much faster than ESLint+Prettier. Runs repo-wide in `biome ci`.                                                             |
| Lint/format (Python)                    | **ruff**, type checks with **mypy --strict**   |                                                                                                                                            |

### Rejected

- **Bazel / Pants**: strongest hermeticity, but a large adoption cost and a second build language every engineer must learn. Revisit if we hit Nx's limits (test sharding at thousands of projects, remote execution).
- **Turborepo**: good for JS-only. Python projects would need `package.json` shims to join the graph.

## How affected-only works

1. `nrwl/nx-set-shas` picks the base SHA. On PRs it is the merge-base. On `main` it is the last successful CI run, so a red build doesn't shrink the next diff.
2. Nx maps changed files to projects. It then walks the dependency graph: inferred from `workspace:*` deps, plus `implicitDependencies` for edges it can't see (Python, e2e).
3. Only affected projects' `lint`, `typecheck`, `test` and `build` run. Results are cached by input hash.
4. e2e is itself a project that implicitly depends on the services. When it is affected, the harness runs only the suites under `e2e/suites/<project>/` for affected projects, plus `_shared/`. `main` runs every suite.

## Consequences

- New Python projects must declare their deps on other projects in `project.json` `implicitDependencies`. Nx cannot infer them.
- The cache is per-runner (GitHub Actions cache) for now. Move to a shared remote cache (Nx Cloud or a self-hosted GCS-backed cache) when cache-miss time across runners becomes measurable. That is a deliberate cost/benefit call, not a default.
