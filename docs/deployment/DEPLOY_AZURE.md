# Deploy lên Azure

Hướng dẫn deploy toàn bộ hệ thống lên Azure App Service (hoặc Azure Container Instances).

---

## 1. Chuẩn bị Infrastructure

### 1.1. Tạo Azure Database for PostgreSQL

```bash
# Tạo PostgreSQL Flexible Server
az postgres flexible-server create \
  --resource-group <rg-name> \
  --name <pg-server-name> \
  --sku-name Standard_D2s_v3 \
  --storage-size 32 \
  --location southeastasia \
  --admin-user <admin-username> \
  --admin-password <admin-password> \
  --public none \
  --database-name postgres

# Lấy connection string
az postgres flexible-server show-connection-string \
  --server-name <pg-server-name> \
  --admin-user <admin-username> \
  --admin-password <admin-password>
```

### 1.2. Tạo Azure App Service Plan và Web Apps

```bash
# Tạo App Service Plan (Free tier F1 cho dev, B1 cho prod)
az appservice plan create \
  --resource-group <rg-name> \
  --name <plan-name> \
  --sku F1 \
  --is-linux

# Tạo Web App cho AuthModule
az webapp create \
  --resource-group <rg-name> \
  --plan <plan-name> \
  --name <authmodule-app-name> \
  --deployment-container-image-name dynamicrbac.azurecr.io/dynamic-rbac/authmodule:latest

# Tạo Web App cho MainModule
az webapp create \
  --resource-group <rg-name> \
  --plan <plan-name> \
  --name <mainmodule-app-name> \
  --deployment-container-image-name dynamicrbac.azurecr.io/dynamic-rbac/mainmodule:latest

# Tạo Web App cho Frontend (Static Web App)
az staticwebapp create \
  --resource-group <rg-name> \
  --name <frontend-app-name> \
  --sku free
```

### 1.3. Cấu hình Azure Container Registry

```bash
# Login to ACR
az acr login --name dynamicrbac

# Enable admin user (nếu cần)
az acr update --name dynamicrbac --admin-enabled true
```

---

## 2. Build và Push Docker Images

```bash
# Login to Azure
az login

# Build và push tất cả images lên ACR
chmod +x scripts/build-push.sh
./scripts/build-push.sh dynamicrbac.azurecr.io v1.0.0

# Verify images đã push
az acr repository list --name dynamicrbac --output table
```

---

## 3. Cấu hình App Settings cho từng Service

### 3.1. AuthModule (Azure App Service)

**Settings:**
```
Name: ConnectionStrings__DefaultConnection
Value: Host=<pg-server>.postgres.database.azure.com;Port=5432;Database=postgres;Username=<admin-user>;Password=<admin-password>;SslMode=Require

Name: JWT_SECRET
Value: <your-32-char-secret>

Name: JWT_ISSUER
Value: swovnai

Name: JWT_AUDIENCE
Value: swovnai

Name: WEBSITES_PORT
Value: 8080

Name: DOCKER_REGISTRY_SERVER_URL
Value: https://dynamicrbac.azurecr.io

Name: DOCKER_REGISTRY_SERVER_USERNAME
Value: dynamicrbac

Name: DOCKER_REGISTRY_SERVER_PASSWORD
Value: <acr-password>

Name: DOCKER_CUSTOM_IMAGE_NAME
Value: dynamicrbac.azurecr.io/dynamic-rbac/authmodule:latest
```

### 3.2. MainModule (Azure App Service)

**Settings:**
```
Name: ConnectionStrings__DefaultConnection
Value: Host=<pg-server>.postgres.database.azure.com;Port=5432;Database=postgres;Username=<admin-user>;Password=<admin-password>;SslMode=Require

Name: WEBSITES_PORT
Value: 8080

Name: DOCKER_REGISTRY_SERVER_URL
Value: https://dynamicrbac.azurecr.io

Name: DOCKER_REGISTRY_SERVER_USERNAME
Value: dynamicrbac

Name: DOCKER_REGISTRY_SERVER_PASSWORD
Value: <acr-password>

Name: DOCKER_CUSTOM_IMAGE_NAME
Value: dynamicrbac.azurecr.io/dynamic-rbac/mainmodule:latest
```

### 3.3. LocalGateway (Azure App Service)

**Settings:**
```
Name: GATEWAY_MODE
Value: Local

Name: AUTH_MODULE_URL
Value: https://<authmodule-app>.azurewebsites.net

Name: MAIN_MODULE_URL
Value: https://<mainmodule-app>.azurewebsites.net

Name: WEBSITES_PORT
Value: 8080

Name: DOCKER_REGISTRY_SERVER_URL
Value: https://dynamicrbac.azurecr.io

Name: DOCKER_REGISTRY_SERVER_USERNAME
Value: dynamicrbac

Name: DOCKER_REGISTRY_SERVER_PASSWORD
Value: <acr-password>

Name: DOCKER_CUSTOM_IMAGE_NAME
Value: dynamicrbac.azurecr.io/dynamic-rbac/localgateway:latest
```

### 3.4. Thiết lập qua Azure Portal

1. Mở **Azure Portal** → **App Services** → Chọn app
2. Vào **Settings** → **Environment variables**
3. Thêm từng setting ở trên
4. **Save** → **Restart**

---

## 4. Cấu hình Azure API Management (tuỳ chọn)

### 4.1. Thêm Backend Services

```
AuthModule: https://<authmodule-app>.azurewebsites.net
MainModule: https://<mainmodule-app>.azurewebsites.net
LocalGateway: https://<localgateway-app>.azurewebsites.net
```

### 4.2. API Policy — Validate JWT + Inject Headers

```xml
<!-- Global policy (applies to all APIs) -->
<policies>
  <inbound>
    <!-- Validate JWT via shared secret (for internal JWTs) -->
    <validate-jwt header-name="Authorization"
                  failed-validation-httpcode="401"
                  output-token-variable-name="jwt">
      <issuer-signing-keys>
        <key>{{JWT_SECRET}}</key>
      </issuer-signing-keys>
      <audiences>
        <audience>swovnai</audience>
      </audiences>
    </validate-jwt>

    <!-- Extract claims và forward cho downstream -->
    <set-header name="X-APIM-UserId" exists-action="override">
      <value>@{
        var jwt = (JwtToken)context.Variables.GetValueOrDefault("jwt");
        return jwt?.Claims["userId"]?.FirstOrDefault()
            ?? jwt?.Claims["oid"]?.FirstOrDefault()
            ?? "";
      }</value>
    </set-header>
    <set-header name="X-APIM-AccountId" exists-action="override">
      <value>@{
        var jwt = (JwtToken)context.Variables.GetValueOrDefault("jwt");
        return jwt?.Claims["accountId"]?.FirstOrDefault() ?? "";
      }</value>
    </set-header>
    <set-header name="X-APIM-Email" exists-action="override">
      <value>@{
        var jwt = (JwtToken)context.Variables.GetValueOrDefault("jwt");
        return jwt?.Claims["email"]?.FirstOrDefault() ?? "";
      }</value>
    </set-header>
    <set-header name="X-APIM-Role" exists-action="override">
      <value>@{
        var jwt = (JwtToken)context.Variables.GetValueOrDefault("jwt");
        return jwt?.Claims["role"]?.FirstOrDefault() ?? "User";
      }</value>
    </set-header>

    <!-- Rate limiting -->
    <rate-limit-by-key calls="100" renewal-period="60"
                       counter-key="@(context.Request.IpAddress)" />

    <!-- CORS -->
    <cors>
      <allowed-origins>
        <origin>https://<frontend-app>.azurestaticapps.net</origin>
      </allowed-origins>
      <allowed-methods>
        <method>GET</method>
        <method>POST</method>
        <method>PUT</method>
        <method>DELETE</method>
        <method>PATCH</method>
      </allowed-methods>
      <allowed-headers>
        <header>Authorization</header>
        <header>Content-Type</header>
      </allowed-headers>
    </cors>
  </inbound>
</policies>
```

### 4.3. Nếu dùng APIM thay cho LocalGateway

Đặt `GATEWAY_MODE=APIM` trong LocalGateway App Service Settings.

---

## 5. Cấu hình Frontend

### 5.1. Azure Static Web App

```bash
# Deploy frontend lên Static Web App
az staticwebapp appsettings set \
  --name <frontend-app-name> \
  --setting-names \
    VITE_MAIN_API_BASE_URL=https://<apim-or-gateway-url>/api \
    VITE_AUTH_API_BASE_URL=https://<apim-or-gateway-url>/api
```

### 5.2. Nếu dùng Azure Front Door / CDN

Cập nhật `VITE_*_API_BASE_URL` trong Static Web App settings trỏ đến:
- APIM: `https://<apim-name>.azure-api.net`
- Hoặc LocalGateway: `https://<gateway-app>.azurewebsites.net`

---

## 6. Database Migration

Sau khi AuthModule đã chạy trên Azure, chạy migration để tạo bảng:

```bash
# SSH vào AuthModule container và chạy migration
az webapp create-remote-connection \
  --resource-group <rg-name> \
  --name <authmodule-app-name>

# Hoặc dùng curl trigger (nếu có endpoint)
curl -X POST https://<authmodule-app>.azurewebsites.net/api/migrate \
  -H "Authorization: Bearer <admin-token>"
```

---

## 7. Kiểm tra sau Deploy

```bash
# Test AuthModule
curl https://<authmodule-app>.azurewebsites.net/api/permissions

# Test Login
curl -X POST https://<authmodule-app>.azurewebsites.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"...","entraIdObjectId":"..."}'

# Test Gatekeeper
curl -X POST https://<authmodule-app>.azurewebsites.net/api/gatekeeper \
  -H "Content-Type: application/json" \
  -d '{"authorizationHeader":"Bearer <token>","method":"GET","path":"/api/products"}'

# Test Frontend
curl https://<frontend-app>.azurestaticapps.net
```

---

## 8. Environment Variables tổng hợp

| Variable | AuthModule | MainModule | LocalGateway | Frontend |
|----------|------------|------------|-------------|----------|
| `ConnectionStrings__DefaultConnection` | PostgreSQL connection | PostgreSQL connection | — | — |
| `JWT_SECRET` | JWT signing key | — | — | — |
| `JWT_ISSUER` | swovnai | — | — | — |
| `JWT_AUDIENCE` | swovnai | — | — | — |
| `GATEWAY_MODE` | — | — | Local / APIM | — |
| `AUTH_MODULE_URL` | — | — | Backend URL | — |
| `MAIN_MODULE_URL` | — | — | Backend URL | — |
| `VITE_MAIN_API_BASE_URL` | — | — | — | API gateway URL |
| `VITE_AUTH_API_BASE_URL` | — | — | — | API gateway URL |
| `DOCKER_CUSTOM_IMAGE_NAME` | ACR image | ACR image | ACR image | — |

---

## 9. Troubleshooting

### Container không start

```bash
# Xem logs
az webapp log tail --resource-group <rg-name> --name <app-name>

# Kiểm tra app settings
az webapp config appsettings show --resource-group <rg-name> --name <app-name>
```

### Lỗi kết nối PostgreSQL

```bash
# Kiểm tra firewall
az postgres flexible-server firewall-rule list \
  --resource-group <rg-name> \
  --server-name <pg-server-name>

# Thêm firewall rule cho App Service outbound IPs
az postgres flexible-server firewall-rule create \
  --resource-group <rg-name> \
  --server-name <pg-server-name> \
  --rule-name allow-azure-apps \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### JWT validation fail

- Đảm bảo `JWT_SECRET` giống nhau ở tất cả services
- Kiểm tra `JWT_ISSUER` và `JWT_AUDIENCE` match với JWT claims
