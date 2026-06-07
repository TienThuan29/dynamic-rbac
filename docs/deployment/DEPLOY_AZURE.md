# Azure Deployment Guide

Hướng dẫn deploy toàn bộ hệ thống lên Azure bao gồm kiến trúc, cấu hình và API Management.

---

## 1. Kiến Trúc Tổng Quan

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT                                      │
│                         (React Frontend)                                │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    AZURE API MANAGEMENT (APIM)                           │
│                                                                          │
│   ┌──────────────┐    ┌──────────────┐                                  │
│   │  /auth-api/* │    │/products-api/*│                                  │
│   │  (AuthModule)│    │ (MainModule) │                                  │
│   └──────┬───────┘    └──────┬───────┘                                  │
│          │                   │                                           │
│          │ Policy:           │ Policy:                                   │
│          │ - CORS            │ - CORS                                    │
│          │ - Rate Limit      │ - Rate Limit                              │
│          │ - Gatekeeper Call │ - Gatekeeper Call                         │
│          │ - Rewrite URI     │ - Rewrite URI                            │
│          └───────┬───────────┘                                           │
└──────────────────┼───────────────────────────────────────────────────────┘
                   │ Internal HTTPS
                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│               AZURE CONTAINER APPS ENVIRONMENT                            │
│                    (env-swo-core)                                        │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                    Container Apps                                 │  │
│   │                                                                  │  │
│   │   ┌──────────────────┐     ┌──────────────────┐                  │  │
│   │   │  api-service-1   │     │  api-service-2   │                  │  │
│   │   │  (AuthModule)    │     │  (MainModule)    │                  │  │
│   │   │  Port: 8080      │     │  Port: 8080      │                  │  │
│   │   └──────────────────┘     └──────────────────┘                  │  │
│   │                                                                  │  │
│   │   Internal Ingress: Chỉ APIM được gọi, không public              │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                    AZURE DATABASE FOR POSTGRESQL                │  │
│   │                    (pg-tienthuan-db.postgres.database.azure.com) │  │
│   │                                                                  │  │
│   │   Tables: accounts, users, permissions, user_permissions,        │  │
│   │           tokens, token_permissions, permission_groups            │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Luồng Request Chi Tiết

### 2.1. AuthModule (Login)

```
Client
  │
  │ POST /auth-api/login
  │ Headers: Content-Type: application/json
  │
  ▼
APIM (AuthModule Policy)
  │
  │ Match: requestPath == "login"
  │ Action: Rewrite URI to /api/auth/login
  │        (Skip Gatekeeper - public endpoint)
  │
  ▼
AuthModule Container
  │
  │ POST /api/auth/login
  │ Handler: AuthController.Login()
  │
  │ 1. Validate Entra ID token (entraIdObjectId)
  │ 2. Create/Update Account
  │ 3. Generate JWT with claims: userId, accountId, email, role
  │
  ▼
Response: { accessToken: "eyJ...", account: {...} }
```

### 2.2. Protected Resource (Products)

```
Client
  │
  │ GET /products-api/products
  │ Headers: Authorization: Bearer <jwt>
  │
  ▼
APIM (MainModule Policy)
  │
  │ Action: Call Gatekeeper via send-request
  │ URL: https://api-service-1/api/gatekeeper
  │ Body: { authorizationHeader: "Bearer <jwt>",
  │         method: "GET",
  │         path: "/api/products" }
  │
  ▼
AuthModule Container (Gatekeeper)
  │
  │ GatekeeperController.Check()
  │
  │ 1. Extract Bearer token
  │ 2. DB Lookup: tokens table (external token?)
  │ 3. If found: Check TokenPermission
  │ 4. If not found: Validate JWT + Check UserPermission
  │ 5. Return: { allowed: true/false, userId, accountId, ... }
  │
  ▼ (if allowed)
APIM Policy
  │
  │ Check gatekeeperResponse.allowed
  │ If true: Rewrite URI + Forward
  │ If false: Return 401/403
  │
  ▼
MainModule Container
  │
  │ GET /api/products
  │ Headers: X-UserId, X-AccountId, X-Email, X-Role
  │
  │ ProductController.GetAll()
  │
  ▼
Response: { products: [...] }
```

---

## 3. Azure Resources

### 3.1. Resource Group
- **Name**: `rg-nguyentienthuan-0001`
- **Location**: `koreacentral`

### 3.2. Container Apps Environment
- **Name**: `env-swo-core`
- **Type**: Container Apps Environment (Linux)
- **Internal Ingress**: Enabled (services không expose ra internet)

### 3.3. Container Apps
| App Name | Image | Internal FQDN | Port |
|----------|-------|--------------|------|
| `api-service-1` | `dynamicrbac.azurecr.io/api-service-1` | `api-service-1.<unique>.koreacentral.azurecontainerapps.io` | 8080 |
| `api-service-2` | `dynamicrbac.azurecr.io/api-service-2` | `api-service-2.<unique>.koreacentral.azurecontainerapps.io` | 8080 |

### 3.4. Azure Database for PostgreSQL
- **Name**: `pg-tienthuan-db`
- **Type**: Flexible Server
- **Tier**: Standard_D2s_v3
- **Location**: `koreacentral`

### 3.5. Azure Container Registry
- **Name**: `dynamicrbac`
- **Login Server**: `dynamicrbac.azurecr.io`

### 3.6. Azure API Management
- **Name**: `apimthuanntdev`
- **SKU**: Developer
- **Location**: `koreacentral`

---

## 4. Environment Variables

### 4.1. AuthModule (api-service-1)

| Variable | Value | Description |
|----------|-------|-------------|
| `ConnectionStrings__DefaultConnection` | `Host=...;Port=5432;Database=postgres;...` | PostgreSQL connection string |
| `JWT_SECRET` | `xRsbQCknWZriINldt02Gjp3UaOOByM9Eoqanqz9fMT1` | JWT signing key (min 32 chars) |
| `JWT_ISSUER` | `swovnai` | JWT issuer claim |
| `JWT_AUDIENCE` | `swovnai` | JWT audience claim |
| `ASPNETCORE_ENVIRONMENT` | `Production` | Runtime environment |

### 4.2. MainModule (api-service-2)

| Variable | Value | Description |
|----------|-------|-------------|
| `ConnectionStrings__DefaultConnection` | `Host=...;Port=5432;Database=postgres;...` | PostgreSQL connection string |
| `ASPNETCORE_ENVIRONMENT` | `Production` | Runtime environment |

---

## 5. API Management Configuration

### 5.1. APIs

| API ID | Display Name | Path | Backend Service |
|--------|-------------|------|----------------|
| `api-service-1` | AuthModule | `/auth-api` | `https://api-service-1.<fqdn>` |
| `api-service-2` | MainModule | `/products-api` | `https://api-service-2.<fqdn>` |

### 5.2. Operations

Mỗi API có **catch-all operations** cho tất cả HTTP methods:
- `GET /{*path}`
- `POST /{*path}`
- `PUT /{*path}`
- `DELETE /{*path}`
- `PATCH /{*path}`
- `OPTIONS /{*path}`

### 5.3. AuthModule Policy

```xml
<policies>
  <inbound>
    <!-- CORS -->
    <cors allow-credentials="false">
      <allowed-origins><origin>*</origin></allowed-origins>
      <allowed-methods>
        <method>GET</method><method>POST</method><method>PUT</method>
        <method>DELETE</method><method>PATCH</method><method>OPTIONS</method>
      </allowed-methods>
      <allowed-headers><header>*</header></allowed-headers>
    </cors>

    <!-- Extract path parameter -->
    <set-variable name="requestPath" value="@((string)context.Request.MatchedParameters["path"])" />

    <!-- OPTIONS: Return 200 immediately -->
    <choose>
      <when condition="@(context.Request.Method == "OPTIONS")">
        <return-response><set-status code="200" /></return-response>
      </when>

      <!-- Public endpoint: /login -->
      <when condition="@(context.Variables["requestPath"].ToString().Equals("login", StringComparison.OrdinalIgnoreCase))">
        <rate-limit-by-key calls="100" renewal-period="60" counter-key="@(context.Request.IpAddress)" />
        <rewrite-uri template="/api/auth/{path}" />
      </when>

      <!-- Protected: Call Gatekeeper -->
      <otherwise>
        <rate-limit-by-key calls="100" renewal-period="60" counter-key="@(context.Request.IpAddress)" />
        <send-request mode="new" response-variable-name="gatekeeperResponse" timeout="20">
          <set-url>@("https://api-service-1/api/gatekeeper")</set-url>
          <set-method>POST</set-method>
          <set-body>@{ ... build GatekeeperRequest ... }</set-body>
        </send-request>
        <!-- Check response and forward/deny -->
        <choose>...</choose>
      </otherwise>
    </choose>
  </inbound>
</policies>
```

### 5.4. MainModule Policy

Tương tự AuthModule nhưng:
- Rewrite URI: `/api/{path}`
- Gọi Gatekeeper cho **tất cả** request (không bypass public)

---

## 6. Database Schema

### 6.1. Core Tables

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  accounts   │────│   user_permissions │────│   permissions   │
└─────────────┘     └──────────────────┘     └─────────────────┘
       │                                          ▲
       │                                          │
       │  ┌─────────────┐     ┌──────────────────┘
       │  │    users    │
       │  └─────────────┘
       │
       │  ┌─────────────┐     ┌──────────────────────┐
       └──│   tokens    │────│  token_permissions   │
          └─────────────┘     └──────────────────────┘
```

### 6.2. Permission System

- **AuthModule**: Owner của bảng `permissions`, chạy migrations
- **MainModule**: Consumer - chỉ đọc/ghi qua DbContext riêng với `ExcludeFromMigrations()`

### 6.3. Token Storage

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key |
| `token` | `varchar(4000)` | Raw JWT - UNIQUE |
| `token_type` | `varchar(50)` | Default 'Bearer' |
| `created_by` | `uuid` | FK to accounts (required) |
| `account_id` | `uuid` | FK to accounts (nullable) |
| `expires_at` | `timestamp` | Optional expiration |
| `is_revoked` | `boolean` | Default false |

---

## 7. Deployment Flow

### 7.1. Script Overview (`infrastructure/azure/deploy.sh`)

```
1. Load .env configuration
2. Login Azure + ACR
3. Build & push Docker images
   - api-service-1 (AuthModule)
   - api-service-2 (MainModule)
   - react-frontend
4. Create/Update Container Apps Environment
5. Deploy Container Apps
6. Configure APIM
   - Create/Update APIs
   - Create catch-all operations
   - Set policies (CORS, Rate Limit, Gatekeeper)
```

### 7.2. Key Flags

| Flag | Description |
|------|-------------|
| `IMAGE_TAG` | Custom image tag (optional, auto-generate if not set) |

```bash
# Deploy with auto-generated timestamp
./deploy.sh

# Deploy with specific tag
IMAGE_TAG=v1.2.3 ./deploy.sh
```

---

## 8. Security Considerations

### 8.1. Network Security
- Container Apps sử dụng **Internal Ingress** - chỉ APIM được gọi
- Database Firewall: Chỉ cho phép Azure services
- Không public endpoints cho backend services

### 8.2. Authentication Flow
1. Client gửi JWT trong `Authorization: Bearer <token>`
2. APIM gọi Gatekeeper để validate
3. Gatekeeper check:
   - Token exists in DB? → External Token (TokenPermission)
   - Token valid JWT? → Internal JWT (UserPermission)
4. APIM inject headers và forward request

### 8.3. Rate Limiting
- **100 requests/minute** per IP address
- Applied at APIM level trước khi gọi backend

---

## 9. Troubleshooting

### 9.1. Container không start
```bash
# Xem logs
az containerapp logs show --name api-service-1 --resource-group rg-nguyentienthuan-0001 --tail 100

# Restart
az containerapp restart --name api-service-1 --resource-group rg-nguyentienthuan-0001
```

### 9.2. Database connection fail
```bash
# Kiểm tra firewall rules
az postgres flexible-server firewall-rule list --resource-group rg-nguyentienthuan-0001 --server-name pg-tienthuan-db

# Test connection
docker run --rm postgres:16 psql "host=pg-tienthuan-db.postgres.database.azure.com port=5432 dbname=postgres user=pgtienthuandb password='xxx' sslmode=require" -c "SELECT 1"
```

### 9.3. APIM policy error
```bash
# Test Gatekeeper endpoint
curl -X POST "https://api-service-1.<fqdn>/api/gatekeeper" \
  -H "Content-Type: application/json" \
  -d '{"authorizationHeader":"Bearer <token>","method":"GET","path":"/api/products"}'
```

### 9.4. Common Error Codes

| Status | Meaning | Action |
|--------|---------|--------|
| 401 | Invalid/expired token | Re-login |
| 403 | No permission | Check UserPermission/TokenPermission |
| 503 | Gatekeeper unreachable | Check AuthModule logs |
