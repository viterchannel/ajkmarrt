---
name: WS HMR proxy limitation on Replit
description: Vite HMR WebSocket fails through the API server proxy; workarounds and their side effects
---

**Situation:** All three Vite apps (admin :3000, vendor :3001, rider :3002) are proxied through the API server at port 5000. Browser HMR WS connects to `wss://domain/vendor/?token=...` → API proxy → port 3001. Vite returns 400.

**Root cause:** Vite's WS HMR server listens at `/` (no prefix), but the proxy forwards the full `/vendor/?token=...` path. The Vite server doesn't recognise `/vendor/` as a valid WS endpoint.

**Failed fix attempt:** Setting `hmr.path: basePath + "/"` in vite.config.ts caused the path to be DOUBLED (`/vendor/vendor/?token=...`) because Vite prepends the base to hmrPath internally.

**Current state:** The WS 400 error is cosmetic in development — the app loads and functions correctly. The Vite client keeps retrying silently. This is acceptable for a dev-only proxy setup.

**Why leave it:** Stripping the prefix via pathRewrite would break HTTP asset serving (Vite expects full `/vendor/...` paths for assets). A proper fix requires split pathRewrite logic for WS vs HTTP or direct Vite port exposure.
