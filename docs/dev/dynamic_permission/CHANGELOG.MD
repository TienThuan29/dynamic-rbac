# Changelog — Dynamic RBAC

> Tài liệu ghi lại các thay đổi đáng chú ý trong hệ thống Dynamic RBAC
> (`AuthModule` + `LocalGateway` + `MainModule` + `fe/`).

---

## 2026-06-07 — Database Schema Fix & APIM Policy Update

### Database Changes

#### 1. Rename `token_hash` → `token`

- **Nguyên nhân**: Entity `Token.cs` map tới column `token` nhưng database có column `token_hash`
- **Fix**: Rename column trong PostgreSQL
- **Migration**: `20250605000000_InitialCreate` đã được update để reflect thay đổi này

```sql
ALTER TABLE tokens RENAME COLUMN token_hash TO token;
ALTER INDEX ix_tokens_token_hash RENAME TO ix_tokens_token;
```

#### 2. Increase Token Column Size 255 → 4000

- **Nguyên nhân**: JWT token thực tế dài hơn 255 ký tự
- **Fix**: Tăng kích thước column từ `VARCHAR(255)` lên `VARCHAR(4000)`

```sql
ALTER TABLE tokens ALTER COLUMN token TYPE VARCHAR(4000);
```

#### 3. Consolidated Migrations

- Đã gộp 2 migration files (`20250607000000_*` và `20250607000001_*`) vào `20250605000000_InitialCreate.cs`
- Migrations tạm thời đã được xóa

### APIM Policy Changes

#### 1. Remove Products Bypass

- **Trước**: MainModule policy bypass Gatekeeper cho `GET /products*`
- **Sau**: Tất cả request đều qua Gatekeeper check permission

```xml
<!-- ĐÃ XÓA: Bypass cho products -->
<!--
<when condition="@(context.Request.Method == "GET" && ...StartsWith("products/")...)">
  <rewrite-uri template="/api/{path}" />
</when>
-->
```

### Troubleshooting Commands

```bash
# Kiểm tra tokens table structure
docker run --rm postgres:16 psql "host=<host> port=5432 dbname=postgres user=<user> password='<pass>' sslmode=require" -c "\d tokens"

# Rename column
docker run --rm postgres:16 psql "host=<host> port=5432 dbname=postgres user=<user> password='<pass>' sslmode=require" -c "ALTER TABLE tokens RENAME COLUMN token_hash TO token;"

# Increase column size
docker run --rm postgres:16 psql "host=<host> port=5432 dbname=postgres user=<user> password='<pass>' sslmode=require" -c "ALTER TABLE tokens ALTER COLUMN token TYPE VARCHAR(4000);"

# Xem container logs
az containerapp logs show --name api-service-1 --resource-group <rg-name> --tail 100
```

---

## 2026-06-05 — External Token cho Ứng Dụng Bên Thứ Ba

Commit: `feat: external token support`

### Tính năng mới

#### 1. External Token — Long-Lived Bearer Token

Cho phép external applications (ứng dụng bên thứ ba, script, CI/CD, service-to-service)
truy cập API qua long-lived token mà không cần user identity.

- **2 bảng mới**: `tokens` + `token_permissions`
- **Entity**: `Token.cs`, `TokenPermission.cs`
- **Migration**: `20250605000000_AddTokens`
- **Repository**: `TokenRepository.cs`, `TokenPermissionRepository.cs`
- **Service**: `TokenService.cs` (create, refresh, revoke, add/remove permissions)
- **Controller**: `TokenController.cs`

#### 2. Gatekeeper — DB-First Dispatch

- **Trước**: Dùng `IsJwtStructure()` (token có `.` và 3 phần) → sai vì cả 2 loại đều là JWT
- **Sau**: Luôn lookup `tokens` table trước → tìm thấy là external, không tìm thấy mới validate JWT

```csharp
// TRƯỚC (sai)
if (IsJwtStructure(rawToken))
    return await AuthorizeByJwtAsync(...);  // external token luôn nhảy vào đây!

// SAU (đúng)
var token = await _tokenRepo.GetByTokenAsync(rawToken, ct);
if (token != null)
    return await AuthorizeByExternalTokenAsync(token, ...);
return await AuthorizeByJwtAsync(rawToken, ...);
```

#### 3. Gatekeeper — Authorization bằng `TokenPermission` (không fallback)

- External token **chỉ check qua `TokenPermission`** — không fallback sang `UserPermission`
- JWT nội bộ (internal) vẫn check qua `UserPermission` như cũ

#### 4. Gatekeeper — PermissionCode Matching cho External Token

- Ưu tiên 1: Match bằng `PermissionCode` (e.g. `GET /api/products` → `"products:list"`)
- Ưu tiên 2: Fallback bằng `Endpoint + Method`

```csharp
// Derive permission_code từ path + method
var resource = ExtractResource(normalizedPath);   // "products"
var action = DeriveAction(method, normalizedPath); // "list"
var permissionCode = $"{resource}:{action}";     // "products:list"

// Tìm Permission có PermissionCode khớp
var byCode = allPermissions.FirstOrDefault(p =>
    string.Equals(p.PermissionCode, permissionCode, StringComparison.OrdinalIgnoreCase));
```

#### 5. External Token JWT không chứa Identity

- External token sinh với `userId = Guid.Empty`, `accountId = Guid.Empty`, `role = "ExternalToken"`
- Gateway response trả về `role = "ExternalToken"` để downstream phân biệt

### Các thay đổi code

| File | Thay đổi |
|------|-----------|
| `GatekeeperController.cs` | DB-first dispatch, TokenPermission matching, bỏ fallback |
| `TokenService.cs` | External token sinh với Guid.Empty identity |
| `Token.cs` + `TokenPermission.cs` | Entity mới |
| `TokenRepository.cs` + `TokenPermissionRepository.cs` | Repository mới |
| `TokenMapper.cs` | Map Token → TokenResponse |
| `TokenController.cs` | CRUD endpoints mới |
| `TokenRequests.cs` + `TokenResponses.cs` | DTOs mới |

### Các thay đổi document

| File | Thay đổi |
|------|-----------|
| `DYNAMIC_PERMISSION_DESIGN.MD` | Thêm section 12: External Token |
| `GATEWAY_ARCHITECTURE.MD` | Cập nhật dispatch logic, thêm external token flow |
| `DEVELOPER_COOKBOOK.MD` | Thêm section 6: External Token recipes |
| `CHANGELOG.MD` | Ghi nhận tính năng mới |

---

## 2026-06-04 — Sprint cải tiến UI & sửa lỗi Gatekeeper

Commit: `4d41b8d` — *feat: dynamic RBAC improvements*

### Backend (`AuthModule`)

#### 1. `[PermissionMeta]` cho toàn bộ controllers
Tất cả endpoints trong các controllers sau đã được annotate với `PermissionName` + `Description`,
phục vụ cho `PermissionSyncExtensions` tự sinh permission record khi khởi động:

- `AuthController` — login
- `PermissionController` — 5 endpoints CRUD permissions
- `UserPermissionController` — 6 endpoints quản lý gán quyền
- `PermissionGroupController` — 5 endpoints quản lý group
- `GatekeeperController` — internal gatekeeper endpoint

> Khi thêm endpoint mới, **bắt buộc** phải có `[PermissionMeta(PermissionName = ..., Description = ...)]`
> để admin có thông tin hiển thị trong UI quản trị.

#### 2. Sửa lỗi route pattern matching trong `GatekeeperController` ⚠️
**Bug**: Bước 5 dùng `EF.Functions.ILike(p.Endpoint, normalizedPath)` — match literal,
không match được route template chứa `{param}`. Ví dụ:

```
Pattern lưu trong DB:  /api/products/{id}
Path thực tế client:   /api/products/743bcf48-9a8c-4d1f-...
Kết quả ILike:         KHÔNG MATCH → trả 403 sai
```

**Fix**: Tách 2 bước
1. DB query chỉ filter `IsActive` + `Method` (tập nhỏ)
2. In-memory `RoutePatternMatches(pattern, path)` so sánh từng segment, treat `{...}` như wildcard.

Xem chi tiết tại [`GATEWAY_ARCHITECTURE.MD § 3.3`](./GATEWAY_ARCHITECTURE.MD#bước-33--tra-cứu-permission-record-route-pattern-matching).

### Frontend (`fe/`)

#### 1. `react-hot-toast` toàn cục
- Cài đặt `react-hot-toast` v3.x.
- `<Toaster position="top-right" />` được render ở `App.tsx`.
- Migrate **toàn bộ** inline error / notice div → `toast.error(...)` / `toast.success(...)`.
- Inline error chỉ giữ lại cho lỗi load list (state persistent).

#### 2. Shared lib `permission.util.ts`
- Hàm `permissionScopeLabel(permission)` — trước đây bị duplicate ở 2 manager components.
- Đặt tại `fe/src/lib/permission.util.ts`, import chung.

#### 3. `PermissionSearchBox` — bộ lọc dùng chung
Filter bao gồm:

```ts
type PermissionFilters = {
  search:   string
  method:   string[]                    // multi-select GET/POST/PUT/...
  type:     ("system" | "custom")[]
  status:   ("active" | "inactive")[]
  resource: string                      // resource prefix select
  isAdmin:  "" | "admin" | "non-admin"  // chỉ permission [resource]:admin
}
```

- `resourceOptions` là **prop optional** — nếu truyền vào sẽ hiển thị dropdown resource.
- Hiển thị filter chips bên dưới + nút "Clear all" + counter.

#### 4. Component dialogs được tách riêng
**`permission-manager.tsx`**:
- `EditPermissionDialog` — `max-w-2xl`, layout 2 cột:
  - Trái (read-only): code, method badge, scope, flags, created date, system warning
  - Phải (edit form): name, code (disabled khi system), description, active toggle
- `DeletePermissionDialog` — `max-w-md`, confirm đơn giản

**`user-manager.tsx`**:
- `UserPermissionDialog` — `max-w-6xl max-h-[92vh]`, layout 3-zone:
  - Header: avatar + thông tin user
  - Body: grid 2 panel `[260px_1fr]`
    - Left: Account Info, Draft Changes (counters +N/-N), Current Assignments
    - Right: Search/filter + expiry → list permissions có pagination → pagination bar
  - Footer: Cancel + Save permissions
- Item permission được **compact lại** (2 dòng, padding `px-3 py-1.5`, badges nhỏ `text-[10px]`),
  `permPageSize = 12`.

#### 5. Bộ lọc `UserPermissionDialog` hoạt động hoàn chỉnh
- Trước đây: `openPermDialog` pre-filter một lần khi mở → đổi filter trong dialog không re-filter.
- Bây giờ: Tách `filteredPermissions` qua `useMemo`, filter client-side theo TOÀN BỘ tiêu chí.
- `closePermDialog` reset `permFilters` về mặc định.

#### 6. Product detail dialog
- Thêm `getProduct(token, id)` → `GET /products/{id}` trong `product.api.ts`.
- `product-manager.tsx` mở dialog hiển thị fresh data (không dùng cache từ list).

---

## Quy ước thêm endpoint mới (checklist)

Khi thêm 1 endpoint controller bất kỳ:

- [ ] Thêm `[PermissionMeta(PermissionName = "...", Description = "...")]` trên action method.
- [ ] Nếu route có `{param}`, **không cần làm gì thêm** — `RoutePatternMatches` đã tự xử.
- [ ] Restart `AuthModule` → `PermissionSyncExtensions` tự seed bản ghi `Permission`.
- [ ] Vào UI Permission Manager để xác nhận record mới + gán cho user/role tương ứng.
- [ ] Nếu endpoint cần public, thêm `Public = PublicMode.Public` trong attribute.
