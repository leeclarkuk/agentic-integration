variable "project_id" {
  description = "Customer GCP project that will host the platform."
  type        = string
}

variable "region" {
  description = "Customer's chosen region, e.g. europe-west2."
  type        = string
}

variable "name" {
  description = "Installation name; prefixes all resources."
  type        = string
  default     = "aip"
}

variable "release_version" {
  description = "Platform release (semver) this infrastructure is deployed for. Must be a supported version."
  type        = string

  validation {
    condition     = can(regex("^\\d+\\.\\d+\\.\\d+$", var.release_version))
    error_message = "release_version must be MAJOR.MINOR.PATCH, e.g. 1.4.2."
  }
}

variable "master_authorized_networks" {
  description = "Customer CIDRs allowed to reach the Kubernetes API."
  type = list(object({
    cidr_block   = string
    display_name = string
  }))
  default = []
}

variable "private_endpoint" {
  type    = bool
  default = false
}

variable "binary_authorization" {
  description = "Only admit images signed by our release key. Leave on unless the customer mirrors and re-signs images."
  type        = bool
  default     = true
}

variable "nat_ip_self_links" {
  description = "Static egress IPs, for customers who need to allowlist outbound traffic."
  type        = list(string)
  default     = []
}

variable "node_pools" {
  type = map(object({
    machine_type = string
    min_nodes    = number
    max_nodes    = number
    disk_size_gb = optional(number, 100)
    spot         = optional(bool, false)
    taints = optional(list(object({
      key    = string
      value  = string
      effect = string
    })), [])
  }))
  default = {
    general = {
      machine_type = "e2-standard-4"
      min_nodes    = 3
      max_nodes    = 9
    }
  }
}

variable "labels" {
  description = "Extra labels for customer cost attribution."
  type        = map(string)
  default     = {}
}
