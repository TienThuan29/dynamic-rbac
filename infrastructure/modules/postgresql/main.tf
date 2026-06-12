# create private dns zone for postgresql
resource "azurerm_private_dns_zone" "postgres" {
  name                = "${var.server_name}.private.postgres.database.azure.com"
  resource_group_name = var.resource_group_name
}

# link this private dns to vnet
resource "azurerm_private_dns_zone_virtual_network_link" "postgres" {
  name                  = "link-postgres-dns-to-vnet"
  resource_group_name   = var.resource_group_name
  private_dns_zone_name = azurerm_private_dns_zone.postgres.name
  virtual_network_id    = var.vnet_id
}

# create postgresql server cluster
resource "azurerm_postgresql_flexible_server" "server" {
  name                   = var.server_name
  resource_group_name    = var.resource_group_name
  location               = var.location
  version                = var.postgres_version
  administrator_login    = var.admin_username
  administrator_password = var.admin_password
  sku_name               = var.sku_name
  storage_mb             = 32768 # 32 GB
  public_network_access_enabled = false

  # connect to delegated subnet
  delegated_subnet_id = var.db_subnet_id
  private_dns_zone_id = azurerm_private_dns_zone.postgres.id

  # Ensure the DNS connection flow is complete before creating the server.
  depends_on = [azurerm_private_dns_zone_virtual_network_link.postgres]

  lifecycle {
    ignore_changes = [zone]
  }
}

# init databsase in postgre server
resource "azurerm_postgresql_flexible_server_database" "db" {
  name      = "dynamic_rbac_db"
  server_id = azurerm_postgresql_flexible_server.server.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}
