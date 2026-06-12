output "server_id" {
    description = "The ID of the PostgreSQL server"
    value       = azurerm_postgresql_flexible_server.server.id
}

output "host" {
    description = "Address of the PostgreSQL server"
    value = azurerm_postgresql_flexible_server.server.fqdn
}

output "database_name" {
    description = "Name of the PostgreSQL database"
    value       = azurerm_postgresql_flexible_server_database.db.name
}

output "admin_username" {
    description = "Administrator login for the PostgreSQL server"
    value       = azurerm_postgresql_flexible_server.server.administrator_login
}