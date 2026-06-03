# API Gateway Admin Dashboard

React + Vite frontend for managing the backend demo entities:

- Products from `MainModule`
- Accounts, users, and permissions from `AuthModule`

## Run

```bash
npm install
npm run dev
```

The Vite dev server proxies API calls to the local backend modules:

- `/main-api` -> `http://localhost:5002`
- `/auth-api` -> `http://localhost:5001`

Override these with environment variables when needed:

```bash
VITE_MAIN_API_BASE_URL=http://localhost:5002 \
VITE_AUTH_API_BASE_URL=http://localhost:5001 \
npm run dev
```

## Verify

```bash
npm run lint
npm run build
```
