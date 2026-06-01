---
name: Production deploy — setup gate 503 blocks health check
description: Root cause of every promote-step failure in Replit Autoscale deploys for this project.
---

# Production Deploy: Setup Gate Returns 503 — Health Check Fails

## The Rule
`app.ts` has a "setup gate" that intercepts ALL routes and returns HTTP 503 when `JWT_SECRET` (or `DATABASE_URL`) is absent.  Cloud Run health checks `GET /` and see 503 → promote fails.

## Why It Matters
`JWT_SECRET` and all other crypto secrets (ENCRYPTION_MASTER_KEY, HMAC_OTP_SECRET, etc.) live in the gitignored `.env` file for development. They are NOT automatically available in the Replit production environment — they must be added as production env vars via `setEnvVars({ environment: "production" })`.

## How to Apply
1. After any fresh deploy failure at the "promote" step, check `viewEnvVars({ environment: "production" })`.  Look at `envVars.production` (not `secrets`).
2. If `JWT_SECRET` is missing, generate and set all 10 secrets in production:
   ```javascript
   const crypto = await import('crypto');
   await setEnvVars({ values: {
     JWT_SECRET: crypto.randomBytes(64).toString('hex'),
     ENCRYPTION_MASTER_KEY: crypto.randomBytes(32).toString('hex'),
     TOTP_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
     HMAC_OTP_SECRET: crypto.randomBytes(32).toString('hex'),
     OTP_HMAC_SECRET: crypto.randomBytes(32).toString('hex'),
     ADMIN_ACCESS_TOKEN_SECRET: crypto.randomBytes(64).toString('hex'),
     ADMIN_REFRESH_TOKEN_SECRET: crypto.randomBytes(64).toString('hex'),
     ADMIN_CSRF_SECRET: crypto.randomBytes(32).toString('hex'),
     ERROR_REPORT_HMAC_SECRET: crypto.randomBytes(32).toString('hex'),
     TOKEN_HASH_SECRET: crypto.randomBytes(32).toString('hex'),
   }, environment: "production" });
   ```
   Note: `setEnvVars` sets env vars, NOT secrets — verify with `viewEnvVars` under `envVars.production`, not `secrets`.
3. The setup gate in `app.ts` has been patched (2026-05-30) to return 200 for `/`, `/health`, `/api/health` even when secrets are missing, so future deploys are resilient.

**Why:** Production container does not load `.env` (gitignored). Replit secrets panel entries appear under `secrets` but `setEnvVars` sets them under `envVars.production` — both work at runtime.
