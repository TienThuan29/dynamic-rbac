resource "azurerm_api_management" "apim" {
  name                = var.apim_name
  location            = var.location
  resource_group_name = var.resource_group_name
  publisher_name      = var.publisher_name
  publisher_email     = var.publisher_email
  sku_name            = var.sku_name

  virtual_network_type = "External"
  
  virtual_network_configuration {
    subnet_id = var.apim_subnet_id
  }

  identity {
    type = "SystemAssigned"
  }
}

resource "azurerm_api_management_named_value" "jwt_secret" {
  name                = "JWT_SECRET"
  api_management_name = azurerm_api_management.apim.name
  resource_group_name = var.resource_group_name
  display_name        = "JWT_SECRET"
  value               = var.jwt_secret_b64
  secret              = true
}

resource "azurerm_api_management_api" "auth_api" {
  name                = "api-service-1"
  resource_group_name = var.resource_group_name
  api_management_name = azurerm_api_management.apim.name
  revision            = "1"
  display_name        = "AuthModule"
  path                = "auth-api"
  protocols           = ["https"]
  service_url         = var.auth_api_url
  subscription_required = false
}

resource "azurerm_api_management_api_policy" "auth_api_policy" {
  api_name            = azurerm_api_management_api.auth_api.name
  api_management_name = azurerm_api_management.apim.name
  resource_group_name = var.resource_group_name
  xml_content         = templatefile("${path.module}/auth_policy.xml", {
    auth_api_url = var.auth_api_url
  })
}

resource "azurerm_api_management_api" "main_api" {
  name                = "api-service-2"
  resource_group_name = var.resource_group_name
  api_management_name = azurerm_api_management.apim.name
  revision            = "1"
  display_name        = "MainModule"
  path                = "products-api"
  protocols           = ["https"]
  service_url         = var.main_api_url
  subscription_required = false
}

resource "azurerm_api_management_api_policy" "main_api_policy" {
  api_name            = azurerm_api_management_api.main_api.name
  api_management_name = azurerm_api_management.apim.name
  resource_group_name = var.resource_group_name
  xml_content         = templatefile("${path.module}/main_policy.xml", {
    auth_api_url = var.auth_api_url
  })
}

locals {
  methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
}

resource "azurerm_api_management_api_operation" "auth_catchall" {
  for_each            = toset(local.methods)
  operation_id        = "auth-catchall-${lower(each.key)}"
  api_name            = azurerm_api_management_api.auth_api.name
  api_management_name = azurerm_api_management.apim.name
  resource_group_name = var.resource_group_name
  display_name        = "Catch All ${each.key}"
  method              = each.key
  url_template        = "/{*path}"
  
  template_parameter {
    name     = "path"
    type     = "string"
    required = true
  }
}

resource "azurerm_api_management_api_operation" "main_catchall" {
  for_each            = toset(local.methods)
  operation_id        = "main-catchall-${lower(each.key)}"
  api_name            = azurerm_api_management_api.main_api.name
  api_management_name = azurerm_api_management.apim.name
  resource_group_name = var.resource_group_name
  display_name        = "Catch All ${each.key}"
  method              = each.key
  url_template        = "/{*path}"
  
  template_parameter {
    name     = "path"
    type     = "string"
    required = true
  }
}