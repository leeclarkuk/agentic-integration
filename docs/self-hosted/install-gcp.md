# Installing in your GCP project

> Status: infrastructure layer only. The Helm chart that installs the application onto this cluster is not published yet. This guide covers provisioning the cluster.

## Prerequisites

- A GCP project you own, with billing enabled.
- An identity with `roles/owner`, or `roles/editor` + `roles/resourcemanager.projectIamAdmin`, on that project.
- Terraform ≥ 1.9 and `gcloud`.
- A supported release version (see [support policy](../release/support-policy.md)).

## 1. Verify and unpack the release

Follow [verifying-releases.md](../release/verifying-releases.md), then:

```sh
tar -xzf aip-terraform-v<version>.tar.gz
cd terraform/byoc/gcp
```

## 2. Configure

Create `terraform.tfvars`:

```hcl
project_id      = "your-project"
region          = "europe-west2"
release_version = "<version>"

# Who may reach the Kubernetes API (your office/VPN egress):
master_authorized_networks = [
  { cidr_block = "203.0.113.0/24", display_name = "corp-vpn" },
]
```

Store state in your own bucket. Add a `backend.tf`:

```hcl
terraform {
  backend "gcs" {
    bucket = "your-tf-state-bucket"
    prefix = "aip"
  }
}
```

## 3. Apply

```sh
terraform init
terraform plan -out plan.tfplan
terraform apply plan.tfplan
$(terraform output -raw get_credentials_command)
kubectl get nodes
```

## What this creates

A VPC with private subnets and Cloud NAT. A regional private GKE cluster with Workload Identity, shielded nodes, Binary Authorization, and managed upgrades in a Tue–Thu 03:00–07:00 UTC window. A dedicated least-privilege node service account. All resources carry the label `aip-managed=true`, for cost attribution.
