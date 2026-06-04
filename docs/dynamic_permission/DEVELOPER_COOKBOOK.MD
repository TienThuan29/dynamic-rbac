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
6. [Wildcard `:admin` — toàn quyền trên resource](#7-wildcard-admin--toàn-quyền-trên-resource)
7. [Anti-patterns — những gì KHÔNG nên làm](#8-anti-patterns--những-gì-không-nên-làm)
8. [Cheat sheet](#9-cheat-sheet)

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

## 7. Wildcard `:admin` — toàn quyền trên resource

### 7.1. Khi nào dùng

Khi gán quyền cho admin (hoặc user cần full quyền trên một resource),
thay vì gán từng action (`products:list`, `products:create`, `products:read`, ...) chỉ cần
gán **một row duy nhất**:

```
products:admin  →  được phép gọi MỌI endpoint trong /api/products/*
```

### 7.2. Cách hoạt động

Row `products:admin` được **auto-sync** vào DB khi app khởi động. Admin **chỉ việc gán**
permission này cho user/group — không cần tạo thủ công.

### 7.3. Ví dụ trong DB

| permission_code | endpoint | method | is_public | is_system |
|---|---|---|---|---|
| `products:list` | `/api/products` | `GET` | `true` | `false` |
| `products:create` | `/api/products` | `POST` | `false` | `false` |
| `products:read` | `/api/products/{id:guid}` | `GET` | `false` | `false` |
| **`products:admin`** | `NULL` | `NULL` | `false` | `true` |

Row `products:admin` có `endpoint=NULL`, `method=NULL` — đây là **wildcard entry**, không
map đến endpoint cụ thể. Tại runtime, Gatekeeper kiểm tra:

```
User có products:admin?
  → Có → cho phép mọi request /api/products/* (bất kể method nào)
  → Không → kiểm tra exact permission match như bình thường
```

### 7.4. Thêm module mới

1. Developer tạo controller mới, ví dụ `OrdersController` tại `/api/orders`.
2. Restart module.
3. Sync tự động tạo row `orders:admin` vào DB.
4. Admin gán `orders:admin` cho user → user có full quyền orders.

> **Không cần code thêm bất cứ dòng nào** cho `:admin` — chỉ cần restart.

### 7.5. Trường hợp đặc biệt

| Tình huống | Hành vi |
|---|---|
| User có `products:admin` nhưng endpoint là public | **ALLOW** (public luôn allowed trước) |
| User có `products:admin` nhưng endpoint không tồn tại trong DB | **DENY 403** (no permission record) |
| User có `products:admin` nhưng `is_active = false` trên permission | **DENY** (không có row nào match) |
| Admin xóa row `products:admin` khỏi DB | `:admin` không còn hoạt động |

---

## 8. Anti-patterns — những gì KHÔNG nên làm

### 8.1. Đặt `Code` trùng nhau ở 2 endpoint khác nhau

```csharp
[HttpPost("create")]  [PermissionMeta(Code = "products:save")] public IActionResult Create() { ... }
[HttpPut("{id}")]     [PermissionMeta(Code = "products:save")] public IActionResult Update() { ... }   // DB throws unique violation
```

→ 2 row cùng code (NOT NULL) sẽ fail unique index. Sửa: dùng `products:create` và `products:update`, hoặc bật `AutoGenerateCode`.

### 8.2. Hardcode code trong logic kiểm tra quyền

```csharp
// Magic string khắp nơi
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

### 8.3. Dựa vào `permission_code` được auto-gen làm key business logic

```csharp
// AutoGenerateCode có thể đổi nếu đổi route convention
if (user.HasPermission("products:patch_stock")) { ... }
```

→ Đặt `Code = "products:update_stock"` explicit nếu code này được dùng trong code business.
Auto-gen chỉ phù hợp cho admin gán quyền qua UI.

### 8.4. Quên `[AllowAnonymous]` khi `Public = PublicMode.Public`

```csharp
[HttpGet("public-data")]
[PermissionMeta(Public = PublicMode.Public)]   // DB ghi is_public=true nhưng runtime vẫn yêu cầu auth
public IActionResult Data() { ... }
```

→ `PublicMode.Public` chỉ ảnh hưởng đến **DB metadata**, không tự động bypass authentication
middleware. Cần thêm `[AllowAnonymous]`:

```csharp
[HttpGet("public-data")]
[AllowAnonymous]
[PermissionMeta(Public = PublicMode.Public)]
public IActionResult Data() { ... }
```

---

## 9. Cheat Sheet

| Tình huống | Snippet |
|------------|---------|
| Public API, code tự gen | `[AllowAnonymous] [PermissionMeta(Public=PublicMode.Public, AutoGenerateCode=true)]` |
| Public API, code explicit | `[AllowAnonymous] [PermissionMeta(Public=PublicMode.Public, Code="x:y")]` |
| Authenticated API | `[PermissionMeta(Code="x:y")]` |
| Authenticated API, code tự gen | `[PermissionMeta(AutoGenerateCode=true)]` |
| Internal/system | `[PermissionMeta(Code="system:x", IsSystem=true, Public=PublicMode.Private)]` |
| Force private (override `[AllowAnonymous]`) | `[PermissionMeta(Public=PublicMode.Private)]` |
| Class-level mặc định + method override | Class: `[PermissionMeta(...)]`, Method: `[PermissionMeta(...)]` |
| **`:admin` wildcard** | Auto-sync, chỉ gán `[resource]:admin` cho user là đủ |

---

## Tham khảo

- [DYNAMIC_PERMISSION_DESIGN.MD](DYNAMIC_PERMISSION_DESIGN.MD) — thiết kế tổng thể
- `be/AuthModule/Attributes/PermissionMetaAttribute.cs` — định nghĩa attribute
- `be/AuthModule/Extensions/PermissionSyncExtensions.cs` — logic resolve metadata
