output "vnet_id" {
    description = "Id of VNet"
    value = azurerm_virtual_network.vnet.id
}

output "apim_subnet_id" {
    description = "Id subnet for Api Management"
    value = azurerm_subnet_network_security_group_association.apim_nsg_asso.subnet_id
}

output "app_subnet_id" {
    description = "Id subnet for Container Apps"
    value = azurerm_subnet.apps.id
}

output "db_subnet_id" {
    description = "Id subnet for PostgreSQL database"
    value = azurerm_subnet.database.id
}

