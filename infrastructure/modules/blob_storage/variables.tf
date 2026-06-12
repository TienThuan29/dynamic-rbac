variable "resource_group_name" {
    description = "The name of the resource group in which to create the storage account."
    type        = string
}

variable "location" {
    description = "The Azure region in which to create the storage account."
    type        = string
}

variable "storage_account_name" {
    description = "The name of the storage account to create."
    type        = string
}

variable "account_tier" {
    description = "The tier of the storage account."
    type        = string
}

variable "account_replication_type" {
    description = "The replication type of the storage account."
    type        = string
    default = "LRS" # Locally-redundant storage (LRS) is the default replication type for Azure Storage accounts. It replicates data three times within a single data center in the same region, providing high durability and availability for your data.
}

variable "container_name" {
    description = "The name of the blob container to create."
    type        = string
    default = "default-container" # Default container name if not provided
}


