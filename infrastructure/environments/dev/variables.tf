variable "resource_group_name" {
  type = string
}

variable "location" {
  type = string
}

variable "name_prefix" {
  description = "Name prefix for all resources, e.g. 'dynamic-rbac'"
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

variable "pg_admin_password" {
  type = string
}

variable "publisher_email" {
  description = "Email of the API Management system administrator"
  type        = string
}

variable "jwt_secret_b64" {
  description = "Secret key used by APIM to validate JWT tokens (Base64 encoded)"
  type        = string
}