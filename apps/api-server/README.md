# @workspace/api-server

Express 5 / Node.js 20 unified backend for all AJKMart clients — admin panel, vendor app, rider app, and mobile customer app.

## Features

- REST API with Swagger UI at `/api-docs`
- JWT + OTP + OAuth2 multi-method authentication
- Drizzle ORM + PostgreSQL
- Socket.IO real-time events
- File uploads (local disk in dev, S3-compatible in prod)
- Role-based access control (customer, vendor, rider, admin)

## Local Dev

```bash
# From monorepo root:
PORT=5000 pnpm --filter @workspace/api-server run dev

# Or via the Replit "Start application" workflow (port 5000)
```

## Required Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (auto-set by Replit) |
| `JWT_SECRET` | 64-byte JWT signing key |
| `ADMIN_ACCESS_TOKEN_SECRET` | Admin JWT signing key |
| `ENCRYPTION_MASTER_KEY` | AES-256 data encryption key |

Generate all secrets once: `node scripts/setup-replit.mjs`

Optional variables (SMS, push, storage, OAuth) are listed in the root `replit.md`.

## Port

`5000` — proxies `/admin`, `/vendor`, `/rider` to the respective Vite dev servers.

## API Docs

`GET /api-docs` — Swagger UI (available while server is running)

`GET /api/health` — `{ status: "ok" }`
