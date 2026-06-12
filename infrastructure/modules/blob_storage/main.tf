resource "azurerm_storage_account" "storage" {
  name                     = var.storage_account_name
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = var.account_tier
  account_replication_type = var.account_replication_type

  # setting standard security for blob storage
  https_traffic_only_enabled = true
  min_tls_version = "TLS1_2"
  allow_nested_items_to_be_public = false 
  
  tags = {
    Environment = "lab-terraform-azure"
  }

}

resource "azurerm_storage_container" "container" {
    name = var.container_name
    # storage_account_id = azurerm_storage_account.storage.id
    storage_account_name  = azurerm_storage_account.storage.name
    container_access_type = "private"
}