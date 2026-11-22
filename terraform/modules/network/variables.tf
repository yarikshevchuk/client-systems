variable "name" {
  description = "Name prefix"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "public_cidr" {
  description = "Public subnet CIDR"
  type        = string
}

variable "private_cidr" {
  description = "Private subnet CIDR"
  type        = string
}
