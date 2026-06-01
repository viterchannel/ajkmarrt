---
name: Refresh response envelope mismatch
description: Both token-refresh code paths read the wrong field from the server's sendSuccess envelope, causing every refresh attempt to be treated as auth_failed and immediately logging the user out.
---

## The rule

When reading the server's refresh response, always unwrap the `sendSuccess` envelope before accessing the token field. The server sends:

```json
{ "success": true, "data": { "token": "eyJ...", "expiresAt": "..." } }
```

**Why:** `sendSuccess(res, { token, expiresAt })` wraps the payload in `{ success, data: {...} }`. Both `createApiFetcher.doRefresh` and `useTokenRefresh.doRefresh` were reading `json.token` (top-level) and `json.accessToken` / `json.data.accessToken` — all `undefined`. This made every refresh return `"auth_failed"`, triggering `onRefreshFailed(false)` → `triggerLogout("session_expired")` immediately after login.

**How to apply:**

In any code that parses the refresh endpoint response, unwrap the envelope:
```typescript
const json = await res.json();
const inner = (json.data && typeof json.data === "object") ? json.data : json;
const token = inner.token ?? inner.accessToken ?? null;
```

Files fixed: `lib/api-client-react/src/createApiFetcher.ts` (doRefresh), `lib/auth-react/src/hooks/useTokenRefresh.ts` (doRefresh + mount effect).

## Race condition also fixed

`useTokenRefresh` mount effect was scheduling a delay-0 refresh when an existing token was already expired (`remaining <= 0`). This raced with the startup `validateToken → 401 → _resiClient.refresh` flow, causing the server's mutex to return "Token already refreshed" to the second caller, which was then mis-classified as `auth_failed`.

Fix: skip scheduling in the mount effect when `remaining === 0`; let the startup flow handle expired tokens exclusively.
