locals {
  # Resource names following convention: {name_prefix}-{environment}-{resource_type}-{region}
  # Note: Storage account and container registry use alphanumeric only (Azure constraint)
  vnet_name            = "${var.name_prefix}-${var.environment}-vnet-${var.region}"
  pg_server_name       = "${var.name_prefix}-${var.environment}-pg-${var.region}"
  storage_account_name = lower(replace("${var.name_prefix}-${var.environment}-stg-${var.region}", "-", ""))
  registry_name        = lower(replace("${var.name_prefix}-${var.environment}-cr-${var.region}", "-", ""))
  apim_name            = "${var.name_prefix}-${var.environment}-apim-${var.region}"
}

# network
module "network" {
  source              = "../../modules/network"
  resource_group_name = var.resource_group_name
  location            = var.location
  name_prefix         = var.name_prefix
  environment         = var.environment
  region              = var.region
  vnet_name           = local.vnet_name
}

# database
module "postgresql" {
  source              = "../../modules/postgresql"
  resource_group_name = var.resource_group_name
  location            = var.location
  server_name         = local.pg_server_name
  name_prefix         = var.name_prefix
  environment         = var.environment
  region              = var.region

  vnet_id      = module.network.vnet_id
  db_subnet_id = module.network.db_subnet_id

  admin_username = "pgadmin"
  admin_password = var.pg_admin_password
}

module "blob_storage" {
  source               = "../../modules/blob_storage"
  resource_group_name  = var.resource_group_name
  location             = var.location
  storage_account_name = local.storage_account_name
  account_tier         = "Standard"
}

module "container_registry" {
  source              = "../../modules/container_registry"
  resource_group_name = var.resource_group_name
  location            = var.location
  registry_name       = local.registry_name
}

module "container_apps" {
  source              = "../../modules/container_apps"
  resource_group_name = var.resource_group_name
  location            = var.location
  name_prefix         = var.name_prefix
  environment         = var.environment
  region              = var.region

  # subnet from network module
  app_subnet_id = module.network.app_subnet_id

  # get registry credentials from container registry module
  registry_login_server = module.container_registry.login_server
  registry_username     = module.container_registry.admin_username
  registry_password     = module.container_registry.admin_password

  # build connection string from Postgres module (extremely secure)
  postgres_connection_string = "Server=${module.postgresql.host};Database=${module.postgresql.database_name};Port=5432;User Id=${module.postgresql.admin_username};Password=${var.pg_admin_password};Ssl Mode=Require;"

  apps = {
    auth = {
      name_suffix      = "auth"
      image            = "${module.container_registry.login_server}/dynamic-rbac/authmodule:latest"
      min_replicas     = 0
      max_replicas     = 3
      cpu              = 0.5
      memory           = "1.0Gi"
      external_enabled = false
      allow_insecure   = true
      needs_db         = true
      env_vars         = { ASPNETCORE_ENVIRONMENT = "Production" }
    }
    main = {
      name_suffix      = "main"
      image            = "${module.container_registry.login_server}/dynamic-rbac/mainmodule:latest"
      min_replicas     = 1
      max_replicas     = 3
      cpu              = 0.5
      memory           = "1.0Gi"
      external_enabled = false
      needs_db         = true
      env_vars         = { ASPNETCORE_ENVIRONMENT = "Production" }
      service_refs     = { AUTH_SERVICE_URL = "auth" }
    }
    frontend = {
      name_suffix      = "fe"
      image            = "${module.container_registry.login_server}/dynamic-rbac/frontend:latest"
      min_replicas     = 1
      max_replicas     = 5
      cpu              = 0.25
      memory           = "0.5Gi"
      external_enabled = true
      env_vars         = { NODE_ENV = "production" }
    }
  }
}

module "api_management" {
  source = "../../modules/api_management"

  resource_group_name = var.resource_group_name
  location            = var.location
  name_prefix         = var.name_prefix
  environment         = var.environment
  region              = var.region

  apim_name       = local.apim_name
  publisher_email = var.publisher_email
  apim_subnet_id  = module.network.apim_subnet_id

  apis = {
    auth = {
      display_name = "AuthModule"
      path         = "auth-api"
      backend_url  = module.container_apps.app_fqdns["auth"]
      policy_file  = "${path.module}/policies/auth_policy.xml"
      policy_vars  = { auth_api_url = module.container_apps.app_fqdns["auth"] }
    }
    main = {
      display_name = "MainModule"
      path         = "products-api"
      backend_url  = module.container_apps.app_fqdns["main"]
      policy_file  = "${path.module}/policies/main_policy.xml"
      policy_vars  = { auth_api_url = module.container_apps.app_fqdns["auth"] }
    }
  }

  named_values = {
    JWT_SECRET = {
      display_name = "JWT_SECRET"
      value        = var.jwt_secret_b64
      is_secret    = true
    }
  }
}
