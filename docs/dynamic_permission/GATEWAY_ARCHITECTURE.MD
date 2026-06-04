# Kiến Trúc API Gateway & Luồng Xác Thực

> Tài liệu mô tả kiến trúc và luồng xử lý request từ client đến backend services
> trong hệ thống Modular Monolith (`LocalGateway` + `AuthModule` + `MainModule`).

---

## 1. Tổng Quan Kiến Trúc

### 1.1. Mô hình triển khai

Hệ thống gồm 3 service chạy song song trên localhost, kết nối qua HTTP:

| Service | Cổng | Vai trò | Công nghệ |
|---------|------|---------|-----------|
| `LocalGateway` | `5000` | API Gateway — điều phối request, auth | YARP (ASP.NET) |
| `AuthModule` | `5001` | Xác thực JWT & kiểm tra quyền (Gatekeeper) | ASP.NET Core |
| `MainModule` | `5002` | Business logic — Products, Orders, ... | ASP.NET Core |

### 1.2. Mục tiêu thiết kế

- **Gateway tập trung quyền**: tất cả auth logic nằm ở gateway, downstream services không cần biết JWT.
- **Downstream services nhẹ**: `MainModule` chỉ đọc headers do gateway inject, không verify JWT.
- **Modular Monolith**: 3 module tách biệt (Auth / Gateway / Business) trong cùng một solution nhưng deploy độc lập.
- **Database chia sẻ**: `AuthModule` sở hữu bảng `permissions` và `user_permissions`, các module khác chỉ đọc/ghi qua DbContext riêng.

---

## 2. Luồng Xử Lý Request

```
Client Request (có JWT)
        │
        ▼
┌─────────────────────────┐
│      LocalGateway       │  ← YARP (API Management mô phỏng)
│  GatewayAuthMiddleware  │     on localhost:5000
└───────────┬─────────────┘
            │ 1. Extract Authorization header
            │ 2. POST /api/gatekeeper
            ▼
┌─────────────────────────┐
│       AuthModule         │     on localhost:5001
│   GatekeeperController   │
│  - Validate JWT         │
│  - Check permission DB  │
└───────────┬─────────────┘
            │ GatekeeperResponse
            │ (Allowed/Denied + UserId/AccountId/Email/Role)
            ▼
    ┌───────────────────┐
    │   ALLOW?          │
    └─┬─────────────┬───┘
      │ Yes         │ No
      ▼             ▼
  Inject headers  Return 401/403
  X-UserId,      immediately
  X-AccountId,
  X-Email,
  X-Role
      │
      ▼
┌─────────────────────────┐
│      MainModule          │     on localhost:5002
│  (Products, etc.)       │     reads X-* headers
└─────────────────────────┘
```

---

## 3. Chi Tiết Từng Bước

### Bước 1 — Client gửi request

Client gửi HTTP request kèm JWT trong header:

```
GET /api/products HTTP/1.1
Host: localhost:5000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Bước 2 — LocalGateway nhận request

`GatewayAuthMiddleware` (hoặc `YARP` transform) thực hiện:

1. **Extract** `Authorization` header từ request.
2. **Forward** request đến `AuthModule` qua POST `/api/gatekeeper`:

```
POST http://localhost:5001/api/gatekeeper
Content-Type: application/json

{
  "authorizationHeader": "Bearer eyJhbGciOiJIUzI1Ni...",
  "method": "GET",
  "path": "/api/products"
}
```

### Bước 3 — AuthModule xử lý (GatekeeperController)

`GatekeeperController` thực hiện 4 bước:

```
Bước 3.1: Extract Bearer token
         ↓
Bước 3.2: Validate JWT (signature, expiry, issuer, audience)
         ↓
Bước 3.3: Tra cứu permission record (Endpoint + Method) trong DB
         ↓
Bước 3.4: Kiểm tra UserPermissions (exact match hoặc :admin)
```

#### Bước 3.1 — Extract Bearer token

```csharp
var authHeader = request.AuthorizationHeader;
if (!authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
    return Ok(GatekeeperResponseDto.Deny("Missing or invalid Authorization header", 401));

var token = authHeader["Bearer ".Length..].Trim();
```

#### Bước 3.2 — Validate JWT

Dùng `JwtSecurityTokenHandler` với tham số đọc từ `IConfiguration` / environment variables:

```csharp
var principal = handler.ValidateToken(token, new TokenValidationParameters
{
    ValidateIssuerSigningKey = true,
    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
    ValidateIssuer = true,
    ValidIssuer = jwtIssuer,
    ValidateAudience = true,
    ValidAudience = jwtAudience,
    ValidateLifetime = true,
    ClockSkew = TimeSpan.Zero
}, out _);
```

#### Bước 3.3 — Tra cứu permission record

```csharp
var permission = await _dbContext.Permissions
    .AsNoTracking()
    .FirstOrDefaultAsync(p =>
        p.IsActive &&
        EF.Functions.ILike(p.Endpoint ?? "", normalizedPath) &&
        EF.Functions.ILike(p.Method ?? "", request.Method));
```

> Dùng `ILike` (PostgreSQL) để so sánh case-insensitive.

#### Bước 3.4 — Kiểm tra user permissions

Hai chế độ kiểm tra:

```
a) Exact match — UserPermission.PermissionId == permission.Id
   → User có quyền cụ thể trên endpoint này

b) Wildcard match — UserPermission có PermissionCode == "[resource]:admin"
   → User có full quyền trên resource (ví dụ: products:admin)
```

### Bước 4 — AuthModule trả về GatekeeperResponse

```csharp
return Ok(GatekeeperResponseDto.Allow(userId, accountId, email, role));
// hoặc
return Ok(GatekeeperResponseDto.Deny("Access denied", 403));
```

### Bước 5 — LocalGateway quyết định

| Response | Action |
|----------|--------|
| `allowed = true` | Inject headers, forward request đến `MainModule` |
| `allowed = false` | Trả 401/403 về client ngay, **không forward** |

Headers được inject khi forward:

```
X-UserId: <userId>
X-AccountId: <accountId>
X-Email: <email>
X-Role: <role>
```

### Bước 6 — MainModule xử lý

`MainModule` đọc `X-*` headers từ `HttpContext.Request.Headers` để lấy identity:

```csharp
var userId = Guid.Parse(Request.Headers["X-UserId"]!);
var accountId = Guid.Parse(Request.Headers["X-AccountId"]!);
var role = Request.Headers["X-Role"].ToString();
```

> Không cần verify JWT tại đây — đã do `AuthModule` xác thực ở bước trước.

---

## 4. DTOs

### GatekeeperRequestDto

```csharp
public class GatekeeperRequestDto
{
    public string AuthorizationHeader { get; set; }  // "Bearer <token>"
    public string Method              { get; set; }  // "GET", "POST", ...
    public string Path                { get; set; }  // "/api/products"
}
```

### GatekeeperResponseDto

```csharp
public class GatekeeperResponseDto
{
    public bool   Allowed   { get; set; }
    public int    StatusCode { get; set; }  // 200 = OK, 401 = Unauthorized, 403 = Forbidden
    public string? Message   { get; set; }
    public Guid?  UserId    { get; set; }
    public Guid?  AccountId { get; set; }
    public string? Email     { get; set; }
    public string? Role      { get; set; }

    public static GatekeeperResponseDto Allow(Guid userId, Guid accountId, string email, string role) => new() { ... };
    public static GatekeeperResponseDto Deny(string message, int statusCode) => new() { ... };
}
```

---

## 5. Cấu Hình (appsettings.json / Environment Variables)

### AuthModule (Gatekeeper)

```json
{
  "Jwt": {
    "Secret":   "... (min 32 chars) ...",
    "Issuer":   "swovnai",
    "Audience": "swovnai"
  }
}
```

```bash
# Hoặc environment variables
JWT_SECRET=...
JWT_ISSUER=swovnai
JWT_AUDIENCE=swovnai
```

### LocalGateway (YARP)

```json
{
  "ReverseProxy": {
    "Clusters": {
      "auth-cluster": {
        "Destinations": {
          "auth": { "Address": "http://localhost:5001" }
        }
      },
      "main-cluster": {
        "Destinations": {
          "main": { "Address": "http://localhost:5002" }
        }
      }
    },
    "Routes": [
      {
        "RouteId": "auth",
        "Match": { "Path": "/api/auth/{**catch-all}" },
        "ClusterId": "auth-cluster"
      },
      {
        "RouteId": "gatekeeper",
        "Match": { "Path": "/api/gatekeeper/{**catch-all}" },
        "ClusterId": "auth-cluster"
      },
      {
        "RouteId": "main",
        "Match": { "Path": "/api/{**catch-all}" },
        "ClusterId": "main-cluster"
      }
    ]
  }
}
```

---

## 6. Bảo Mật

### 6.1. JWT Secret

- Đặt qua `appsettings.json` hoặc environment variable `JWT_SECRET`.
- Minimum 32 ký tự, dùng HMAC-SHA256.
- **Không hardcode** trong source code.

### 6.2. Downstream không verify JWT

`MainModule` tin tưởng `X-*` headers từ gateway. Đảm bảo:
- `LocalGateway` chỉ forward request từ trusted network.
- Không expose `MainModule` cổng ra internet.

### 6.3. CORS

CORS nên được config tại `LocalGateway` (điểm vào duy nhất), không config ở từng module.

---

## 7. Error Handling

| Trường hợp | Status | Message |
|-------------|--------|---------|
| Missing Authorization header | 401 | "Missing or invalid Authorization header" |
| Invalid token format | 401 | "Token is empty" |
| JWT signature/exp/iss/aud fail | 401 | "Invalid or expired token" |
| No permission record found | 403 | "No permission record for METHOD PATH" |
| No exact permission + no :admin | 403 | "Access denied: no permission for METHOD PATH" |

---

## 8. Luồng Không Cần Auth (Public Endpoint)

```
Client Request (không có JWT)
        │
        ▼
┌─────────────────────────┐
│      LocalGateway       │
│  GatewayAuthMiddleware  │
└───────────┬─────────────┘
            │ 1. Không có Authorization header
            │ 2. Forward /api/gatekeeper với header rỗng
            ▼
┌─────────────────────────┐
│       AuthModule         │
│   GatekeeperController   │
│                         │
│ Check: permission.IsPublic == true?
└───────────┬─────────────┘
            │
            ▼
    ┌───────────────┐
    │ Endpoint public? │
    └─┬───────────┬──┘
      │ Yes        │ No
      ▼            ▼
  ALLOW (không   DENY
  check JWT)     403
      │            │
      └────────────┴─── LocalGateway trả về
```

> **Note**: public endpoint được check `permission.IsPublic = true` trước khi kiểm tra JWT,
> nhưng `Authorization` header vẫn nên gửi để nhận user identity nếu có.

---

## 9. Liên Quan Đến Các Tài Liệu Khác

| Tài liệu | Phạm vi |
|-----------|---------|
| [DYNAMIC_PERMISSION_DESIGN.MD](DYNAMIC_PERMISSION_DESIGN.MD) | Thiết kế bảng `permissions`, sync, `[PermissionMeta]` |
| [DEVELOPER_COOKBOOK.MD](DEVELOPER_COOKBOOK.MD) | Hướng dẫn sử dụng attribute cho developer |
| `be/LocalGateway/` | Code gateway (YARP config, middleware) |
| `be/AuthModule/Controllers/GatekeeperController.cs` | Logic xác thực & kiểm tra quyền |
| `be/AuthModule/DTOs/GatekeeperDto.cs` | Request/Response DTOs |
