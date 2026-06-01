---
name: Security helpers fail-open audit
description: Audit findings for security.ts VPN/Tor/blocked-IP helpers — which are fail-open vs fail-closed.
---

Audited `apps/api-server/src/middleware/security.ts` (~lines 280–460):

| Helper | `true` means | On error returns | Verdict |
|---|---|---|---|
| `_isVpnOrProxy(ip)` | is VPN → BLOCK | `false` (allow) | Acceptable — circuit breaker (3-failure, 5-min cooldown) prevents cascade; local/private IPs bypassed before fetch |
| `isIPBlocked(ip)` | is blocked → BLOCK | `false` (allow) | Acceptable — in-memory `blockedIPsCache` Set is checked first (line 441); DB query only for cache misses; returning `true` on DB error would cause DoS |
| `isAdminIpWhitelisted(ip)` | is whitelisted → ALLOW | `false` (deny) | ✓ Already fail-closed |
| `getBlockedIPList()` | — | returns in-memory cache | ✓ Correct fallback |
| `getActiveLockouts()` | — | returns `[]` | ✓ Observability only, not a security gate |

**Why:** `isIPBlocked` returning `false` on DB error is the correct choice. Returning `true` would block ALL IPs not yet in the in-memory Set during any transient DB failure, turning a DB blip into a site-wide lockout. The in-memory cache is populated at startup and updated on every `blockIP()` call, so the window of exposure is limited to IPs blocked after the last cache sync.

**How to apply:** No changes needed. Document and accept the current behaviour. If stricter guarantees are ever required, add a periodic background refresh of `blockedIPsCache` from the DB (every 60s) to minimise the window.
