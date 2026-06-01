# @workspace/vendor-app

React 19 + Vite 7 + Tailwind CSS 4 web app for AJKMart vendors — product listing, order management, inventory tracking, and earnings overview.

## Features

- Product catalogue management (create, edit, publish, archive)
- Real-time order queue with accept/reject flow
- Inventory stock level alerts
- Earnings and payout dashboard
- Capacitor build target for Android PWA (`pnpm run build:cap`)

## Local Dev

```bash
# From monorepo root:
PORT=3001 BASE_PATH=/vendor pnpm --filter @workspace/vendor-app run dev

# Or via the Replit "Vendor App" workflow (port 3001)
```

Access at: `http://localhost:3001/vendor/` (or via the Replit preview at `/vendor/`)

## Required Environment Variables

| Variable | Description |
|---|---|
| `VITE_API_PROXY_TARGET` | API server URL — defaults to `http://127.0.0.1:5000` |

## Port

`3001` — served at path `/vendor/`
