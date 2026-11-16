# AWS CDK estate → Terraform migration

The existing AWS estate is defined in CDK (outside this repo today). Terraform is the target for all new infrastructure. This directory will hold the CDK apps while they are migrated.

## Rules during migration

1. **No new CDK stacks.** New AWS infrastructure is written as Terraform under `infra/terraform/`.
2. **One owner per resource at a time.** A resource is managed by CDK _or_ Terraform, never both.
3. **Migrate by stack, lowest-risk first:** stateless (IAM, SGs, Lambdas) → networking → stateful (RDS, S3, MSK) last.

## Per-stack procedure

1. Write the Terraform equivalent and `terraform plan`. It should show only creates.
2. Set `RemovalPolicy.RETAIN` on every resource in the CDK stack (`applyRemovalPolicy`), then `cdk deploy`. Deleting the stack now orphans the resources instead of destroying them.
3. Add Terraform `import {}` blocks for each resource. Iterate until `terraform plan` shows **no changes**. That's the proof of parity.
4. `terraform apply` (imports only), then delete the CloudFormation stack. Resources are retained.
5. Remove the CDK code in the same PR as step 4.

`cdk synth` output (`cdk.out/*.template.json`) is a useful source for generating the first Terraform draft. Every generated draft must pass step 3's zero-diff plan before it is trusted.
