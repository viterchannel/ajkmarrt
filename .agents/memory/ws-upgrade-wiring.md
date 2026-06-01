---
name: http-proxy-middleware v3 WebSocket upgrade wiring
description: How to wire WS upgrade handlers in http-proxy-middleware v3 with Express
---

**Rule:** In http-proxy-middleware v3, `ws: true` alone does NOT handle WebSocket upgrades. Must explicitly call `server.on('upgrade', middleware.upgrade)`.

**Implementation pattern used:**
- Module-level array `_wsUpgradeHandlers` in `app.ts` (avoids changing createServer return type)
- Exported via `getWsUpgradeHandlers()` function
- In devProxies loop: `if (p.ws && typeof pm.upgrade === "function") _wsUpgradeHandlers.push(pm.upgrade)`
- In `index.ts` after `hs.listen()`: `for (const h of getWsUpgradeHandlers()) hs.on('upgrade', h)`

**Why module-level array:** Changing createServer() return type to include wsUpgradeHandlers would require updating ~15 caller files. Module-level array is a clean side-channel.

**Files:** `src/app.ts` (array + export), `src/index.ts` (wiring after listen).
