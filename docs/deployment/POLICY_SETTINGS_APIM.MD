# API Management (APIM) Configuration Guide

Tài liệu mô tả chi tiết cấu hình Azure API Management cho hệ thống Dynamic RBAC.

---

## 1. Tổng Quan

### 1.1. APIM Resource

| Property | Value |
|----------|-------|
| **Name** | `apimthuanntdev` |
| **SKU** | Developer |
| **Location** | `koreacentral` |
| **Subscription Required** | `false` (Tắt subscription key) |

### 1.2. APIs Configuration

| API ID | Display Name | Path | Backend Service URL |
|--------|-------------|------|---------------------|
| `api-service-1` | AuthModule | `/auth-api` | `https://api-service-1.<fqdn>` |
| `api-service-2` | MainModule | `/products-api` | `https://api-service-2.<fqdn>` |

### 1.3. Public URLs

```
AuthModule:  https://apimthuanntdev.azure-api.net/auth-api
MainModule:  https://apimthuanntdev.azure-api.net/products-api
```

---

## 2. APIs Configuration

### 2.1. AuthModule API

```bash
az apim api create \
  --resource-group "$RESOURCE_GROUP" \
  --service-name "$APIM_NAME" \
  --api-id "api-service-1" \
  --display-name "AuthModule" \
  --path "auth-api" \
  --service-url "https://${URL_API1}" \
  --protocols https \
  --subscription-required false
```

### 2.2. MainModule API

```bash
az apim api create \
  --resource-group "$RESOURCE_GROUP" \
  --service-name "$APIM_NAME" \
  --api-id "api-service-2" \
  --display-name "MainModule" \
  --path "products-api" \
  --service-url "https://${URL_API2}" \
  --protocols https \
  --subscription-required false
```

### 2.3. Catch-all Operations

APIM yêu cầu có operations để match request. Mỗi API có 6 operations (GET, POST, PUT, DELETE, PATCH, OPTIONS):

```bash
# AuthModule Operations
for method in GET POST PUT DELETE PATCH OPTIONS; do
  az apim api operation create \
    --resource-group "$RESOURCE_GROUP" \
    --service-name "$APIM_NAME" \
    --api-id "api-service-1" \
    --operation-id "auth-catchall-${method,,}" \
    --display-name "Catch All $method" \
    --method "$method" \
    --url-template "/{*path}" \
    --template-parameters name=path required=true type=string
done

# MainModule Operations
for method in GET POST PUT DELETE PATCH OPTIONS; do
  az apim api operation create \
    --resource-group "$RESOURCE_GROUP" \
    --service-name "$APIM_NAME" \
    --api-id "api-service-2" \
    --operation-id "main-catchall-${method,,}" \
    --display-name "Catch All $method" \
    --method "$method" \
    --url-template "/{*path}" \
    --template-parameters name=path required=true type=string
done
```

### 2.4. Named Values

| Name | Value | Secret |
|------|-------|--------|
| `JWT_SECRET` | Base64 encoded JWT secret | Yes |

---

## 3. Policy Architecture

### 3.1. Request Flow

```
Client Request
     │
     ▼
┌─────────────────────────────┐
│         APIM                │
│                             │
│  1. CORS Policy             │
│  2. Extract Path Parameter   │
│  3. OPTIONS → 200 (skip)    │
│  4. AuthModule: /login bypass│
│     MainModule: all → GK    │
│  5. Rate Limit (100/min)    │
│  6. Call Gatekeeper         │
│  7. Check Response          │
│  8. Inject X-APIM-* Headers │
│  9. Rewrite URI             │
└─────────────┬───────────────┘
              │
              ▼
      Backend Service
```

### 3.2. Policy Processing Order

```
<inbound>
  1. <cors />                    - CORS headers
  2. <set-variable />            - Extract requestPath, requestQuery
  3. <choose>                    - Route decision
     ├── OPTIONS → 200          - Preflight response
     ├── login → Rewrite        - AuthModule public endpoint
     └── otherwise → Gatekeeper - Protected endpoints
  4. <rate-limit-by-key />      - Rate limiting
  5. <send-request />           - Call Gatekeeper
  6. <set-variable />           - Parse Gatekeeper response
  7. <choose>                   - Deny if not allowed
  8. <set-header />             - Inject identity headers
  9. <rewrite-uri />            - Forward to backend
</inbound>
```

---

## 4. AuthModule Policy

### 4.1. Full Policy XML

```xml
<policies>
  <inbound>
    <base />
    <cors allow-credentials="false">
      <allowed-origins>
        <origin>*</origin>
      </allowed-origins>
      <allowed-methods>
        <method>GET</method>
        <method>POST</method>
        <method>PUT</method>
        <method>DELETE</method>
        <method>PATCH</method>
        <method>OPTIONS</method>
      </allowed-methods>
      <allowed-headers>
        <header>*</header>
      </allowed-headers>
      <expose-headers>
        <header>*</header>
      </expose-headers>
    </cors>

    <!-- Extract path parameter from catch-all operation -->
    <set-variable name="requestPath" value="@((string)context.Request.MatchedParameters["path"])" />
    <set-variable name="requestQuery" value="@(((string)context.Request.Url.QueryString).TrimStart('?'))" />

    <choose>
      <!-- OPTIONS: Return 200 immediately (CORS preflight) -->
      <when condition="@(context.Request.Method == "OPTIONS")">
        <return-response>
          <set-status code="200" reason="OK" />
        </return-response>
      </when>

      <!-- Public endpoint: /login -->
      <!-- Bypass Gatekeeper, go directly to backend -->
      <when condition="@(((string)context.Variables["requestPath"]).Equals("login", StringComparison.OrdinalIgnoreCase))">
        <rate-limit-by-key calls="100" renewal-period="60" counter-key="@(context.Request.IpAddress)" />
        <rewrite-uri template="/api/auth/{path}" />
      </when>

      <!-- Protected endpoints: Call Gatekeeper -->
      <otherwise>
        <rate-limit-by-key calls="100" renewal-period="60" counter-key="@(context.Request.IpAddress)" />

        <!-- Call Gatekeeper -->
        <send-request mode="new" response-variable-name="gatekeeperResponse" timeout="20" ignore-error="true">
          <set-url>@("https://api-service-1/api/gatekeeper")</set-url>
          <set-method>POST</set-method>
          <set-header name="Content-Type" exists-action="override">
            <value>application/json</value>
          </set-header>
          <set-body>@{
              var authHeader = context.Request.Headers.GetValueOrDefault("Authorization", "");
              var path = (string)context.Variables["requestPath"];
              var query = (string)context.Variables["requestQuery"];
              return Newtonsoft.Json.JsonConvert.SerializeObject(new {
                  authorizationHeader = authHeader,
                  method = context.Request.Method,
                  path = "/api/" + path,
                  query = query
              });
          }</set-body>
        </send-request>

        <!-- Error handling: Gatekeeper unreachable -->
        <choose>
          <when condition="@(context.Variables.ContainsKey("gatekeeperResponse") == false || context.Variables["gatekeeperResponse"] == null)">
            <return-response>
              <set-status code="503" reason="Service Unavailable" />
              <set-header name="Content-Type" exists-action="override">
                <value>application/json</value>
              </set-header>
              <set-body>{"error":"Authentication service unavailable"}</set-body>
            </return-response>
          </when>
        </choose>

        <!-- Extract Gatekeeper response -->
        <set-variable name="gatekeeperStatusCode" value="@((int)((IResponse)context.Variables["gatekeeperResponse"]).StatusCode)" />
        <set-variable name="gatekeeperBody" value="@{
            var response = (IResponse)context.Variables["gatekeeperResponse"];
            var body = response.Body.As<string>(preserveContent: true);
            return body ?? string.Empty;
        }" />

        <!-- Error handling: 5xx errors -->
        <choose>
          <when condition="@(((int)context.Variables["gatekeeperStatusCode"]) >= 500)">
            <return-response>
              <set-status code="503" reason="Service Unavailable" />
              <set-header name="Content-Type" exists-action="override">
                <value>application/json</value>
              </set-header>
              <set-body>{"error":"Authentication service unavailable"}</set-body>
            </return-response>
          </when>
          <when condition="@(string.IsNullOrWhiteSpace((string)context.Variables["gatekeeperBody"]))">
            <return-response>
              <set-status code="503" reason="Service Unavailable" />
              <set-header name="Content-Type" exists-action="override">
                <value>application/json</value>
              </set-header>
              <set-body>{"error":"Empty response from authentication service"}</set-body>
            </return-response>
          </when>
        </choose>

        <!-- Parse JSON response -->
        <set-variable name="gatekeeperJson" value="@{
            var body = (string)context.Variables["gatekeeperBody"];
            try {
                return Newtonsoft.Json.Linq.JObject.Parse(body);
            } catch {
                return new Newtonsoft.Json.Linq.JObject(
                    new Newtonsoft.Json.Linq.JProperty("allowed", false),
                    new Newtonsoft.Json.Linq.JProperty("statusCode", 503),
                    new Newtonsoft.Json.Linq.JProperty("reason", "Invalid response from authentication service")
                );
            }
        }" />

        <!-- Check permission: Deny if not allowed -->
        <choose>
          <when condition="@{
              var json = (Newtonsoft.Json.Linq.JObject)context.Variables["gatekeeperJson"];
              var token = json["allowed"];
              return token == null || !string.Equals(token.ToString(), "true", StringComparison.OrdinalIgnoreCase);
          }">
            <return-response>
              <set-status code="@{
                  var json = (Newtonsoft.Json.Linq.JObject)context.Variables["gatekeeperJson"];
                  var token = json["statusCode"];
                  int parsed;
                  return token != null && int.TryParse(token.ToString(), out parsed) ? parsed : 403;
              }" reason="Forbidden" />
              <set-header name="Content-Type" exists-action="override">
                <value>application/json</value>
              </set-header>
              <set-body>@{
                  var json = (Newtonsoft.Json.Linq.JObject)context.Variables["gatekeeperJson"];
                  var reasonToken = json["reason"];
                  var reason = reasonToken == null ? "Access denied" : reasonToken.ToString();
                  return Newtonsoft.Json.JsonConvert.SerializeObject(new { error = reason });
              }</set-body>
            </return-response>
          </when>
        </choose>

        <!-- Inject identity headers for downstream services -->
        <set-header name="X-APIM-UserId" exists-action="override">
          <value>@{
              var json = (Newtonsoft.Json.Linq.JObject)context.Variables["gatekeeperJson"];
              var token = json["userId"];
              return token == null ? string.Empty : token.ToString();
          }</value>
        </set-header>
        <set-header name="X-APIM-AccountId" exists-action="override">
          <value>@{
              var json = (Newtonsoft.Json.Linq.JObject)context.Variables["gatekeeperJson"];
              var token = json["accountId"];
              return token == null ? string.Empty : token.ToString();
          }</value>
        </set-header>
        <set-header name="X-APIM-Email" exists-action="override">
          <value>@{
              var json = (Newtonsoft.Json.Linq.JObject)context.Variables["gatekeeperJson"];
              var token = json["email"];
              return token == null ? string.Empty : token.ToString();
          }</value>
        </set-header>
        <set-header name="X-APIM-Role" exists-action="override">
          <value>@{
              var json = (Newtonsoft.Json.Linq.JObject)context.Variables["gatekeeperJson"];
              var token = json["role"];
              return token == null ? string.Empty : token.ToString();
          }</value>
        </set-header>

        <!-- Rewrite URI: /login → /api/auth/login -->
        <rewrite-uri template="/api/{path}" />
      </otherwise>
    </choose>
  </inbound>
  <backend>
    <base />
  </backend>
  <outbound>
    <base />
  </outbound>
  <on-error>
    <base />
  </on-error>
</policies>
```

### 4.2. Routing Logic

| Condition | Action |
|-----------|--------|
| `OPTIONS` | Return 200 (CORS preflight) |
| `/login` (case-insensitive) | Bypass Gatekeeper, Rate Limit, Rewrite `/api/auth/{path}` |
| All other paths | Gatekeeper → Check Permission → Forward |

### 4.3. Backend URL Mapping

| Public Path | Backend Path |
|-------------|--------------|
| `/auth-api/login` | `/api/auth/login` |
| `/auth-api/users` | `/api/auth/users` |
| `/auth-api/permissions` | `/api/auth/permissions` |

---

## 5. MainModule Policy

### 5.1. Full Policy XML

```xml
<policies>
  <inbound>
    <base />
    <cors allow-credentials="false">
      <allowed-origins>
        <origin>*</origin>
      </allowed-origins>
      <allowed-methods>
        <method>GET</method>
        <method>POST</method>
        <method>PUT</method>
        <method>DELETE</method>
        <method>PATCH</method>
        <method>OPTIONS</method>
      </allowed-methods>
      <allowed-headers>
        <header>*</header>
      </allowed-headers>
      <expose-headers>
        <header>*</header>
      </expose-headers>
    </cors>

    <set-variable name="requestPath" value="@((string)context.Request.MatchedParameters["path"])" />
    <set-variable name="requestQuery" value="@(((string)context.Request.Url.QueryString).TrimStart('?'))" />

    <choose>
      <!-- OPTIONS: Return 200 immediately -->
      <when condition="@(context.Request.Method == "OPTIONS")">
        <return-response>
          <set-status code="200" reason="OK" />
        </return-response>
      </when>

      <!-- Protected endpoints: Call Gatekeeper -->
      <!-- NOTE: No bypass for products - all requests go through Gatekeeper -->
      <otherwise>
        <rate-limit-by-key calls="100" renewal-period="60" counter-key="@(context.Request.IpAddress)" />

        <!-- Call Gatekeeper -->
        <send-request mode="new" response-variable-name="gatekeeperResponse" timeout="20" ignore-error="true">
          <set-url>@("https://api-service-1/api/gatekeeper")</set-url>
          <set-method>POST</set-method>
          <set-header name="Content-Type" exists-action="override">
            <value>application/json</value>
          </set-header>
          <set-body>@{
              var authHeader = context.Request.Headers.GetValueOrDefault("Authorization", "");
              var path = (string)context.Variables["requestPath"];
              var query = (string)context.Variables["requestQuery"];
              return Newtonsoft.Json.JsonConvert.SerializeObject(new {
                  authorizationHeader = authHeader,
                  method = context.Request.Method,
                  path = "/api/" + path,
                  query = query
              });
          }</set-body>
        </send-request>

        <!-- Error handling: Gatekeeper unreachable -->
        <choose>
          <when condition="@(context.Variables.ContainsKey("gatekeeperResponse") == false || context.Variables["gatekeeperResponse"] == null)">
            <return-response>
              <set-status code="503" reason="Service Unavailable" />
              <set-header name="Content-Type" exists-action="override">
                <value>application/json</value>
              </set-header>
              <set-body>{"error":"Authentication service unavailable"}</set-body>
            </return-response>
          </when>
        </choose>

        <!-- Extract Gatekeeper response -->
        <set-variable name="gatekeeperStatusCode" value="@((int)((IResponse)context.Variables["gatekeeperResponse"]).StatusCode)" />
        <set-variable name="gatekeeperBody" value="@{
            var response = (IResponse)context.Variables["gatekeeperResponse"];
            var body = response.Body.As<string>(preserveContent: true);
            return body ?? string.Empty;
        }" />

        <!-- Error handling: 5xx errors -->
        <choose>
          <when condition="@(((int)context.Variables["gatekeeperStatusCode"]) >= 500)">
            <return-response>
              <set-status code="503" reason="Service Unavailable" />
              <set-header name="Content-Type" exists-action="override">
                <value>application/json</value>
              </set-header>
              <set-body>{"error":"Authentication service unavailable"}</set-body>
            </return-response>
          </when>
          <when condition="@(string.IsNullOrWhiteSpace((string)context.Variables["gatekeeperBody"]))">
            <return-response>
              <set-status code="503" reason="Service Unavailable" />
              <set-header name="Content-Type" exists-action="override">
                <value>application/json</value>
              </set-header>
              <set-body>{"error":"Empty response from authentication service"}</set-body>
            </return-response>
          </when>
        </choose>

        <!-- Parse JSON response -->
        <set-variable name="gatekeeperJson" value="@{
            var body = (string)context.Variables["gatekeeperBody"];
            try {
                return Newtonsoft.Json.Linq.JObject.Parse(body);
            } catch {
                return new Newtonsoft.Json.Linq.JObject(
                    new Newtonsoft.Json.Linq.JProperty("allowed", false),
                    new Newtonsoft.Json.Linq.JProperty("statusCode", 503),
                    new Newtonsoft.Json.Linq.JProperty("reason", "Invalid response from authentication service")
                );
            }
        }" />

        <!-- Check permission: Deny if not allowed -->
        <choose>
          <when condition="@{
              var json = (Newtonsoft.Json.Linq.JObject)context.Variables["gatekeeperJson"];
              var token = json["allowed"];
              return token == null || !string.Equals(token.ToString(), "true", StringComparison.OrdinalIgnoreCase);
          }">
            <return-response>
              <set-status code="@{
                  var json = (Newtonsoft.Json.Linq.JObject)context.Variables["gatekeeperJson"];
                  var token = json["statusCode"];
                  int parsed;
                  return token != null && int.TryParse(token.ToString(), out parsed) ? parsed : 403;
              }" reason="Forbidden" />
              <set-header name="Content-Type" exists-action="override">
                <value>application/json</value>
              </set-header>
              <set-body>@{
                  var json = (Newtonsoft.Json.Linq.JObject)context.Variables["gatekeeperJson"];
                  var reasonToken = json["reason"];
                  var reason = reasonToken == null ? "Access denied" : reasonToken.ToString();
                  return Newtonsoft.Json.JsonConvert.SerializeObject(new { error = reason });
              }</set-body>
            </return-response>
          </when>
        </choose>

        <!-- Inject identity headers -->
        <set-header name="X-APIM-UserId" exists-action="override">
          <value>@{
              var json = (Newtonsoft.Json.Linq.JObject)context.Variables["gatekeeperJson"];
              var token = json["userId"];
              return token == null ? string.Empty : token.ToString();
          }</value>
        </set-header>
        <set-header name="X-APIM-AccountId" exists-action="override">
          <value>@{
              var json = (Newtonsoft.Json.Linq.JObject)context.Variables["gatekeeperJson"];
              var token = json["accountId"];
              return token == null ? string.Empty : token.ToString();
          }</value>
        </set-header>
        <set-header name="X-APIM-Email" exists-action="override">
          <value>@{
              var json = (Newtonsoft.Json.Linq.JObject)context.Variables["gatekeeperJson"];
              var token = json["email"];
              return token == null ? string.Empty : token.ToString();
          }</value>
        </set-header>
        <set-header name="X-APIM-Role" exists-action="override">
          <value>@{
              var json = (Newtonsoft.Json.Linq.JObject)context.Variables["gatekeeperJson"];
              var token = json["role"];
              return token == null ? string.Empty : token.ToString();
          }</value>
        </set-header>

        <!-- Rewrite URI: /products → /api/products -->
        <rewrite-uri template="/api/{path}" />
      </otherwise>
    </choose>
  </inbound>
  <backend>
    <base />
  </backend>
  <outbound>
    <base />
  </outbound>
  <on-error>
    <base />
  </on-error>
</policies>
```

### 5.2. Routing Logic

| Condition | Action |
|-----------|--------|
| `OPTIONS` | Return 200 (CORS preflight) |
| All other paths | Gatekeeper → Check Permission → Forward |

> **Lưu ý**: MainModule **KHÔNG** có bypass cho bất kỳ endpoint nào. Tất cả request đều qua Gatekeeper check permission.

### 5.3. Backend URL Mapping

| Public Path | Backend Path |
|-------------|--------------|
| `/products-api/products` | `/api/products` |
| `/products-api/orders` | `/api/orders` |

---

## 6. Gatekeeper Request/Response

### 6.1. Gatekeeper Request Format

```json
{
  "authorizationHeader": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "method": "GET",
  "path": "/api/products",
  "query": "page=1&limit=10"
}
```

### 6.2. Gatekeeper Response Format

```json
// Success (allowed)
{
  "allowed": true,
  "statusCode": 200,
  "userId": "a1b2c3d4-...",
  "accountId": "e5f6g7h8-...",
  "email": "user@example.com",
  "role": "User"
}

// Denied (forbidden)
{
  "allowed": false,
  "statusCode": 403,
  "reason": "Access denied: no permission for GET /api/products"
}
```

### 6.3. Injected Headers (on success)

| Header | Value |
|--------|-------|
| `X-APIM-UserId` | `userId` from Gatekeeper response |
| `X-APIM-AccountId` | `accountId` from Gatekeeper response |
| `X-APIM-Email` | `email` from Gatekeeper response |
| `X-APIM-Role` | `role` from Gatekeeper response |

---

## 7. Rate Limiting

### 7.1. Configuration

| Setting | Value |
|---------|-------|
| Calls | 100 |
| Renewal Period | 60 seconds |
| Counter Key | IP Address |

### 7.2. Applied To

- AuthModule: All endpoints **except** OPTIONS
- MainModule: All endpoints **except** OPTIONS

---

## 8. CORS Configuration

### 8.1. Settings

| Setting | Value |
|---------|-------|
| `allow-credentials` | `false` |
| `allowed-origins` | `*` (All origins) |
| `allowed-methods` | GET, POST, PUT, DELETE, PATCH, OPTIONS |
| `allowed-headers` | `*` (All headers) |
| `expose-headers` | `*` (All headers) |

### 8.2. CORS Flow

```
Browser Preflight Request
  │
  │ OPTIONS /auth-api/products
  │ Origin: https://example.com
  │ Access-Control-Request-Method: GET
  │
  ▼
APIM Policy
  │
  │ Match: OPTIONS
  │ Return: 200 + CORS headers
  │
  ▼
Response Headers
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET,POST,PUT,DELETE,PATCH,OPTIONS
  Access-Control-Allow-Headers: *
  Access-Control-Expose-Headers: *
```

---

## 9. Troubleshooting

### 9.1. Common Issues

#### Issue: 404 on API calls

**Nguyên nhân**: Operations chưa được tạo hoặc bị xóa.

**Fix**:
```bash
# Kiểm tra operations hiện tại
az apim api operation list \
  --resource-group rg-nguyentienthuan-0001 \
  --service-name apimthuanntdev \
  --api-id api-service-1

# Tái tạo operations
# (Chạy lại deploy.sh sẽ tự động tạo)
```

#### Issue: 401/403 on protected endpoints

**Nguyên nhân**: Token không hợp lệ hoặc user không có permission.

**Fix**:
1. Kiểm tra token còn hạn
2. Kiểm tra user có permission trong database

```bash
# Test trực tiếp Gatekeeper
curl -X POST "https://api-service-1.<fqdn>/api/gatekeeper" \
  -H "Content-Type: application/json" \
  -d '{
    "authorizationHeader": "Bearer <token>",
    "method": "GET",
    "path": "/api/products"
  }'
```

#### Issue: 503 Service Unavailable

**Nguyên nhân**: Gatekeeper (AuthModule) không phản hồi.

**Fix**:
```bash
# Kiểm tra AuthModule logs
az containerapp logs show \
  --name api-service-1 \
  --resource-group rg-nguyentienthuan-0001 \
  --tail 100
```

### 9.2. Debug Commands

```bash
# Xem current policy
az rest --method get \
  --url "https://management.azure.com/subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.ApiManagement/service/apimthuanntdev/apis/api-service-1/policies/policy?api-version=2023-03-01-preview&format=xml"

# Update policy manually
az rest --method put \
  --url "https://management.azure.com/subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.ApiManagement/service/apimthuanntdev/apis/api-service-1/policies/policy?api-version=2023-03-01-preview&format=xml" \
  --body '{"properties": {"format": "xml", "value": "<policies>...</policies>"}}'

# Test API từ APIM
curl -v "https://apimthuanntdev.azure-api.net/auth-api/login" \
  -H "Content-Type: application/json"
```

---

## 10. Security Notes

### 10.1. Subscription Key Disabled

Subscription key đã bị tắt (`--subscription-required false`) để:
- Client có thể gọi API mà không cần subscription key
- Authentication hoàn toàn qua JWT + Gatekeeper

### 10.2. CORS Wildcard

Đang dùng `*` cho allowed-origins. Trong production, nên giới hạn:

```xml
<allowed-origins>
  <origin>https://your-frontend.azurewebsites.net</origin>
  <origin>https://your-frontend.com</origin>
</allowed-origins>
```

### 10.3. Rate Limiting

Rate limit 100 requests/min/IP là baseline. Tùy theo nhu cầu có thể:
- Tăng cho authenticated users
- Giảm cho anonymous endpoints
