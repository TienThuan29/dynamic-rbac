# Dynamic RBAC

Dynamic RBAC is a demo dynamic authorization system for a modular backend architecture. The project separates authentication, API gateway, business modules, and an admin frontend to show how API endpoints can be discovered automatically, synchronized into a permissions database, and enforced at the gateway before requests reach downstream services.

## Main Components

| Component | Path | Default Port | Role |
| --- | --- | --- | --- |
| LocalGateway | `be/LocalGateway` | `5000` | YARP-based API gateway that calls the Gatekeeper to validate JWTs and permissions before forwarding requests |
| AuthModule | `be/AuthModule` | `5001` | Handles login, JWT issuing, permissions, permission groups, and user permissions |
| MainModule | `be/MainModule` | `5002` | Demo business module, currently exposing Product CRUD APIs |
| Frontend | `fe` | Vite default | React UI for login and product/permission/user management |
| PostgreSQL | `be/docker-compose.yml` | `5432` | Shared database, default database name is `AppDb` |

## Request Flow

1. The client logs in through `POST /api/auth/login` and receives a JWT.
2. The client calls APIs through `LocalGateway` at `http://localhost:5000`.
3. The gateway sends the `Authorization` header, HTTP method, and path to `AuthModule /api/gatekeeper`.
4. The Gatekeeper validates the JWT, finds the permission record for the route, and checks exact permissions or wildcard `[resource]:admin` permissions.
5. If access is allowed, the gateway injects `X-UserId`, `X-AccountId`, `X-Email`, and `X-Role` headers, then forwards the request to the downstream service.

When `AuthModule` or `MainModule` starts, `SyncEndpointPermissionsAsync()` scans controllers decorated with `[PermissionMeta]` and inserts new endpoints into the `permissions` table. The sync process only inserts new records, so admin-edited metadata is not overwritten on restart.

## Tech Stack

- Backend: .NET 8, ASP.NET Core, Entity Framework Core, Npgsql
- Gateway: YARP Reverse Proxy
- Auth: JWT Bearer
- Database: PostgreSQL 17 Alpine
- Frontend: React 19, Vite, TypeScript, Tailwind CSS, Radix UI

## Requirements

- .NET SDK 8
- Node.js and npm
- Docker Desktop or a local PostgreSQL instance
- EF Core CLI if you want to run migrations with `dotnet ef`

```powershell
dotnet tool install --global dotnet-ef
```

## Database Setup

Create `be/.env`:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=AppDb
```

Start PostgreSQL:

```powershell
cd be
docker compose up -d
cd ..
```

Run migrations for `AuthModule` and `MainModule`:

```powershell
cd be\AuthModule
dotnet ef database update

cd ..\MainModule
dotnet ef database update

cd ..\..
```

Seed demo data if needed:

```powershell
Get-Content be\AuthModule\Dal\Migrations\seed_test_accounts.sql | docker exec -i postgres_db psql -U postgres -d AppDb
Get-Content be\MainModule\Dal\Migrations\seed_products.sql | docker exec -i postgres_db psql -U postgres -d AppDb
```

Seed accounts:

| Email | Entra ID Object ID | Role |
| --- | --- | --- |
| `test.user1@demo.local` | `entra-test-001` | `User` |
| `test.user2@demo.local` | `entra-test-002` | `Admin` |

## Run Backend

Open three separate terminals:

```powershell
cd be\AuthModule
dotnet run
```

```powershell
cd be\MainModule
dotnet run
```

```powershell
cd be\LocalGateway
dotnet run
```

Default URLs:

- Gateway: `http://localhost:5000`
- AuthModule: `http://localhost:5001`
- MainModule: `http://localhost:5002`
- MainModule Swagger: `http://localhost:5002/swagger`

## Run Frontend

```powershell
cd fe
npm install
npm run dev
```

The Vite dev server proxies API calls with this default mapping:

- `/main-api` -> `http://localhost:5002`
- `/auth-api` -> `http://localhost:5001`

You can override these URLs with environment variables:

```powershell
$env:VITE_MAIN_API_BASE_URL="http://localhost:5002"
$env:VITE_AUTH_API_BASE_URL="http://localhost:5001"
npm run dev
```

## Quick API Test

Log in with the seeded admin account:

```powershell
$login = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:5000/api/auth/login" `
  -ContentType "application/json" `
  -Body '{"email":"test.user2@demo.local","entraIdObjectId":"entra-test-002"}'

$token = $login.accessToken
```

Call the product list through the gateway:

```powershell
Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:5000/api/products?page=1&pageSize=20" `
  -Headers @{ Authorization = "Bearer $token" }
```

## Main APIs

| Group | Endpoint |
| --- | --- |
| Auth | `POST /api/auth/login` |
| Internal Gatekeeper | `POST /api/gatekeeper` |
| Permissions | `GET /api/permissions`, `GET /api/permissions/resources`, `GET/PUT/DELETE /api/permissions/{id}` |
| Permission Groups | `GET/POST /api/permission-groups`, `GET/PUT/DELETE /api/permission-groups/{id}` |
| User Permissions | `GET /api/users/accounts`, `GET /api/users/account/{accountId}`, `POST /api/users/assign`, `POST /api/users/assign-by-group` |
| Products | `GET/POST /api/products`, `GET/PUT/DELETE /api/products/{id}`, `PATCH /api/products/{id}/stock` |

Prefer calling APIs through the gateway (`http://localhost:5000`) so requests go through the authorization flow.

## Dynamic Permissions

Permission codes can be declared manually or generated automatically by convention:

| Route | Method | Example Code |
| --- | --- | --- |
| `/api/products` | `GET` | `products:list` |
| `/api/products/{id:guid}` | `GET` | `products:read` |
| `/api/products` | `POST` | `products:create` |
| `/api/products/{id:guid}` | `PUT` | `products:update` |
| `/api/products/{id:guid}` | `DELETE` | `products:delete` |
| `/api/products/{id:guid}/stock` | `PATCH` | `products:patch_stock` |

Wildcard permission `[resource]:admin` grants full access to a resource. For example, `products:admin` grants access to all `/api/products/*` endpoints.

## Build Checks

Backend:

```powershell
dotnet build be\AuthModule\AuthModule.csproj
dotnet build be\MainModule\MainModule.csproj
dotnet build be\LocalGateway\LocalGateway.csproj
```

Frontend:

```powershell
cd fe
npm run lint
npm run build
```

## Additional Documentation

- [Dynamic Permission Design](docs/dynamic_permission/DYNAMIC_PERMISSION_DESIGN.MD)
- [Gateway Architecture](docs/dynamic_permission/GATEWAY_ARCHITECTURE.MD)
- [Developer Cookbook](docs/dynamic_permission/DEVELOPER_COOKBOOK.MD)
- [Dynamic Permission Changelog](docs/dynamic_permission/CHANGELOG.MD)
