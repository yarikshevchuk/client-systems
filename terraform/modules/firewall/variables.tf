variable "name" {
  description = "Name prefix"
  type        = string
}

variable "vpc_name" {
  description = "VPC name"
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
