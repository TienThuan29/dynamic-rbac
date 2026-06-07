#!/bin/bash
# =============================================================================
# Auto-deploy script: AuthModule + MainModule + Frontend -> Azure Container Apps
# Gateway: Azure API Management (apimthuanntdev)
# =============================================================================

set -euo pipefail

# Resolve project root (script is in infrastructure/azure/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Load environment variables from .env file
if [ -f "${SCRIPT_DIR}/.env" ]; then
  set -a
  source "${SCRIPT_DIR}/.env"
  set +a
fi

# ── 1. Cấu hình hệ thống ───────────────────────────────────────────────────

# Validate required variables
: "${RESOURCE_GROUP:?Please set RESOURCE_GROUP in .env}"
: "${LOCATION:?Please set LOCATION in .env}"
: "${ACR_NAME:?Please set ACR_NAME in .env}"
: "${ENV_NAME:?Please set ENV_NAME in .env}"
: "${APIM_NAME:?Please set APIM_NAME in .env}"
: "${DB_HOST:?Please set DB_HOST in .env}"
: "${DB_USER:?Please set DB_USER in .env}"
: "${DB_NAME:?Please set DB_NAME in .env}"
: "${DB_PASSWORD:?Please set DB_PASSWORD in .env}"
: "${DB_PORT:?Please set DB_PORT in .env}"

if [ -n "${IMAGE_TAG:-}" ]; then
  IMAGE_TAG_SOURCE="user-supplied"
else
  IMAGE_TAG="$(date -u +%Y%m%d-%H%M%S)"
  IMAGE_TAG_SOURCE="auto-generated (UTC timestamp)"
fi

DB_CONNECTION_STRING="Host=${DB_HOST};Port=${DB_PORT};Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASSWORD};Ssl Mode=Require"

# JWT config (AuthModule cần)
JWT_SECRET="${JWT_SECRET:-xRsbQCknWZriINldt02Gjp3UaOOByM9Eoqanqz9fMT1}"
JWT_SECRET_B64="$(echo -n "$JWT_SECRET" | base64)"
JWT_ISSUER="${JWT_ISSUER:-swovnai}"
JWT_AUDIENCE="${JWT_AUDIENCE:-swovnai}"

# Frontend API URL
APIM_GATEWAY_URL="https://${APIM_NAME}.azure-api.net"
FE_AUTH_API="${FE_AUTH_API:-https://${APIM_NAME}.azure-api.net/auth-api}"
FE_MAIN_API="${FE_MAIN_API:-https://${APIM_NAME}.azure-api.net/products-api}"

echo "=========================================================="
echo "  DEPLOY: AuthModule + MainModule + Frontend -> Azure"
echo "  Image tag : ${IMAGE_TAG}"
echo "  Tag source: ${IMAGE_TAG_SOURCE}"
echo "  ACR       : ${ACR_NAME}"
echo "  RG        : ${RESOURCE_GROUP}"
echo "  Location  : ${LOCATION}"
echo "  APIM      : ${APIM_NAME}"
echo "=========================================================="

# ── 2. Login & lấy credentials ──────────────────────────────────────────────

echo ""
echo "[1/6] Đăng nhập Azure..."
az account show > /dev/null 2>&1 || az login

echo "[2/6] Lấy credentials từ ACR..."
ACR_PASSWORD=$(az acr credential show \
  --name "$ACR_NAME" \
  --query "passwords[0].value" \
  -o tsv)
ACR_USERNAME="$ACR_NAME"
SUB_ID=$(az account show --query 'id' -o tsv)

# Login vào ACR trước khi push
echo "    --> Login vào ACR: ${ACR_NAME}"
echo "$ACR_PASSWORD" | docker login "${ACR_NAME}.azurecr.io" -u "$ACR_USERNAME" --password-stdin

# ── 3. Build và push Docker images ──────────────────────────────────────────

echo ""
echo "[3/6] Build và push Docker images lên ACR..."

echo "    --> api-service-1 (AuthModule)"
docker build -t "${ACR_NAME}.azurecr.io/api-service-1:${IMAGE_TAG}" \
  "${PROJECT_ROOT}/be/AuthModule"
docker push "${ACR_NAME}.azurecr.io/api-service-1:${IMAGE_TAG}"

echo "    --> api-service-2 (MainModule)"
docker build -t "${ACR_NAME}.azurecr.io/api-service-2:${IMAGE_TAG}" \
  "${PROJECT_ROOT}/be/MainModule"
docker push "${ACR_NAME}.azurecr.io/api-service-2:${IMAGE_TAG}"

echo "    --> react-frontend"
docker build \
  --build-arg "VITE_MAIN_API_BASE_URL=${FE_MAIN_API}" \
  --build-arg "VITE_AUTH_API_BASE_URL=${FE_AUTH_API}" \
  -t "${ACR_NAME}.azurecr.io/react-frontend:${IMAGE_TAG}" \
  "${PROJECT_ROOT}/fe"
docker push "${ACR_NAME}.azurecr.io/react-frontend:${IMAGE_TAG}"

# ── 4. Tạo Container Apps Environment ──────────────────────────────────────

echo ""
echo "[4/6] Đang kiểm tra/tạo Container Apps Environment (Có thể mất 2-3 phút)..."

ENV_EXISTS=$(az containerapp env show --name "$ENV_NAME" --resource-group "$RESOURCE_GROUP" --query "name" -o tsv 2>/dev/null || echo "NOT_FOUND")

if [ "$ENV_EXISTS" == "NOT_FOUND" ]; then
    echo "    --> Environment chưa tồn tại. Đang tiến hành tạo mới..."

    # Tạo Log Analytics workspace trước (bắt buộc, Azure CLI cache có thể không nhận diện provider kịp)
    LA_NAME="logapp-${ENV_NAME}"
    echo "    --> Tạo Log Analytics workspace: $LA_NAME..."
    az monitor log-analytics workspace create \
      --workspace-name "$LA_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --location "$LOCATION" \
      2>/dev/null || echo "    --> Workspace có thể đã tồn tại, bỏ qua."

    # Lấy shared key để liên kết
    LA_WORKSPACE_ID=$(az monitor log-analytics workspace show \
      --workspace-name "$LA_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --query "customerId" -o tsv)

    echo "    --> Tạo Container Apps Environment với Log Analytics..."
    az containerapp env create \
      --name "$ENV_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --location "$LOCATION" \
      --logs-workspace-id "$LA_WORKSPACE_ID"
    echo "    --> Tạo Environment thành công!"
else
    echo "    --> Environment '$ENV_NAME' đã tồn tại. Bỏ qua bước tạo."
fi

# ── 5. Deploy Backend APIs (internal ingress) ────────────────────────────────

echo ""
echo "[5/6] Triển khai Backend APIs (internal ingress)..."

# --- AuthModule (api-service-1) ---
echo "    --> api-service-1 (AuthModule)..."
if az containerapp show --name "api-service-1" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  az containerapp update \
    --name "api-service-1" \
    --resource-group "$RESOURCE_GROUP" \
    --image "${ACR_NAME}.azurecr.io/api-service-1:${IMAGE_TAG}" \
    --replace-env-vars "ConnectionStrings__DefaultConnection=Host=${DB_HOST};Port=${DB_PORT};Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASSWORD};Ssl Mode=Require" "JWT_SECRET=${JWT_SECRET}" "JWT_ISSUER=${JWT_ISSUER}" "JWT_AUDIENCE=${JWT_AUDIENCE}" "ASPNETCORE_ENVIRONMENT=Production" "ASPNETCORE_URLS=http://+:8080"
else
  az containerapp create \
    --name "api-service-1" \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ENV_NAME" \
    --image "${ACR_NAME}.azurecr.io/api-service-1:${IMAGE_TAG}" \
    --registry-server "${ACR_NAME}.azurecr.io" \
    --registry-username "$ACR_USERNAME" \
    --registry-password "$ACR_PASSWORD" \
    --target-port 8080 \
    --ingress internal \
    --env-vars "ConnectionStrings__DefaultConnection=Host=${DB_HOST};Port=${DB_PORT};Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASSWORD};Ssl Mode=Require" "JWT_SECRET=${JWT_SECRET}" "JWT_ISSUER=${JWT_ISSUER}" "JWT_AUDIENCE=${JWT_AUDIENCE}" "ASPNETCORE_ENVIRONMENT=Production" "ASPNETCORE_URLS=http://+:8080"
fi

URL_API1=$(az containerapp show \
  --name "api-service-1" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" \
  -o tsv)

# --- MainModule (api-service-2) ---
echo "    --> api-service-2 (MainModule)..."
if az containerapp show --name "api-service-2" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  az containerapp update \
    --name "api-service-2" \
    --resource-group "$RESOURCE_GROUP" \
    --image "${ACR_NAME}.azurecr.io/api-service-2:${IMAGE_TAG}" \
    --replace-env-vars "ConnectionStrings__DefaultConnection=Host=${DB_HOST};Port=${DB_PORT};Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASSWORD};Ssl Mode=Require" "ASPNETCORE_ENVIRONMENT=Production" "ASPNETCORE_URLS=http://+:8080"
else
  az containerapp create \
    --name "api-service-2" \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ENV_NAME" \
    --image "${ACR_NAME}.azurecr.io/api-service-2:${IMAGE_TAG}" \
    --registry-server "${ACR_NAME}.azurecr.io" \
    --registry-username "$ACR_USERNAME" \
    --registry-password "$ACR_PASSWORD" \
    --target-port 8080 \
    --ingress internal \
    --env-vars "ConnectionStrings__DefaultConnection=Host=${DB_HOST};Port=${DB_PORT};Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASSWORD};Ssl Mode=Require" "ASPNETCORE_ENVIRONMENT=Production" "ASPNETCORE_URLS=http://+:8080"
fi

URL_API2=$(az containerapp show \
  --name "api-service-2" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" \
  -o tsv)

echo "    AuthModule FQDN : https://${URL_API1}"
echo "    MainModule FQDN: https://${URL_API2}"

# ── 6. Cấu hình API Management ──────────────────────────────────────────────

echo ""
echo "[6/6] Cấu hình API Management (Tắt Subscription Key)..."

# Lưu ý: serviceUrl PHẢI là host-only (không có path) vì rewrite-uri sẽ thêm path
# Path trên URL công khai: /auth-api -> backend nhận /api/auth/...
#                      /products-api -> backend nhận /api/products/...
echo "    --> Tạo/Cập nhật API: api-service-1 (AuthModule) trên APIM..."
az apim api create \
  --resource-group "$RESOURCE_GROUP" \
  --service-name "$APIM_NAME" \
  --api-id "api-service-1" \
  --display-name "AuthModule" \
  --path "auth-api" \
  --service-url "https://${URL_API1}" \
  --protocols https \
  --subscription-required false \
  2>/dev/null || az apim api update \
  --resource-group "$RESOURCE_GROUP" \
  --service-name "$APIM_NAME" \
  --api-id "api-service-1" \
  --path "auth-api" \
  --service-url "https://${URL_API1}" \
  --subscription-required false

echo "    --> Tạo/Cập nhật API: api-service-2 (MainModule) trên APIM..."
az apim api create \
  --resource-group "$RESOURCE_GROUP" \
  --service-name "$APIM_NAME" \
  --api-id "api-service-2" \
  --display-name "MainModule" \
  --path "products-api" \
  --service-url "https://${URL_API2}" \
  --protocols https \
  --subscription-required false \
  2>/dev/null || az apim api update \
  --resource-group "$RESOURCE_GROUP" \
  --service-name "$APIM_NAME" \
  --api-id "api-service-2" \
  --path "products-api" \
  --service-url "https://${URL_API2}" \
  --subscription-required false

# Xóa TẤT CẢ operations cũ (nếu có) để tránh conflict routing
# NOTE: Nếu không xóa được, script sẽ báo lỗi thay vì tiếp tục âm thầm
echo "    --> Xóa operations cũ của api-service-1..."
OP_IDS=$(az apim api operation list \
  --resource-group "$RESOURCE_GROUP" \
  --service-name "$APIM_NAME" \
  --api-id "api-service-1" \
  -o tsv --query "[].name" 2>/dev/null)
if [ -n "$OP_IDS" ]; then
  for OP_NAME in $OP_IDS; do
    echo "      Xóa operation: $OP_NAME"
    az rest --method delete \
      --url "https://management.azure.com/subscriptions/${SUB_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.ApiManagement/service/${APIM_NAME}/apis/api-service-1/operations/${OP_NAME}?api-version=2023-03-01-preview"
  done
else
  echo "      (Không có operation cũ)"
fi

echo "    --> Xóa operations cũ của api-service-2..."
OP_IDS=$(az apim api operation list \
  --resource-group "$RESOURCE_GROUP" \
  --service-name "$APIM_NAME" \
  --api-id "api-service-2" \
  -o tsv --query "[].name" 2>/dev/null)
if [ -n "$OP_IDS" ]; then
  for OP_NAME in $OP_IDS; do
    echo "      Xóa operation: $OP_NAME"
    az rest --method delete \
      --url "https://management.azure.com/subscriptions/${SUB_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.ApiManagement/service/${APIM_NAME}/apis/api-service-2/operations/${OP_NAME}?api-version=2023-03-01-preview"
  done
else
  echo "      (Không có operation cũ)"
fi

# Tạo Catch-all Operations cho AuthModule
# APIM vẫn cần operation match phần path còn lại sau API path
# Nếu không có operation, request /auth-api/login sẽ 404 ngay tại APIM
echo "    --> Tạo Catch-all Operations cho AuthModule..."
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

# Tạo Catch-all Operations cho MainModule
echo "    --> Tạo Catch-all Operations cho MainModule..."
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

echo "    --> Routing dùng catch-all operations + rewrite-uri ở API-level..."

# Tạo Named Value cho JWT_SECRET trong APIM (base64 encoded cho validate-jwt key)
echo "    --> Tạo Named Value: JWT_SECRET..."
az apim nv create \
  --resource-group "$RESOURCE_GROUP" \
  --service-name "$APIM_NAME" \
  --named-value-id "JWT_SECRET" \
  --display-name "JWT_SECRET" \
  --value "$JWT_SECRET_B64" \
  --secret true \
  2>/dev/null || az apim nv update \
  --resource-group "$RESOURCE_GROUP" \
  --service-name "$APIM_NAME" \
  --named-value-id "JWT_SECRET" \
  --value "$JWT_SECRET_B64" \
  --secret true \
  2>/dev/null || echo "    (JWT_SECRET named value thất bại)"

# ── 7. Cấu hình APIM policy: Validate JWT + CORS + Return 200 for OPTIONS ─────

echo ""
echo "[7/7] Cấu hình APIM policy (Giải quyết triệt để CORS)..."

# AuthModule policy
# NOTE: Dùng HEREDOC KHÔNG có nháy đơn để expand ${URL_API1} trong policy
# C# expressions dùng @(...) không bị expand vì không có $ ở đầu.
AUTH_POLICY=$(cat <<POLICY_EOF
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
    <set-variable name="requestPath" value="@((string)context.Request.MatchedParameters[&quot;path&quot;])" />
    <set-variable name="requestQuery" value="@(((string)context.Request.Url.QueryString).TrimStart('?'))" />
    <choose>
      <when condition="@(context.Request.Method == &quot;OPTIONS&quot;)">
        <return-response>
          <set-status code="200" reason="OK" />
        </return-response>
      </when>
      <when condition="@(((string)context.Variables[&quot;requestPath&quot;]).Equals(&quot;login&quot;, System.StringComparison.OrdinalIgnoreCase))">
        <rate-limit-by-key calls="100" renewal-period="60" counter-key="@(context.Request.IpAddress)" />
        <rewrite-uri template="/api/auth/{path}" />
      </when>
      <otherwise>
        <rate-limit-by-key calls="100" renewal-period="60" counter-key="@(context.Request.IpAddress)" />
        <send-request mode="new" response-variable-name="gatekeeperResponse" timeout="20" ignore-error="true">
          <set-url>@("https://${URL_API1}/api/gatekeeper")</set-url>
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
        <choose>
          <when condition="@(context.Variables.ContainsKey(&quot;gatekeeperResponse&quot;) == false || context.Variables[&quot;gatekeeperResponse&quot;] == null)">
            <return-response>
              <set-status code="503" reason="Service Unavailable" />
              <set-header name="Content-Type" exists-action="override">
                <value>application/json</value>
              </set-header>
              <set-body>{"error":"Authentication service unavailable"}</set-body>
            </return-response>
          </when>
        </choose>
        <set-variable name="gatekeeperStatusCode" value="@((int)((IResponse)context.Variables[&quot;gatekeeperResponse&quot;]).StatusCode)" />
        <set-variable name="gatekeeperBody" value="@{
            var response = (IResponse)context.Variables[&quot;gatekeeperResponse&quot;];
            var body = response.Body.As&lt;string&gt;(preserveContent: true);
            return body ?? string.Empty;
        }" />
        <choose>
          <when condition="@(((int)context.Variables[&quot;gatekeeperStatusCode&quot;]) &gt;= 500)">
            <return-response>
              <set-status code="503" reason="Service Unavailable" />
              <set-header name="Content-Type" exists-action="override">
                <value>application/json</value>
              </set-header>
              <set-body>{"error":"Authentication service unavailable"}</set-body>
            </return-response>
          </when>
          <when condition="@(string.IsNullOrWhiteSpace((string)context.Variables[&quot;gatekeeperBody&quot;]))">
            <return-response>
              <set-status code="503" reason="Service Unavailable" />
              <set-header name="Content-Type" exists-action="override">
                <value>application/json</value>
              </set-header>
              <set-body>{"error":"Empty response from authentication service"}</set-body>
            </return-response>
          </when>
        </choose>
        <set-variable name="gatekeeperJson" value="@{
            var body = (string)context.Variables[&quot;gatekeeperBody&quot;];
            try
            {
                return Newtonsoft.Json.Linq.JObject.Parse(body);
            }
            catch
            {
                return new Newtonsoft.Json.Linq.JObject(
                    new Newtonsoft.Json.Linq.JProperty(&quot;allowed&quot;, false),
                    new Newtonsoft.Json.Linq.JProperty(&quot;statusCode&quot;, 503),
                    new Newtonsoft.Json.Linq.JProperty(&quot;reason&quot;, &quot;Invalid response from authentication service&quot;)
                );
            }
        }" />
        <choose>
          <when condition="@{
              var json = (Newtonsoft.Json.Linq.JObject)context.Variables[&quot;gatekeeperJson&quot;];
              var token = json[&quot;allowed&quot;];
              return token == null || !string.Equals(token.ToString(), &quot;true&quot;, System.StringComparison.OrdinalIgnoreCase);
          }">
            <return-response>
              <set-status code="@{
                  var json = (Newtonsoft.Json.Linq.JObject)context.Variables[&quot;gatekeeperJson&quot;];
                  var token = json[&quot;statusCode&quot;];
                  int parsed;
                  return token != null &amp;&amp; int.TryParse(token.ToString(), out parsed) ? parsed : 403;
              }" reason="Forbidden" />
              <set-header name="Content-Type" exists-action="override">
                <value>application/json</value>
              </set-header>
              <set-body>@{
                  var json = (Newtonsoft.Json.Linq.JObject)context.Variables[&quot;gatekeeperJson&quot;];
                  var reasonToken = json[&quot;reason&quot;];
                  var reason = reasonToken == null ? &quot;Access denied&quot; : reasonToken.ToString();
                  return Newtonsoft.Json.JsonConvert.SerializeObject(new {
                      error = reason
                  });
              }</set-body>
            </return-response>
          </when>
        </choose>
        <set-header name="X-APIM-UserId" exists-action="override">
          <value>@{
              var json = (Newtonsoft.Json.Linq.JObject)context.Variables[&quot;gatekeeperJson&quot;];
              var token = json[&quot;userId&quot;];
              return token == null ? string.Empty : token.ToString();
          }</value>
        </set-header>
        <set-header name="X-APIM-AccountId" exists-action="override">
          <value>@{
              var json = (Newtonsoft.Json.Linq.JObject)context.Variables[&quot;gatekeeperJson&quot;];
              var token = json[&quot;accountId&quot;];
              return token == null ? string.Empty : token.ToString();
          }</value>
        </set-header>
        <set-header name="X-APIM-Email" exists-action="override">
          <value>@{
              var json = (Newtonsoft.Json.Linq.JObject)context.Variables[&quot;gatekeeperJson&quot;];
              var token = json[&quot;email&quot;];
              return token == null ? string.Empty : token.ToString();
          }</value>
        </set-header>
        <set-header name="X-APIM-Role" exists-action="override">
          <value>@{
              var json = (Newtonsoft.Json.Linq.JObject)context.Variables[&quot;gatekeeperJson&quot;];
              var token = json[&quot;role&quot;];
              return token == null ? string.Empty : token.ToString();
          }</value>
        </set-header>
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
POLICY_EOF
)

AUTH_POLICY_ESCAPED=$(echo "$AUTH_POLICY" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")

az rest --method put \
  --uri "https://management.azure.com/subscriptions/$(az account show --query 'id' -o tsv)/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.ApiManagement/service/${APIM_NAME}/apis/api-service-1/policies/policy?api-version=2023-03-01-preview&format=xml" \
  --body "{\"properties\": {\"format\": \"xml\", \"value\": $AUTH_POLICY_ESCAPED}}"

# MainModule policy
# NOTE: Dùng HEREDOC KHÔNG có nháy đơn để expand ${URL_API1} trong policy
PRODUCTS_POLICY=$(cat <<POLICY_EOF
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
    <set-variable name="requestPath" value="@((string)context.Request.MatchedParameters[&quot;path&quot;])" />
    <set-variable name="requestQuery" value="@(((string)context.Request.Url.QueryString).TrimStart('?'))" />
    <choose>
      <when condition="@(context.Request.Method == &quot;OPTIONS&quot;)">
        <return-response>
          <set-status code="200" reason="OK" />
        </return-response>
      </when>
      <otherwise>
        <rate-limit-by-key calls="100" renewal-period="60" counter-key="@(context.Request.IpAddress)" />
        <send-request mode="new" response-variable-name="gatekeeperResponse" timeout="20" ignore-error="true">
          <set-url>@("https://${URL_API1}/api/gatekeeper")</set-url>
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
        <choose>
          <when condition="@(context.Variables.ContainsKey(&quot;gatekeeperResponse&quot;) == false || context.Variables[&quot;gatekeeperResponse&quot;] == null)">
            <return-response>
              <set-status code="503" reason="Service Unavailable" />
              <set-header name="Content-Type" exists-action="override">
                <value>application/json</value>
              </set-header>
              <set-body>{"error":"Authentication service unavailable"}</set-body>
            </return-response>
          </when>
        </choose>
        <set-variable name="gatekeeperStatusCode" value="@((int)((IResponse)context.Variables[&quot;gatekeeperResponse&quot;]).StatusCode)" />
        <set-variable name="gatekeeperBody" value="@{
            var response = (IResponse)context.Variables[&quot;gatekeeperResponse&quot;];
            var body = response.Body.As&lt;string&gt;(preserveContent: true);
            return body ?? string.Empty;
        }" />
        <choose>
          <when condition="@(((int)context.Variables[&quot;gatekeeperStatusCode&quot;]) &gt;= 500)">
            <return-response>
              <set-status code="503" reason="Service Unavailable" />
              <set-header name="Content-Type" exists-action="override">
                <value>application/json</value>
              </set-header>
              <set-body>{"error":"Authentication service unavailable"}</set-body>
            </return-response>
          </when>
          <when condition="@(string.IsNullOrWhiteSpace((string)context.Variables[&quot;gatekeeperBody&quot;]))">
            <return-response>
              <set-status code="503" reason="Service Unavailable" />
              <set-header name="Content-Type" exists-action="override">
                <value>application/json</value>
              </set-header>
              <set-body>{"error":"Empty response from authentication service"}</set-body>
            </return-response>
          </when>
        </choose>
        <set-variable name="gatekeeperJson" value="@{
            var body = (string)context.Variables[&quot;gatekeeperBody&quot;];
            try
            {
                return Newtonsoft.Json.Linq.JObject.Parse(body);
            }
            catch
            {
                return new Newtonsoft.Json.Linq.JObject(
                    new Newtonsoft.Json.Linq.JProperty(&quot;allowed&quot;, false),
                    new Newtonsoft.Json.Linq.JProperty(&quot;statusCode&quot;, 503),
                    new Newtonsoft.Json.Linq.JProperty(&quot;reason&quot;, &quot;Invalid response from authentication service&quot;)
                );
            }
        }" />
        <choose>
          <when condition="@{
              var json = (Newtonsoft.Json.Linq.JObject)context.Variables[&quot;gatekeeperJson&quot;];
              var token = json[&quot;allowed&quot;];
              return token == null || !string.Equals(token.ToString(), &quot;true&quot;, System.StringComparison.OrdinalIgnoreCase);
          }">
            <return-response>
              <set-status code="@{
                  var json = (Newtonsoft.Json.Linq.JObject)context.Variables[&quot;gatekeeperJson&quot;];
                  var token = json[&quot;statusCode&quot;];
                  int parsed;
                  return token != null &amp;&amp; int.TryParse(token.ToString(), out parsed) ? parsed : 403;
              }" reason="Forbidden" />
              <set-header name="Content-Type" exists-action="override">
                <value>application/json</value>
              </set-header>
              <set-body>@{
                  var json = (Newtonsoft.Json.Linq.JObject)context.Variables[&quot;gatekeeperJson&quot;];
                  var reasonToken = json[&quot;reason&quot;];
                  var reason = reasonToken == null ? &quot;Access denied&quot; : reasonToken.ToString();
                  return Newtonsoft.Json.JsonConvert.SerializeObject(new {
                      error = reason
                  });
              }</set-body>
            </return-response>
          </when>
        </choose>
        <set-header name="X-APIM-UserId" exists-action="override">
          <value>@{
              var json = (Newtonsoft.Json.Linq.JObject)context.Variables[&quot;gatekeeperJson&quot;];
              var token = json[&quot;userId&quot;];
              return token == null ? string.Empty : token.ToString();
          }</value>
        </set-header>
        <set-header name="X-APIM-AccountId" exists-action="override">
          <value>@{
              var json = (Newtonsoft.Json.Linq.JObject)context.Variables[&quot;gatekeeperJson&quot;];
              var token = json[&quot;accountId&quot;];
              return token == null ? string.Empty : token.ToString();
          }</value>
        </set-header>
        <set-header name="X-APIM-Email" exists-action="override">
          <value>@{
              var json = (Newtonsoft.Json.Linq.JObject)context.Variables[&quot;gatekeeperJson&quot;];
              var token = json[&quot;email&quot;];
              return token == null ? string.Empty : token.ToString();
          }</value>
        </set-header>
        <set-header name="X-APIM-Role" exists-action="override">
          <value>@{
              var json = (Newtonsoft.Json.Linq.JObject)context.Variables[&quot;gatekeeperJson&quot;];
              var token = json[&quot;role&quot;];
              return token == null ? string.Empty : token.ToString();
          }</value>
        </set-header>
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
POLICY_EOF
)

PRODUCTS_POLICY_ESCAPED=$(echo "$PRODUCTS_POLICY" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")

az rest --method put \
  --uri "https://management.azure.com/subscriptions/$(az account show --query 'id' -o tsv)/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.ApiManagement/service/${APIM_NAME}/apis/api-service-2/policies/policy?api-version=2023-03-01-preview&format=xml" \
  --body "{\"properties\": {\"format\": \"xml\", \"value\": $PRODUCTS_POLICY_ESCAPED}}"
echo "    (Policy MainModule cập nhật xong)"

# ── 8. Deploy Frontend (external ingress) ───────────────────────────────────

echo ""
echo "[8/8] Triển khai React Frontend (external)..."
if az containerapp show --name "react-frontend" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  az containerapp update \
    --name "react-frontend" \
    --resource-group "$RESOURCE_GROUP" \
    --image "${ACR_NAME}.azurecr.io/react-frontend:${IMAGE_TAG}" \
    --replace-env-vars "VITE_MAIN_API_BASE_URL=${FE_MAIN_API}" "VITE_AUTH_API_BASE_URL=${FE_AUTH_API}"
else
  az containerapp create \
    --name "react-frontend" \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ENV_NAME" \
    --image "${ACR_NAME}.azurecr.io/react-frontend:${IMAGE_TAG}" \
    --registry-server "${ACR_NAME}.azurecr.io" \
    --registry-username "$ACR_USERNAME" \
    --registry-password "$ACR_PASSWORD" \
    --target-port 8080 \
    --ingress external \
    --env-vars "VITE_MAIN_API_BASE_URL=${FE_MAIN_API}" "VITE_AUTH_API_BASE_URL=${FE_AUTH_API}"
fi

FRONTEND_FQDN=$(az containerapp show \
  --name "react-frontend" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" \
  -o tsv)

# ── 9. Kết quả ─────────────────────────────────────────────────────────────

echo ""
echo "=========================================================="
echo "  DEPLOY HOÀN TẤT!"
echo "=========================================================="
echo "  Frontend  : https://${FRONTEND_FQDN}"
echo "  APIM Auth : https://${APIM_NAME}.azure-api.net/api/auth"
echo "  APIM Main : https://${APIM_NAME}.azure-api.net/api/products"
echo "  AuthModule: https://${URL_API1}"
echo "  MainModule: https://${URL_API2}"
echo "=========================================================="

# Lưu output ra file để reference
cat > deploy-output.env <<EOF
FRONTEND_URL=https://${FRONTEND_FQDN}
APIM_GATEWAY_URL=${APIM_GATEWAY_URL}
AUTH_MODULE_URL=https://${URL_API1}
MAIN_MODULE_URL=https://${URL_API2}
IMAGE_TAG=${IMAGE_TAG}
EOF
echo "Output saved to: deploy-output.env"
