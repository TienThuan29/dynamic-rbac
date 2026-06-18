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

resource "azurerm_api_management_named_value" "values" {
  for_each = var.named_values

  name                = each.key
  display_name        = each.value.display_name
  api_management_name = azurerm_api_management.apim.name
  resource_group_name = var.resource_group_name
  value               = each.value.value
  secret              = each.value.is_secret
}

resource "azurerm_api_management_api" "apis" {
  for_each = var.apis

  name                  = "${var.name_prefix}-${var.environment}-api-${each.key}-${var.region}"
  resource_group_name   = var.resource_group_name
  api_management_name   = azurerm_api_management.apim.name
  revision              = "1"
  display_name          = each.value.display_name
  path                  = each.value.path
  protocols             = ["https"]
  service_url           = each.value.backend_url
  subscription_required = false
}

resource "azurerm_api_management_api_policy" "policies" {
  for_each = { for k, v in var.apis : k => v if v.policy_file != null }

  api_name            = azurerm_api_management_api.apis[each.key].name
  api_management_name = azurerm_api_management.apim.name
  resource_group_name = var.resource_group_name
  xml_content         = templatefile(each.value.policy_file, each.value.policy_vars)
}

locals {
  methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]

  # Cartesian product of api keys × HTTP methods for catch-all operations
  api_operations = {
    for combo in setproduct(keys(var.apis), local.methods) :
    "${combo[0]}-${lower(combo[1])}" => {
      api_key = combo[0]
      method  = combo[1]
    }
  }
}

resource "azurerm_api_management_api_operation" "catchall" {
  for_each = local.api_operations

  operation_id        = "${each.key}-catchall"
  api_name            = azurerm_api_management_api.apis[each.value.api_key].name
  api_management_name = azurerm_api_management.apim.name
  resource_group_name = var.resource_group_name
  display_name        = "Catch All ${each.value.method}"
  method              = each.value.method
  url_template        = "/{*path}"

  template_parameter {
    name     = "path"
    type     = "string"
    required = true
  }
}
