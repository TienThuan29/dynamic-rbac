output "storage_account_id" {
    description = "The ID of the storage account."
    value       = azurerm_storage_account.storage.id
}

output "storage_account_name" {
    description = "The name of the storage account."
    value       = azurerm_storage_account.storage.name
}

output "primary_blob_endpoint" {
    description = "The primary blob endpoint of the storage account."
    value       = azurerm_storage_account.storage.primary_blob_endpoint
}

output "primary_connection_string" {
    description = "The primary connection string for the storage account."
    value       = azurerm_storage_account.storage.primary_connection_string
}

output "container_name" {
    description = "The name of the blob container."
    value       = azurerm_storage_container.container.name
}
