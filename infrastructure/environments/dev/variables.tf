variable "resource_group_name" {
  type = string
}

variable "location" {
  type = string
}

variable "pg_admin_password" {
  type = string
}

variable "apim_name" {
  description = "Name of the API Management instance (Must be globally unique)"
  type        = string
}

variable "publisher_email" {
  description = "Email of the API Management system administrator"
  type        = string
}

variable "jwt_secret_b64" {
  description = "Secret key used by APIM to validate JWT tokens (Base64 encoded)"
  type        = string
}