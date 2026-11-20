# Installing in your GCP project

## Prerequisites

- A GCP project you own, with billing enabled.
- An identity with `roles/owner`, or `roles/editor` + `roles/resourcemanager.projectIamAdmin`, on that project.
- Terraform ≥ 1.9, `gcloud`, `kubectl`, Helm ≥ 3.8 (Helm 4 is also supported), [cosign](https://docs.sigstore.dev) and [ORAS](https://oras.land) ≥ 1.2.
- A supported release version (see [support policy](../release/support-policy.md)).

## 1. Verify and unpack the release

Verify and pull the Terraform bundle as described in [verifying-releases.md](../release/verifying-releases.md#terraform-bundle), then:

```sh
oras pull ghcr.io/<org>/terraform/aip:<version>
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

## 4. Install the application

Create the namespace and the connection Secret. The chart never takes credentials as plain values.

```sh
kubectl create namespace aip
kubectl -n aip create secret generic aip-connections \
  --from-literal=DATABASE_URL='postgres://USER:PASSWORD@HOST:5432/aip' \
  --from-literal=REDIS_URL='redis://HOST:6379'
```

Create `aip-values.yaml`:

```yaml
global:
  cloud: gcp
connections:
  existingSecret: aip-connections
serviceAccount:
  annotations:
    iam.gke.io/gcp-service-account: aip@your-project.iam.gserviceaccount.com
# Optional: expose the API
# ingress:
#   enabled: true
#   className: gce
#   host: aip.your-domain.example
#   tls: { secretName: aip-tls }
```

Install, then verify:

```sh
helm install aip oci://ghcr.io/<org>/charts/aip --version <version> \
  --namespace aip -f aip-values.yaml --wait
helm -n aip test aip
```

The chart validates your values against its schema. A typo in a key fails the install with the offending path named, instead of being silently ignored.

**GitOps (Argo CD, Flux) or `helm template`:** set `telemetry.installId` to a UUID you generate once (`uuidgen | tr A-Z a-z`). Otherwise a new ID is generated on every render.

## 5. Upgrade

```sh
helm upgrade aip oci://ghcr.io/<org>/charts/aip --version <new-version> \
  --namespace aip -f aip-values.yaml --wait
```

Read the release's **Upgrade notes** first. Check the target version is a supported upgrade path in the [support policy](../release/support-policy.md).

## What the infrastructure creates

A VPC with private subnets and Cloud NAT. A regional private GKE cluster with Workload Identity, shielded nodes, Binary Authorization, and managed upgrades in a Tue–Thu 03:00–07:00 UTC window. A dedicated least-privilege node service account. All resources carry the label `aip-managed=true`, for cost attribution.

## What the chart runs

`api` and `worker` Deployments run as non-root, with read-only filesystems, all capabilities dropped, and RuntimeDefault seccomp. Each has CPU/memory requests and memory limits, startup/liveness/readiness probes, zone spreading, a PodDisruptionBudget, and a NetworkPolicy. The `api` also has a HorizontalPodAutoscaler. All settings are in the chart's `values.yaml`.
