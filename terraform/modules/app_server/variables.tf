variable "name" {
  description = "Name prefix"
  type        = string
}

variable "zone" {
  description = "GCP zone"
  type        = string
}

variable "machine_type" {
  description = "Instance type"
  type        = string
}

variable "image" {
  description = "Boot image"
  type        = string
}

variable "root_disk_size" {
  description = "Root disk size, GB"
  type        = number
}

variable "data_disk_size" {
  description = "Data disk size, GB"
  type        = number
}

variable "subnet_id" {
  description = "Private subnet ID"
  type        = string
}

variable "repo_url" {
  description = "Application git repository"
  type        = string
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
