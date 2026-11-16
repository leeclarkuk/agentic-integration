# Runs offline with `terraform test` — mocked provider, no GCP credentials needed.
mock_provider "google" {}

variables {
  project_id        = "test-project"
  name              = "test"
  region            = "us-central1"
  network_self_link = "projects/test-project/global/networks/test"
  subnet_self_link  = "projects/test-project/regions/us-central1/subnetworks/test-nodes"
}

run "secure_defaults" {
  command = plan

  assert {
    condition     = google_container_cluster.this.private_cluster_config[0].enable_private_nodes
    error_message = "Nodes must be private."
  }

  assert {
    condition     = google_container_cluster.this.workload_identity_config[0].workload_pool == "test-project.svc.id.goog"
    error_message = "Workload Identity must be enabled."
  }

  assert {
    condition     = google_container_cluster.this.binary_authorization[0].evaluation_mode == "PROJECT_SINGLETON_POLICY_ENFORCE"
    error_message = "Binary Authorization must be enforced by default."
  }

  assert {
    condition     = google_container_cluster.this.deletion_protection
    error_message = "Deletion protection must default on."
  }

  assert {
    condition     = google_container_node_pool.pools["general"].node_config[0].workload_metadata_config[0].mode == "GKE_METADATA"
    error_message = "Node metadata must be GKE_METADATA (blocks pod access to node credentials)."
  }
}

run "rejects_long_names" {
  command = plan

  variables {
    name = "this-name-is-far-too-long-for-a-service-account"
  }

  expect_failures = [var.name]
}
