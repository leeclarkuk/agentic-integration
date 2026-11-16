variable "project_id" {
  description = "GCP project to create the network in."
  type        = string
}

variable "name" {
  description = "Network name; also used as a prefix for subnet, router and NAT."
  type        = string

  validation {
    condition     = can(regex("^[a-z]([-a-z0-9]{0,40}[a-z0-9])?$", var.name))
    error_message = "name must be lowercase RFC1035, max 42 chars (suffixes are appended)."
  }
}

variable "region" {
  description = "Region for the subnet, router and NAT."
  type        = string
}

variable "nodes_cidr" {
  description = "Primary range for GKE nodes."
  type        = string
  default     = "10.10.0.0/20"
}

variable "pods_cidr" {
  description = "Secondary range for pods. Size for max pods: /14 = ~260k pod IPs."
  type        = string
  default     = "10.16.0.0/14"
}

variable "services_cidr" {
  description = "Secondary range for ClusterIP services."
  type        = string
  default     = "10.20.0.0/20"
}

variable "flow_log_sampling" {
  description = "VPC flow log sampling (0-1). Lower in high-traffic envs to control logging cost."
  type        = number
  default     = 0.5
}

variable "nat_ip_self_links" {
  description = "Static NAT IPs. Set for BYOC customers who allowlist our egress IPs; empty = auto-allocate."
  type        = list(string)
  default     = []
}
