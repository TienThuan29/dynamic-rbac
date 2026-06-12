variable "resource_group_name" {
    description = "The name of the resource group."
    type        = string
}

variable "location" {
    description = "The location of the resource group."
    type        = string
}

variable "registry_name" {
    description = "The name of the registry."
    type        = string
}

variable "sku" {
    description = "The SKU of the registry. Possible values are: Basic, Standard, Premium."
    type        = string
    default    = "Basic"
}

variable "admin_enabled" {
    description = "Enable admin account to CI/CD for logging and pushing images."
    type        = bool
    default     = true
}

