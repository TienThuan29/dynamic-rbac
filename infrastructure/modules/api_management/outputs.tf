output "apim_id" {
  description = "API Management ID"
  value       = azurerm_api_management.apim.id
}

output "gateway_url" {
  description = "API Gateway base URL (e.g., https://my-apim.azure-api.net)"
  value       = azurerm_api_management.apim.gateway_url
}

output "portal_url" {
  description = "Developer Portal link"
  value       = azurerm_api_management.apim.portal_url
}

output "principal_id" {
  description = "APIM Managed Identity"
  value       = azurerm_api_management.apim.identity[0].principal_id
}