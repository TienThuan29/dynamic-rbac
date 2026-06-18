output "environment_id" {
  description = "ID of the Container App Environment"
  value       = azurerm_container_app_environment.env.id
}

output "app_fqdns" {
  description = "Map of app key to its internal/external FQDN"
  value       = { for k, v in azurerm_container_app.apps : k => v.ingress[0].fqdn }
}
