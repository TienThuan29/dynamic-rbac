# Developer Cookbook — `[PermissionMeta]` Recipes

> Hướng dẫn sử dụng attribute `[PermissionMeta]` để khai báo metadata cho endpoint
> trong hệ thống Dynamic Permission. Xem thiết kế tổng thể tại
> [DYNAMIC_PERMISSION_DESIGN.MD](DYNAMIC_PERMISSION_DESIGN.MD).

---

## Mục Lục

1. [Public API — không cần auth](#1-public-api--không-cần-auth)
2. [Authenticated API — cần permission code cụ thể](#2-authenticated-api--cần-permission-code-cụ-thể)
3. [System / Internal endpoint](#3-system--internal-endpoint)
4. [Override class-level cho 1 action](#4-override-class-level-cho-1-action)
5. [Kết hợp với AutoGenerateCode](#5-kết-hợp-với-autogeneratecode)
6. [Anti-patterns — những gì KHÔNG nên làm](#6-anti-patterns--những-gì-không-nên-làm)
7. [Cheat sheet](#7-cheat-sheet)

---

## 1. Public API — không cần auth

Áp dụng `[PermissionMeta]` ở **class-level** với `Public = PublicMode.Public` và bật
`AutoGenerateCode = true` để mọi action trong controller đều có code generate sẵn theo
convention.

```csharp
using MainModule.Attributes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/products")]
[AllowAnonymous]
[PermissionMeta(Public = PublicMode.Public, IsSystem = false, AutoGenerateCode = true)]
public class ProductsController : ControllerBase
{
    [HttpGet]                       public IActionResult GetAll()  { ... }   // products:list
    [HttpGet("{id:guid}")]          public IActionResult Get()     { ... }   // products:read
    [HttpPost]                      public IActionResult Create()  { ... }   // products:create
    [HttpPut("{id:guid}")]          public IActionResult Update()  { ... }   // products:update
    [HttpDelete("{id:guid}")]       public IActionResult Delete()  { ... }   // products:delete
    [HttpPatch("{id:guid}/stock")]  public IActionResult Stock()   { ... }   // products:patch_stock
}
```

**Kết quả trong DB:**

| method | endpoint | permission_code | is_public | is_system |
|--------|----------|-----------------|-----------|-----------|
| GET | /api/products | products:list | t | f |
| GET | /api/products/{id:guid} | products:read | t | f |
| POST | /api/products | products:create | t | f |
| PUT | /api/products/{id:guid} | products:update | t | f |
| DELETE | /api/products/{id:guid} | products:delete | t | f |
| PATCH | /api/products/{id:guid}/stock | products:patch_stock | t | f |

---

## 2. Authenticated API — cần permission code cụ thể

Khi cần `permission_code` chính xác (không theo convention), dùng `Code = "..."`.

```csharp
using AuthModule.Attributes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    // Public — explicit code
    [HttpPost("login")]
    [AllowAnonymous]
    [PermissionMeta(Code = "auth:login", Public = PublicMode.Public)]
    public IActionResult Login() { ... }

    // Authenticated — không cần [Authorize] vì global authorization đã set,
    // nhưng vẫn cần code để admin gán cho group/role
    [HttpPost("logout")]
    [PermissionMeta(Code = "auth:logout")]   // Public.Auto + không có [AllowAnonymous] => is_public = false
    public IActionResult Logout() { ... }

    [HttpPost("refresh")]
    [AllowAnonymous]
    [PermissionMeta(Code = "auth:refresh", Public = PublicMode.Public)]
    public IActionResult Refresh() { ... }
}
```

---

## 3. System / Internal endpoint

Endpoint nội bộ (diagnostics, internal admin tools, callbacks từ background job) nên
đánh dấu `IsSystem = true` để admin UI có thể ẩn đi và không cho xoá thủ công.

```csharp
[HttpGet("internal/diagnostics")]
[PermissionMeta(
    Code = "system:diagnostics",
    IsSystem = true,
    Public = PublicMode.Private)]    // force private dù environment có cho [AllowAnonymous]
public IActionResult Diagnostics() { ... }
```

→ Trong DB:

| method | endpoint | permission_code | is_public | is_system |
|--------|----------|-----------------|-----------|-----------|
| GET | /api/admin/internal/diagnostics | system:diagnostics | f | **t** |

---

## 4. Override class-level cho 1 action

`[PermissionMeta]` ở method-level **luôn thắng** class-level. Hữu ích khi đa số action
giống nhau, chỉ vài cái đặc biệt.

```csharp
[ApiController]
[Route("api/orders")]
[PermissionMeta(Public = PublicMode.Private, AutoGenerateCode = true)]   // mặc định: private + auto-code
public class OrdersController : ControllerBase
{
    [HttpGet]                         public IActionResult List()   { ... }   // orders:list   (private, auto)
    [HttpGet("{id:guid}")]            public IActionResult Get()    { ... }   // orders:read   (private, auto)

    // Override: cho phép tracking công khai bằng tracking-code, code đặt tay
    [HttpPost("public-track")]
    [AllowAnonymous]
    [PermissionMeta(Public = PublicMode.Public, Code = "orders:public_track")]
    public IActionResult PublicTrack() { ... }
}
```

**Cơ chế:** `endpoint.Metadata.GetOrderedMetadata<PermissionMetaAttribute>().LastOrDefault()`
— class-level nằm trước, method-level nằm sau, `LastOrDefault()` lấy method-level.

---

## 5. Kết hợp với `AutoGenerateCode`

### 5.1. Để `AutoGenerateCode` tự lo ở class-level, override 1-2 chỗ đặc biệt

```csharp
[ApiController]
[Route("api/users")]
[PermissionMeta(AutoGenerateCode = true)]
public class UsersController : ControllerBase
{
    [HttpGet]               public IActionResult List()        { ... }   // users:list
    [HttpGet("{id:guid}")]  public IActionResult Get()         { ... }   // users:read
    [HttpPost]              public IActionResult Create()      { ... }   // users:create

    // Endpoint đặc biệt — đặt code rõ ràng cho dễ search trong code
    [HttpPost("{id:guid}/promote-to-admin")]
    [PermissionMeta(Code = "users:promote_admin")]    // explicit > auto
    public IActionResult Promote() { ... }
}
```

### 5.2. Mix với multiple resources trong cùng controller

Khi 1 controller chứa nhiều resource (anti-pattern nhưng đôi khi cần), **không nên**
dùng `AutoGenerateCode` ở class-level — đặt từng method-level explicit:

```csharp
[ApiController]
[Route("api/admin")]
public class AdminController : ControllerBase
{
    [HttpGet("users")]      [PermissionMeta(Code = "users:list")]      public IActionResult Users() { ... }
    [HttpGet("orders")]     [PermissionMeta(Code = "orders:list")]     public IActionResult Orders() { ... }
    [HttpGet("audit-logs")] [PermissionMeta(Code = "audit:list")]      public IActionResult Logs() { ... }
}
```

---

## 6. Anti-patterns — những gì KHÔNG nên làm

### ❌ 6.1. Đặt `Code` trùng nhau ở 2 endpoint khác nhau

```csharp
[HttpPost("create")]  [PermissionMeta(Code = "products:save")] public IActionResult Create() { ... }
[HttpPut("{id}")]     [PermissionMeta(Code = "products:save")] public IActionResult Update() { ... }   // ❌ DB throws unique violation
```

`permission_code` có **partial unique index** → 2 row cùng code (NOT NULL) sẽ fail. Sửa:
dùng `products:create` và `products:update`, hoặc bật `AutoGenerateCode`.

### ❌ 6.2. Hardcode code trong logic kiểm tra quyền

```csharp
// ❌ Magic string khắp nơi
if (user.HasPermission("products:create")) { ... }
```

→ Dùng constants/enum tập trung:

```csharp
public static class Perms
{
    public const string ProductsCreate = "products:create";
    public const string ProductsRead   = "products:read";
}

if (user.HasPermission(Perms.ProductsCreate)) { ... }
```

### ❌ 6.3. Dựa vào `permission_code` được auto-gen làm key business logic

```csharp
// ❌ AutoGenerateCode có thể đổi nếu đổi route convention
if (user.HasPermission("products:patch_stock")) { ... }
```

→ Đặt `Code = "products:update_stock"` explicit nếu code này được dùng trong code business.
Auto-gen chỉ phù hợp cho admin gán quyền qua UI.

### ❌ 6.4. Quên `[AllowAnonymous]` khi `Public = PublicMode.Public`

```csharp
[HttpGet("public-data")]
[PermissionMeta(Public = PublicMode.Public)]   // ❌ DB ghi is_public=true nhưng runtime vẫn yêu cầu auth
public IActionResult Data() { ... }
```

`PublicMode.Public` chỉ ảnh hưởng đến **DB metadata**, không tự động bypass authentication
middleware. Cần thêm `[AllowAnonymous]`:

```csharp
[HttpGet("public-data")]
[AllowAnonymous]
[PermissionMeta(Public = PublicMode.Public)]
public IActionResult Data() { ... }
```

---

## 7. Cheat Sheet

| Tình huống | Snippet |
|------------|---------|
| Public API, code tự gen | `[AllowAnonymous] [PermissionMeta(Public=PublicMode.Public, AutoGenerateCode=true)]` |
| Public API, code explicit | `[AllowAnonymous] [PermissionMeta(Public=PublicMode.Public, Code="x:y")]` |
| Authenticated API | `[PermissionMeta(Code="x:y")]` |
| Authenticated API, code tự gen | `[PermissionMeta(AutoGenerateCode=true)]` |
| Internal/system | `[PermissionMeta(Code="system:x", IsSystem=true, Public=PublicMode.Private)]` |
| Force private (override `[AllowAnonymous]`) | `[PermissionMeta(Public=PublicMode.Private)]` |
| Class-level mặc định + method override | Class: `[PermissionMeta(...)]`, Method: `[PermissionMeta(...)]` |

---

## Tham khảo

- [DYNAMIC_PERMISSION_DESIGN.MD](DYNAMIC_PERMISSION_DESIGN.MD) — thiết kế tổng thể
- `be/AuthModule/Attributes/PermissionMetaAttribute.cs` — định nghĩa attribute
- `be/AuthModule/Extensions/PermissionSyncExtensions.cs` — logic resolve metadata
