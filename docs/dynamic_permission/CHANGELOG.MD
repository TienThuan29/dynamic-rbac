# Changelog — Dynamic RBAC

> Tài liệu ghi lại các thay đổi đáng chú ý trong hệ thống Dynamic RBAC
> (`AuthModule` + `LocalGateway` + `MainModule` + `fe/`).

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
