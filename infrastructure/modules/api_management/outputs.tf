output "apim_id" {
  description = "Mã ID của API Management"
  value       = azurerm_api_management.apim.id
}

output "gateway_url" {
  description = "Đường dẫn URL gốc của API Gateway (Ví dụ: https://my-apim.azure-api.net)"
  value       = azurerm_api_management.apim.gateway_url
}

output "portal_url" {
  description = "Đường dẫn Developer Portal (Cho các đối tác xem tài liệu API)"
  value       = azurerm_api_management.apim.portal_url
}

output "principal_id" {
  description = "Mã định danh Managed Identity của APIM"
  value       = azurerm_api_management.apim.identity[0].principal_id
}