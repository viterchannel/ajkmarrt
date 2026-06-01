# @workspace/admin

React 19 + Vite 7 + Tailwind CSS 4 admin panel for AJKMart operations — inventory management, order fulfilment, vendor approval, rider management, financial reporting, and platform configuration.

## Features

- Full CRUD for products, orders, vendors, riders, and customers
- Real-time order tracking via Socket.IO
- Role-based admin access with TOTP 2FA
- Timing-override registry via `@workspace/admin-timing-shared`
- Dark/light mode with Radix UI primitives

## Local Dev

```bash
# From monorepo root:
PORT=3000 BASE_PATH=/admin pnpm --filter @workspace/admin run dev

# Or via the Replit "Admin Panel" workflow (port 3000)
```

Access at: `http://localhost:3000/admin/` (or via the Replit preview at `/admin/`)

## Required Environment Variables

| Variable | Description |
|---|---|
| `VITE_API_PROXY_TARGET` | API server URL — defaults to `http://127.0.0.1:5000` |

All auth is handled via the API server; no separate secrets needed in the Vite frontend.

## Port

`3000` — served at path `/admin/`

## Default Credentials (dev)

- Username: `superadmin`
- Password: `Admin@123`
