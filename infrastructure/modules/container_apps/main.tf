resource "azurerm_log_analytics_workspace" "logs" {
  name                = "law-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = 30 # save logs for 30 days
}

# init Managedd Environment
resource "azurerm_container_app_environment" "env" {
  name                       = "cae-${var.environment}"
  location                   = var.location
  resource_group_name        = var.resource_group_name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id

  # connect this environment to delegated subnet
  infrastructure_subnet_id       = var.app_subnet_id
  internal_load_balancer_enabled = false # set 'false' to frontend can access to public IP
}

# init module(s)
resource "azurerm_container_app" "auth_service" {
  name                         = "ca-auth-${var.environment}"
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"

  # setup to pull image from ACR
  registry {
    server               = var.registry_login_server
    username             = var.registry_username
    password_secret_name = "registry-password"
  }

  # Quản lý kho Secret an toàn (Không in ra Log)
  secret {
    name  = "registry-password"
    value = var.registry_password
  }

  secret {
    name  = "db-connection-string"
    value = var.postgres_connection_string
  }

  template {
    min_replicas = 0 # auto scale to 0 to save cost
    max_replicas = 3 # auto scale up to 3 instances when needed

    container {
      name   = "auth-module"
      image  = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
      cpu    = 0.5
      memory = "1.0Gi" # 1GB RAM

      # Env for container
      env {
        name  = "ASPNETCORE_ENVIRONMENT"
        value = "Production"
      }

      env {
        name        = "ConnectionStrings__DefaultConnection"
        secret_name = "db-connection-string"
      }
    }
  }

  ingress {
    allow_insecure_connections = true # allow http traffic (not recommended for production, use https in real case)
    external_enabled           = false
    target_port                = 8080
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }
}

resource "azurerm_container_app" "main_service" {
  name                         = "ca-main-${var.environment}"
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

  secret {
    name  = "db-connection-string"
    value = var.postgres_connection_string
  }

  template {
    min_replicas = 1 # Service chính nên lúc nào cũng để 1 bản sao chờ sẵn cho nhanh
    max_replicas = 3

    container {
      name   = "main-module"
      image  = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
      cpu    = 0.5 
      memory = "1.0Gi"

      env {
        name  = "ASPNETCORE_ENVIRONMENT"
        value = "Production"
      }

      env {
        name        = "ConnectionStrings__DefaultConnection"
        secret_name = "db-connection-string"
      }
      
      # Ví dụ: Gọi Auth Module từ Main Module thông qua FQDN nội bộ
      env {
        name  = "AUTH_SERVICE_URL"
        value = "https://${azurerm_container_app.auth_service.ingress[0].fqdn}" 
      }
    }
  }

  ingress {
    allow_insecure_connections = false
    external_enabled           = false # Cũng ẩn bên trong mạng nội bộ
    target_port                = 8080
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }
}

resource "azurerm_container_app" "frontend" {
  name                         = "ca-frontend-${var.environment}"
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

  template {
    min_replicas = 1
    max_replicas = 5

    container {
      name   = "frontend"
      image  = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name  = "NODE_ENV"
        value = "production"
      }
    }
  }

  ingress {
    allow_insecure_connections = false
    external_enabled           = true # React app needs to be publicly accessible
    target_port                = 8080
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }
}