# Guardrails for LLM-assisted changes

We use LLMs and agents for IaC drafts, test scaffolding, and runbook first drafts. Generated changes go through the same gates as hand-written ones, plus a few more because generated code fails in particular ways.

## Gates every change passes (enforced in CI)

- `biome ci`, ruff, mypy, typecheck, tests, for affected projects.
- Terraform: `fmt`, `validate`, `terraform test` (mocked providers), `tflint`, Trivy misconfiguration scan at HIGH/CRITICAL.
- Secret scanning on every PR.
- CODEOWNERS review on `infra/`, `.github/`, `deploy/`, `templates/`.

## Extra rules for generated changes

- **IaC:** attach a `terraform plan` to the PR and read it, not just the code. Generated Terraform commonly invents attribute names, quietly widens IAM (`roles/editor`, `*` principals), or opens firewall rules to `0.0.0.0/0`. Trivy catches some of this. Reviewers catch the rest.
- **CDK → Terraform:** a generated translation is accepted only after a zero-diff plan against the imported resources (see `infra/cdk/README.md`).
- **Tests:** a generated test must fail when the code under test is broken. Check by mutating the code once. Tests that assert on mocks of the thing being tested are rejected.
- **Runbooks:** every command must be executed once against staging before the runbook is merged.
- **Never** paste customer data, secrets, or production logs containing customer content into an external model.
