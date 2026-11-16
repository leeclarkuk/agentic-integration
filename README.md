# agentic-integration

Monorepo for the AI integration platform: services, shared libraries, infrastructure, and the tooling that builds, tests, ships and runs them, in our GCP estate and in customers' own clouds.

## Layout

| Path                 | What                                                                    |
| -------------------- | ----------------------------------------------------------------------- |
| `apps/`              | Deployable services (`api`: TypeScript/Fastify; `worker`: Python)       |
| `packages/`          | Shared TS libraries (`telemetry`: structured logging + call-home)       |
| `tools/platform-cli` | Paved-road CLI (`pnpm platform new service …`)                          |
| `templates/`         | Golden-path service templates used by the CLI                           |
| `e2e/`               | End-to-end harness. Suites per project, run incrementally               |
| `infra/terraform/`   | Terraform modules (`modules/`) and customer-facing BYOC roots (`byoc/`) |
| `infra/cdk/`         | AWS CDK estate under migration to Terraform                             |
| `deploy/compose/`    | Local / CI stack                                                        |
| `deploy/helm/aip`    | Helm chart for self-hosted installs                                     |
| `docs/`              | ADRs, release policy, runbooks, self-hosted guides                      |

## Getting started

Requires Node 24 (`.nvmrc`), pnpm, and [uv](https://docs.astral.sh/uv/).

```sh
pnpm install
uv sync --all-packages
pnpm affected          # typecheck/test/build what your branch changed
pnpm test              # everything
pnpm platform new service my-service --lang ts
```

Start here: [ADR 0001: monorepo tooling](docs/adr/0001-monorepo-tooling.md), [release & support policy](docs/release/support-policy.md), [runbooks](docs/runbooks/).
