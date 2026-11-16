/**
 * BYOC (self-hosted) root module for a customer's GCP project.
 * This is the module customers apply. Keep its interface small and stable:
 * every variable here is a public API covered by the supported-version policy
 * (docs/release/support-policy.md). Breaking changes require a major version.
 */
locals {
  labels = merge(var.labels, {
    "aip-managed" = "true"
    "aip-release" = replace(var.release_version, ".", "-")
  })

  required_apis = [
    "compute.googleapis.com",
    "container.googleapis.com",
    "artifactregistry.googleapis.com",
    "binaryauthorization.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
  ]
}

resource "google_project_service" "apis" {
  for_each           = toset(local.required_apis)
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

module "network" {
  source = "../../modules/gcp/network"

  project_id        = var.project_id
  name              = var.name
  region            = var.region
  nat_ip_self_links = var.nat_ip_self_links

  depends_on = [google_project_service.apis]
}

module "gke" {
  source = "../../modules/gcp/gke"

  project_id                 = var.project_id
  name                       = var.name
  region                     = var.region
  network_self_link          = module.network.network_self_link
  subnet_self_link           = module.network.subnet_self_link
  pods_range_name            = module.network.pods_range_name
  services_range_name        = module.network.services_range_name
  master_authorized_networks = var.master_authorized_networks
  private_endpoint           = var.private_endpoint
  binary_authorization       = var.binary_authorization
  node_pools                 = var.node_pools
  labels                     = local.labels
}
