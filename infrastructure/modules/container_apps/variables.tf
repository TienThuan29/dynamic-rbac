variable "resource_group_name" {
  description = "The name of the resource group."
  type        = string
}

variable "location" {
  description = "The location of the resources."
  type        = string
}

variable "name_prefix" {
  description = "Name prefix for all resources"
  type        = string
}

variable "environment" {
  description = "The environment name."
  type        = string
}

variable "region" {
  description = "Short region code, e.g. 'sea' for southeastasia"
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
  description = "Connection string for postgres database. Required if any app has needs_db = true."
  type        = string
  sensitive   = true
  default     = ""
}

variable "apps" {
  description = "Map of container apps to deploy. Key is used as container name and for_each key."
  type = map(object({
    name_suffix      = string
    image            = string
    min_replicas     = number
    max_replicas     = number
    cpu              = number
    memory           = string
    target_port      = optional(number)
    external_enabled = bool
    allow_insecure   = optional(bool, false)
    needs_db         = optional(bool, false)
    env_vars         = optional(map(string), {})
    service_refs     = optional(map(string), {})
  }))
}
