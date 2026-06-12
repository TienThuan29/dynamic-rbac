# network
module "network" {
  source              = "../../modules/network"
  resource_group_name = var.resource_group_name
  location            = var.location
  vnet_name           = "vnet-dynamic-rbac-dev"
}

# database
module "postgresql" {
  source              = "../../modules/postgresql"
  resource_group_name = var.resource_group_name
  location            = var.location
  server_name         = "pg-dynamic-rbac-dev"

  vnet_id      = module.network.vnet_id
  db_subnet_id = module.network.db_subnet_id

  admin_username = "pgadmin"
  admin_password = var.pg_admin_password
}

module "blob_storage" {
  source               = "../../modules/blob_storage"
  resource_group_name  = var.resource_group_name
  location             = var.location
  storage_account_name = "stgdynamicrbacdev"
  account_tier         = "Standard"
}

module "container_registry" {
  source              = "../../modules/container_registry"
  resource_group_name = var.resource_group_name
  location            = var.location
  registry_name       = "crdynamicrbacdev"
}

module "container_apps" {
  source              = "../../modules/container_apps"
  resource_group_name = var.resource_group_name
  location            = var.location
  environment         = "dev"

  # subnet from network module
  app_subnet_id = module.network.app_subnet_id

  # get registry credentials from container registry module
  registry_login_server = module.container_registry.login_server
  registry_username     = module.container_registry.admin_username
  registry_password     = module.container_registry.admin_password

  # build connection string from Postgres module (extremely secure)
  postgres_connection_string = "Server=${module.postgresql.host};Database=${module.postgresql.database_name};Port=5432;User Id=${module.postgresql.admin_username};Password=${var.pg_admin_password};Ssl Mode=Require;"
}

module "api_management" {
  source = "../../modules/api_management"

  resource_group_name = var.resource_group_name
  location            = var.location

  apim_name       = var.apim_name
  publisher_email = var.publisher_email
  apim_subnet_id  = module.network.apim_subnet_id

  auth_api_url = module.container_apps.auth_service_fqdn
  main_api_url = module.container_apps.main_service_fqdn

  jwt_secret_b64 = var.jwt_secret_b64
}
