variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Location of infrastrure"
  type        = string
}

variable "server_name" {
  description = "Name of the PostgreSQL server (unique within Azure)"
  type        = string
}

variable "admin_username" {
  description = "Administrator login for the PostgreSQL server"
  type        = string
}

variable "admin_password" {
  description = "Administrator password for the PostgreSQL server"
  type        = string
  sensitive   = true
}

variable "sku_name" {
  description = "The SKU name for the PostgreSQL server (e.g., B_Gen5_1, GP_Gen5_2)"
  type        = string
  default     = "B_Standard_B1ms"
}

variable "postgres_version" {
  description = "The version of PostgreSQL to use"
  type        = string
  default     = "16"
}

variable "vnet_id" {
  description = "The ID of the virtual network"
  type        = string
}

variable "db_subnet_id" {
    description = "The ID of the subnet for the PostgreSQL server"
    type        = string
}