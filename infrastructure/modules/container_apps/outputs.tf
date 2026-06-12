output "environment_id" {
    description = "Id of container app environment (use for create MainModule)"
    value = azurerm_container_app_environment.env.id
}

output "auth_service_fqdn" {
    description = "FQDN of internal auth service"
    value = azurerm_container_app.auth_service.ingress[0].fqdn
}

output "main_service_fqdn" {
    description = "FQDN of internal main service"
    value = azurerm_container_app.main_service.ingress[0].fqdn
}

output "frontend_fqdn" {
    description = "Public FQDN of the React frontend"
    value = azurerm_container_app.frontend.ingress[0].fqdn
}