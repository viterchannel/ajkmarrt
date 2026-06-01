# @workspace/rider-app

React 19 + Vite 7 PWA for AJKMart delivery riders — order pickup/delivery workflow, live map tracking, earnings, and shift management. Capacitor-enabled for Android.

## Features

- Real-time order assignment via Socket.IO
- GPS-based live map with pickup/drop navigation
- Shift start/end with earnings summary
- OTP-verified delivery confirmation
- Offline-capable PWA (service worker)
- Capacitor build target for Android (`pnpm run build:cap`)

## Local Dev

```bash
# From monorepo root:
PORT=3002 BASE_PATH=/rider pnpm --filter @workspace/rider-app run dev

# Or via the Replit "Rider App" workflow (port 3002)
```

Access at: `http://localhost:3002/rider/` (or via the Replit preview at `/rider/`)

## Required Environment Variables

| Variable | Description |
|---|---|
| `VITE_API_PROXY_TARGET` | API server URL — defaults to `http://127.0.0.1:5000` |

## Port

`3002` — served at path `/rider/`
