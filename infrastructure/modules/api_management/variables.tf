variable "resource_group_name" {
  description = "Resource Group name"
  type        = string
}

variable "location" {
  description = "Deployment location"
  type        = string
}

variable "apim_name" {
  description = "Name of the API Management instance (Must be globally unique)"
  type        = string
}

variable "publisher_name" {
  description = "Name of the organization/individual owning the API"
  type        = string
  default     = "Dynamic RBAC Corp"
}

variable "publisher_email" {
  description = "Email to receive quota and security notifications from Azure"
  type        = string
}

variable "sku_name" {
  description = "Service plan configuration"
  type        = string
  default     = "Developer_1" 
}

variable "apim_subnet_id" {
  description = "ID of the dedicated Subnet for APIM (Obtained from the network module)"
  type        = string
}

variable "auth_api_url" {
  description = "URL of the AuthModule backend"
  type        = string
}

variable "main_api_url" {
  description = "URL of the MainModule backend"
  type        = string
}

variable "jwt_secret_b64" {
  description = "Base64 encoded JWT secret"
  type        = string
  sensitive   = true
}