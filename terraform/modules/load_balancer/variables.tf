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

variable "subnet_id" {
  description = "Public subnet ID"
  type        = string
}

variable "app_ip" {
  description = "Private IP of the app server"
  type        = string
}
