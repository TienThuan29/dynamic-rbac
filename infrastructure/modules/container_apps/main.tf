resource "azurerm_log_analytics_workspace" "logs" {
  name                = "${var.name_prefix}-${var.environment}-law-${var.region}"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_container_app_environment" "env" {
  name                           = "${var.name_prefix}-${var.environment}-cae-${var.region}"
  location                       = var.location
  resource_group_name            = var.resource_group_name
  log_analytics_workspace_id     = azurerm_log_analytics_workspace.logs.id
  infrastructure_subnet_id       = var.app_subnet_id
  internal_load_balancer_enabled = false
}

resource "azurerm_container_app" "apps" {
  for_each = var.apps

  name                         = "${var.name_prefix}-${var.environment}-ca-${each.value.name_suffix}-${var.region}"
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"

  registry {
    server               = var.registry_login_server
    username             = var.registry_username
    password_secret_name = "registry-password"
  }

  secret {
    name  = "registry-password"
    value = var.registry_password
  }

  # Only inject DB secret for apps that need it
  dynamic "secret" {
    for_each = each.value.needs_db ? [1] : []
    content {
      name  = "db-connection-string"
      value = var.postgres_connection_string
    }
  }

  template {
    min_replicas = each.value.min_replicas
    max_replicas = each.value.max_replicas

    container {
      name   = each.key
      image  = each.value.image
      cpu    = each.value.cpu
      memory = each.value.memory

      dynamic "env" {
        for_each = each.value.env_vars
        content {
          name  = env.key
          value = env.value
        }
      }

      # DB connection string referenced via secret
      dynamic "env" {
        for_each = each.value.needs_db ? { "ConnectionStrings__DefaultConnection" = "db-connection-string" } : {}
        content {
          name        = env.key
          secret_name = env.value
        }
      }

      # Cross-app env vars: resolves app key -> internal FQDN at plan time
      # Terraform dependency graph ensures referenced app is created first
      dynamic "env" {
        for_each = each.value.service_refs
        content {
          name  = env.key
          value = "https://${azurerm_container_app.apps[env.value].ingress[0].fqdn}"
        }
      }
    }
  }

  ingress {
    allow_insecure_connections = each.value.allow_insecure
    external_enabled           = each.value.external_enabled
    target_port                = each.value.target_port
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }
}
