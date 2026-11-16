output "cluster_name" {
  value = google_container_cluster.this.name
}

output "cluster_id" {
  value = google_container_cluster.this.id
}

output "endpoint" {
  value     = google_container_cluster.this.endpoint
  sensitive = true
}

output "ca_certificate" {
  value     = one(google_container_cluster.this.master_auth[*].cluster_ca_certificate)
  sensitive = true
}

output "workload_pool" {
  value = "${var.project_id}.svc.id.goog"
}

output "node_service_account" {
  value = google_service_account.nodes.email
}
