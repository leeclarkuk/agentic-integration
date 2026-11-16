output "cluster_name" {
  value = module.gke.cluster_name
}

output "workload_pool" {
  value = module.gke.workload_pool
}

output "get_credentials_command" {
  description = "Run this to point kubectl at the new cluster before installing the Helm chart."
  value       = "gcloud container clusters get-credentials ${module.gke.cluster_name} --region ${var.region} --project ${var.project_id}"
}
