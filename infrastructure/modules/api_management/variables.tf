variable "resource_group_name" {
  description = "Resource Group name"
  type        = string
}

variable "location" {
  description = "Deployment location"
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

variable "apim_name" {
  description = "Name of the API Management instance (must be globally unique)"
  type        = string
}

variable "publisher_name" {
  description = "Name of the organization owning the API"
  type        = string
  default     = ""
}

variable "publisher_email" {
  description = "Email to receive quota and security notifications from Azure"
  type        = string
}

variable "sku_name" {
  description = "APIM SKU, e.g. Developer_1, Standard_1"
  type        = string
  default     = "Developer_1"
}

variable "apim_subnet_id" {
  description = "ID of the dedicated subnet for APIM (from network module)"
  type        = string
}

variable "apis" {
  description = "Map of APIs to expose through APIM. Key is used as identifier."
  # Usage example in dev/main.tf:
  #
  # apis = {
  #   auth = {
  #     display_name = "AuthModule"
  #     path         = "auth-api"                                          # → gateway_url/auth-api/*
  #     backend_url  = module.container_apps.app_fqdns["auth"]
  #     policy_file  = "${path.module}/policies/auth_policy.xml"          # path relative to environment dir
  #     policy_vars  = { auth_api_url = module.container_apps.app_fqdns["auth"] }
  #   }
  #   main = {
  #     display_name = "MainModule"
  #     path         = "products-api"
  #     backend_url  = module.container_apps.app_fqdns["main"]
  #     policy_file  = "${path.module}/policies/main_policy.xml"
  #     policy_vars  = { auth_api_url = module.container_apps.app_fqdns["auth"] }
  #   }
  # }
  type = map(object({
    display_name = string
    path         = string           # URL path prefix in APIM gateway
    backend_url  = string
    policy_file  = optional(string) # absolute path to XML policy template (null = no policy)
    policy_vars  = optional(map(string), {})
  }))
}

variable "named_values" {
  description = "Secrets and configs injected into APIM policies as named values."
  # Usage example in dev/main.tf:
  #
  # named_values = {
  #   JWT_SECRET = {
  #     display_name = "JWT_SECRET"
  #     value        = var.jwt_secret_b64
  #     is_secret    = true
  #   }
  # }
  type = map(object({
    display_name = string
    value        = string
    is_secret    = optional(bool, false)
  }))
  default = {}
}
