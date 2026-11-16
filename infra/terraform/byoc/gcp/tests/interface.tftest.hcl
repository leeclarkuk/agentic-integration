mock_provider "google" {}

variables {
  project_id      = "customer-project"
  region          = "europe-west2"
  release_version = "1.0.0"
}

run "labels_carry_release" {
  command = plan

  assert {
    condition     = module.gke.cluster_name == "aip"
    error_message = "Default installation name should be 'aip'."
  }
}

run "rejects_non_semver_release" {
  command = plan

  variables {
    release_version = "latest"
  }

  expect_failures = [var.release_version]
}
