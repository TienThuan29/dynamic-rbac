variable "resource_group_name" {
  description = "The name of the resource group."
  type        = string
}

variable "location" {
  description = "The location of the resources."
  type        = string
}

variable "environment" {
  description = "The environment name."
  type        = string
}

variable "app_subnet_id" {
  description = "The ID of the subnet for the container app."
  type        = string
}

variable "registry_login_server" {
  description = "Url of docker image from container_registry"
  type        = string
}

variable "registry_username" {
  description = "Username for container registry"
  type        = string
}

variable "registry_password" {
  description = "Password for container registry"
  type        = string
}

variable "postgres_connection_string" {
  description = "Connection string for postgres database"
  type        = string
  sensitive   = true
}
