
---

## 13. Azure Deployment

### 13.1. Infrastructure Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    AZURE API MANAGEMENT                         │
│                      (apimthuanntdev)                           │
│                                                                  │
│   /auth-api/*    → AuthModule (Gatekeeper)                     │
│   /products-api/* → MainModule (via Gatekeeper)                 │
└──────────────────────────┬────────────────────────────────────┘
                           │ Internal HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              CONTAINER APPS ENVIRONMENT (env-swo-core)            │
│                                                                  │
│   ┌─────────────────────┐    ┌─────────────────────┐           │
│   │   api-service-1     │    │   api-service-2     │           │
│   │   (AuthModule)      │    │   (MainModule)      │           │
│   │   Port: 8080        │    │   Port: 8080        │           │
│   └─────────────────────┘    └─────────────────────┘           │
│                                                                  │
│   Internal Ingress: Chỉ APIM được gọi, không public             │
└──────────────────────────┬────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│           AZURE DATABASE FOR POSTGRESQL FLEXIBLE SERVER          │
│                    (pg-tienthuan-db)                           │
│                                                                  │
│   Shared database: accounts, users, permissions, tokens, etc.    │
└─────────────────────────────────────────────────────────────────┘
```

### 13.2. Deployment Script

Xem [`DEPLOY_AZURE.md`](../deployment/DEPLOY_AZURE.md) để biết chi tiết về deployment flow và troubleshooting.

### 13.3. Environment Variables (Azure)

**AuthModule:**
```bash
ConnectionStrings__DefaultConnection=Host=<db-host>;Port=5432;Database=postgres;Username=<user>;Password=<pass>;Ssl Mode=Require
JWT_SECRET=<32+ char secret>
JWT_ISSUER=swovnai
JWT_AUDIENCE=swovnai
```

**MainModule:**
```bash
ConnectionStrings__DefaultConnection=Host=<db-host>;Port=5432;Database=postgres;Username=<user>;Password=<pass>;Ssl Mode=Require
```

### 13.4. Permission Sync on Startup

Khi AuthModule/MainModule khởi động trên Azure:
1. `SyncEndpointPermissionsAsync()` chạy tự động
2. Scan tất cả API endpoints
3. Insert permission mới vào database
4. Admin có thể gán quyền qua UI sau đó
