---
name: Rider auth E2E & bypass map
description: Full login/session/logout flow for rider OTP auth; bypass method map; refresh cookie design; Bug 6 fix location.
---

## Login flow (phone OTP)
- `POST /auth/send-otp` → returns `{ otpRequired: true, devCode: "NNNNNN" }` when `ALLOW_DEV_OTP=true`
- `devCode` is the REAL generated OTP exposed in dev only — NOT "0000"; must use the actual code
- `POST /auth/verify-otp { phone, otp: devCode }` → returns `{ accessToken, refreshToken }` + sets `ajkmart_rider_refresh` HttpOnly Secure cookie (path `/api/auth`)
- If a bypass is ACTIVE (per_user / global / whitelist) → `send-otp` itself returns `{ otpRequired: false, accessToken, refreshToken }` — no verify-otp needed

## Token refresh design
- `POST /auth/refresh` ONLY accepts refresh token from HttpOnly cookie — body token silently rejected (security by design)
- Cookie name: `ajkmart_rider_refresh`; cookie path: `/api/auth`; Secure flag set when `NODE_ENV=production || REPLIT_DEV_DOMAIN` is set
- Consequence: curl over HTTP can't test refresh (Secure cookie policy); browser via HTTPS proxy works correctly
- Refresh rotates the token on each use (token family breach detection active)

## Logout
- `POST /auth/logout` was MISSING entirely — added to `apps/api-server/src/routes/auth/refresh.ts`
- Accepts `refreshToken` in body OR HttpOnly cookie; revokes in DB + clears cookie
- JTI blacklisting requires Redis (not configured in dev) → access token stays valid for TTL (~15 min)
- Refresh token IS immediately revoked → no new access tokens obtainable (primary security control)

## 5 OTP bypass methods
| # | Mechanism | Endpoint | Effect on send-otp |
|---|-----------|----------|--------------------|
| 1 | `ALLOW_DEV_OTP=true` env | — | `otpRequired:true` but `devCode` exposed; verify-otp accepts it |
| 2 | Per-user bypass | `POST /admin/users/:id/otp/bypass { minutes }` | `otpRequired:false`, token issued directly |
| 3 | `security_otp_bypass=on` | `PUT /admin/platform-settings { settings:[{key,value}] }` | Password+OTP 2FA login only — NOT phone OTP send-otp path |
| 4 | Timed global disable | `POST /admin/otp/disable { minutes, reason }` | `otpRequired:false`, token issued directly for all users |
| 5 | Whitelist | `POST /admin/whitelist { identifier, bypassCode (6 digits) }` | `otpRequired:false`, token issued directly |

**Why:** Method 3 (`security_otp_bypass`) is checked in `auth-common.ts` for unified password login 2FA, NOT in `checkOTPBypass()` in `auth-otp-bypass.ts`. Method 4 (`otp_global_disabled_until`) is the correct global bypass for phone OTP.

## Admin API notes
- `PUT /admin/platform-settings` body format: `{ settings: [{key: "...", value: "..."}] }` (array, not object)
- Whitelist bypassCode must be exactly 6 digits (regex enforced)
- Per-user bypass uses `{ minutes: X }` (not hours)
- CSRF: POST /admin/auth/login sets `csrf_token` cookie; pass as `X-CSRF-Token` header on all admin mutations
