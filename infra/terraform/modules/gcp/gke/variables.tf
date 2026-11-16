variable "project_id" {
  type = string
}

variable "name" {
  description = "Cluster name. Also prefixes the node service account (max 30 chars total)."
  type        = string

  validation {
    condition     = can(regex("^[a-z][-a-z0-9]{0,22}[a-z0-9]$", var.name))
    error_message = "name must be lowercase, 2-24 chars, so '<name>-nodes' fits the 30-char SA limit."
  }
}

variable "region" {
  description = "Region for a regional (multi-zone) control plane."
  type        = string
}

variable "network_self_link" {
  type = string
}

variable "subnet_self_link" {
  type = string
}

variable "pods_range_name" {
  type    = string
  default = "pods"
}

variable "services_range_name" {
  type    = string
  default = "services"
}

variable "private_endpoint" {
  description = "Make the control plane reachable only from inside the VPC. Requires a bastion/VPN for kubectl."
  type        = bool
  default     = false
}

variable "master_ipv4_cidr_block" {
  description = "/28 for the control plane peering range. Must not overlap any subnet."
  type        = string
  default     = "172.16.0.0/28"
}

variable "master_authorized_networks" {
  description = "CIDRs allowed to reach the control plane endpoint. Empty = no external access."
  type = list(object({
    cidr_block   = string
    display_name = string
  }))
  default = []
}

variable "release_channel" {
  type    = string
  default = "REGULAR"

  validation {
    condition     = contains(["RAPID", "REGULAR", "STABLE"], var.release_channel)
    error_message = "release_channel must be RAPID, REGULAR or STABLE."
  }
}

variable "maintenance_start_time" {
  description = "RFC3339 start of the recurring maintenance window."
  type        = string
  default     = "2026-01-01T03:00:00Z"
}

variable "maintenance_end_time" {
  type    = string
  default = "2026-01-01T07:00:00Z"
}

variable "maintenance_recurrence" {
  description = "RFC5545 RRULE. Default: Tue-Thu, avoiding weekends and Mondays."
  type        = string
  default     = "FREQ=WEEKLY;BYDAY=TU,WE,TH"
}

variable "binary_authorization" {
  description = "Enforce the project's Binary Authorization policy (require signed images)."
  type        = bool
  default     = true
}

variable "deletion_protection" {
  type    = bool
  default = true
}

variable "labels" {
  description = "Applied to the cluster and nodes. Include team, env and cost-center for cost attribution."
  type        = map(string)
  default     = {}
}

variable "node_pools" {
  description = "Node pools keyed by name."
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
      max_nodes    = 12
    }
  }
}
