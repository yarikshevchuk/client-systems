variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "europe-central2"
}

variable "zone" {
  description = "GCP zone"
  type        = string
  default     = "europe-central2-a"
}

variable "name" {
  description = "Name prefix for all resources"
  type        = string
  default     = "vns"
}

variable "public_cidr" {
  description = "Public subnet CIDR"
  type        = string
  default     = "10.0.1.0/24"
}

variable "private_cidr" {
  description = "Private subnet CIDR"
  type        = string
  default     = "10.0.2.0/24"
}

variable "machine_type" {
  description = "App instance type"
  type        = string
  default     = "e2-medium"
}

variable "lb_machine_type" {
  description = "Load balancer instance type"
  type        = string
  default     = "e2-small"
}

variable "image" {
  description = "Boot image"
  type        = string
  default     = "debian-cloud/debian-12"
}

variable "root_disk_size" {
  description = "Root disk size, GB (image minimum 10 + 2)"
  type        = number
  default     = 12
}

variable "data_disk_size" {
  description = "Data disk size, GB"
  type        = number
  default     = 25
}

variable "repo_url" {
  description = "Application git repository"
  type        = string
  default     = "https://github.com/yarikshevchuk/client-systems.git"
}

variable "db_password" {
  description = "Postgres password"
  type        = string
  sensitive   = true
}

variable "app_secret" {
  description = "Backend JWT secret"
  type        = string
  sensitive   = true
}

variable "anthropic_api_key" {
  description = "Anthropic API key (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "gemini_api_key" {
  description = "Gemini API key (optional)"
  type        = string
  default     = ""
  sensitive   = true
}
