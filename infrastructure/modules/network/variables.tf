variable "resource_group_name" {
  description = "Name of resource"
  type        = string
}

variable "location" {
  description = "Location of the resource"
  type        = string
}

variable "name_prefix" {
  description = "Name prefix for all resources"
  type        = string
}

variable "environment" {
  description = "Environment name, e.g. dev, prod"
  type        = string
}

variable "region" {
  description = "Short region code, e.g. 'sea' for southeastasia"
  type        = string
}

variable "vnet_name" {
  description = "Name of the virtual network"
  type        = string
}

variable "vnet_address_space" {
  description = "Address space for the virtual network"
  type        = list(string)
  default     = ["10.0.0.0/24"]
}

variable "apim_subnet_prefix" {
  description = "Subnet prefix for APIM subnet (64 IPs: 10.0.0.0 -> 10.0.0.63)"
  type        = list(string)
  default     = ["10.0.0.0/26"]
}

variable "app_subnet_prefix" {
  description = "Subnet prefix for container app subnet (64 IPs: 10.0.0.64 -> 10.0.0.127)"
  type        = list(string)
  default     = ["10.0.0.64/26"]
}

variable "db_subnet_prefix" {
  description = "Dải IP cho PostgreSQL (64 IPs: 10.0.0.128 -> 10.0.0.191)"
  type        = list(string)
  default     = ["10.0.0.128/26"]
}
