# OTP System Guide

Consolidated reference for the AJKMart OTP system — architecture, bypass mechanisms, emergency procedures, and code details.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [OTP Flow Architecture](#otp-flow-architecture)
3. [Bypass Layers](#bypass-layers)
4. [Emergency Procedures](#emergency-procedures)
5. [Admin Panel](#admin-panel)
6. [API Reference](#api-reference)
7. [Database Schema](#database-schema)
8. [Key Constants](#key-constants)
9. [Error Classes](#error-classes)

---

## System Overview

The OTP system has **4 layers of control**, checked in priority order:

```
Layer 1: Per-User Bypass     — Admin grants for individual users (customer support)
Layer 2: Global OTP Suspend  — Admin suspends for ALL users (SMS outage mitigation)
Layer 3: Whitelist Bypass    — Test accounts with preset bypass codes
Layer 4: Normal OTP          — 6-digit code via SMS/WhatsApp/email
```

Key characteristics:
- Brute-force protection: 5 failed attempts → 15-minute lockout
- Rate limiting: max 3 sends per hour per identifier
- Resend cooldown: 30 seconds between sends
- OTP TTL: 10 minutes
- All bypass events logged to `otp_bypass_audit` table

---

## OTP Flow Architecture

```
User Requests OTP
      ↓
sendOtp(identifier, identifierType)
      ↓
┌─────────────────────────────────────┐
│ STEP 1: Brute-Force Check           │
│ - Locked out? Max 5 failures        │
│ - Lockout: 15 minutes               │
└─────────────────────────────────────┘
      ↓
┌─────────────────────────────────────┐
│ STEP 2: Rate Limiting               │
│ - Max 3 sends per hour              │
└─────────────────────────────────────┘
      ↓
┌─────────────────────────────────────┐
│ STEP 3: Resend Cooldown             │
│ - Min 30 seconds between sends      │
└─────────────────────────────────────┘
      ↓
┌─────────────────────────────────────┐
│ STEP 4: checkOTPBypass() ⭐         │
│   Priority 1: Per-User Bypass       │
│   Priority 2: Global OTP Suspend    │
│   Priority 3: Whitelist Bypass      │
│   → Return {otpRequired: false}     │
└─────────────────────────────────────┘
      ↓
┌─────────────────────────────────────┐
│ STEP 5: Generate OTP Code           │
│ - 6-digit random, bcrypt hashed     │
│ - Stored in otp_tokens table        │
└─────────────────────────────────────┘
      ↓
┌─────────────────────────────────────┐
│ STEP 6: Deliver OTP                 │
│ - Channel: WhatsApp → SMS → Email   │
│ - Dev mode: devCode in response     │
└─────────────────────────────────────┘
```

**Files:**
| File | Purpose |
|------|---------|
| `artifacts/api-server/src/lib/auth-otp-bypass.ts` | `checkOTPBypass()` — bypass detection engine |
| `artifacts/api-server/src/modules/otp/otp.verify.ts` | Core send/verify logic |
| `artifacts/api-server/src/modules/otp/otp.deliver.ts` | SMS/WhatsApp delivery |
| `artifacts/api-server/src/modules/otp/otp.store.ts` | Database operations |
| `artifacts/api-server/src/modules/otp/otp.types.ts` | TypeScript interfaces |
| `artifacts/admin/src/pages/otp-control.tsx` | Admin UI |

---

## Bypass Layers

### Layer 1: Per-User Bypass

```typescript
// auth-otp-bypass.ts — Priority 1 (checked first)
const user = await db.query.usersTable.findFirst({
  where: and(
    eq(usersTable.phone, phone),
    gt(usersTable.otpBypassUntil, now)
  ),
  columns: { id: true, otpBypassUntil: true },
});

if (user && user.otpBypassUntil && user.otpBypassUntil > now) {
  return { isBypassed: true, reason: "per_user", expiresAt: user.otpBypassUntil };
}
```

- **Use case:** Customer support — user's SIM broken, account issues
- **Expires:** Automatically at set time (e.g., 1 hour)
- **Audit:** Logged in `otp_bypass_audit` table

### Layer 2: Global OTP Suspension

```typescript
// auth-otp-bypass.ts — Priority 2
const activeDisable = await db.query.platformSettingsTable.findFirst({
  where: and(
    eq(platformSettingsTable.key, "otp_global_disabled_until"),
    gt(platformSettingsTable.value, now.toISOString())
  ),
  columns: { value: true },
});

if (activeDisable?.value) {
  return { isBypassed: true, reason: "global", expiresAt: new Date(activeDisable.value) };
}
```

- **Use case:** SMS/WhatsApp provider outage — suspends OTP for ALL users
- **Expires:** Automatically at set time (auto-resume, no manual action needed)
- **Effect on new registrations:** `is_verified = false` (flagged for review)

### Layer 3: Whitelist Bypass

```typescript
// auth-otp-bypass.ts — Priority 3
const whitelisted = await db.query.whitelistUsersTable.findFirst({
  where: and(
    eq(whitelistUsersTable.identifier, phone),
    eq(whitelistUsersTable.isActive, true),
    or(isNull(whitelistUsersTable.expiresAt), gt(whitelistUsersTable.expiresAt, now))
  ),
  columns: { id: true, bypassCode: true, expiresAt: true },
});

if (whitelisted) {
  // PRODUCTION SAFETY: Block test codes in production
  if (
    process.env.NODE_ENV === "production" &&
    (whitelisted.bypassCode === "123456" || whitelisted.bypassCode === "000000")
  ) {
    logger.warn({ phone, code: whitelisted.bypassCode }, "[OTPBypass] Rejected test bypass code in production");
    // Fall through to normal OTP
  } else {
    return { isBypassed: true, reason: "whitelist", expiresAt: whitelisted.expiresAt || null, bypassCode: whitelisted.bypassCode };
  }
}
```

- **Use case:** Dev/QA testing without real SMS
- **Production safety:** Test codes `000000` and `123456` are automatically rejected in production

### Layer 4: Development OTP Code (devCode)

In `development` or `staging` mode, the actual OTP is returned in the API response:

```typescript
// otp.verify.ts
return {
  success: true,
  otpRequired: true,
  channel: delivery.usedChannel,
  expiresAt,
  ...(isDevMode() && { devCode: code }),  // Only in dev/staging
};
```

- **Not a bypass** — the OTP is still required, but the code is exposed for testing
- **Never appears in production** (`NODE_ENV === "production"` blocks it)

---

## Emergency Procedures

### SMS Provider Outage (Global Suspend)

```
1. Open: /admin/otp-control
2. Scroll to: "Global OTP Suspension" card
3. Click: "1 hour" (or choose custom duration)
4. Enter reason: "Twilio SMS outage — provider status page confirmed"
5. Click: "Confirm Suspension"
6. Done — users can login without OTP
7. Timer shows auto-resume countdown
8. When resolved: Click "Restore Now" OR wait for auto-resume
```

**Time to mitigation: ~30 seconds**

### Comparison: With vs Without Global Suspend

| Scenario | With Bypass System | Without |
|---|---|---|
| SMS Outage | 5-minute resolution | 90-minute code deploy |
| Customer stuck | 2-minute support fix | 24+ hour escalation |
| DDoS on SMS | Graceful degradation | Full business outage |
| Compliance audit | Complete audit trail | No documentation |

### When to Use Each Method

| Scenario | Use |
|---|---|
| SMS/WhatsApp provider down | Global OTP Suspension |
| Single user can't receive OTP | Per-User Bypass |
| QA team needs test accounts | Whitelist Bypass |
| Quick local development test | devCode (from API response) |

---

## Admin Panel

The `/admin/otp-control` dashboard provides:

- **Global OTP Status** — Active/Suspended badge with live countdown timer
- **Suspend OTP** — Duration picker: 30 min / 1 hour / 2 hours / 24 hours / custom
- **Per-User Bypass** — Search user by phone, grant bypass for 30 min–24 hours
- **Whitelist Management** — Add/remove/expire whitelist entries
- **Audit Log** — Full history of all bypass events with actor, time, and reason

---

## API Reference

### Suspend OTP Globally

```http
POST /api/admin/otp/disable
Authorization: Bearer <admin-token>

{
  "minutes": 60,
  "reason": "SMS gateway outage — Twilio incident"
}

Response 200:
{ "success": true, "data": { "disabledUntil": "2026-05-23T20:00:00Z" } }
```

### Restore OTP (Manual)

```http
DELETE /api/admin/otp/disable
Authorization: Bearer <admin-token>

Response 200:
{ "success": true }
```

### Grant Per-User Bypass

```http
POST /api/admin/users/{userId}/otp/bypass
Authorization: Bearer <admin-token>

{ "minutes": 60 }

Response 200:
{ "data": { "bypassUntil": "2026-05-23T20:00:00Z" } }
```

### Send OTP (User-facing)

```http
POST /api/auth/send-otp
{ "phone": "03001234567", "identifierType": "phone", "otpType": "auth" }

Response (normal):
{ "success": true, "otpRequired": true, "channel": "sms", "expiresAt": "...", "devCode": "654321" }

Response (bypass active):
{ "success": true, "otpRequired": false }
```

---

## Database Schema

```sql
-- Per-user bypass
users
  otpBypassUntil: TIMESTAMP   -- When bypass expires (null = no bypass)

-- Global suspension
platform_settings
  key: "otp_global_disabled_until"
  value: ISO 8601 timestamp (e.g. "2026-05-23T20:00:00Z")

-- Whitelist bypass
whitelist_users
  id: UUID
  identifier: phone or email
  bypassCode: 6-digit code
  isActive: BOOLEAN
  expiresAt: TIMESTAMP (optional)

-- Audit trail
otp_bypass_audit
  id: UUID
  eventType: "login_otp_bypass" | "otp_send_bypassed" | "login_per_user_bypass" | ...
  userId: UUID (nullable)
  phone: string
  ip: string
  bypassReason: "per_user" | "global" | "whitelist"
  metadata: JSON
  created_at: TIMESTAMP

-- OTP tokens
otp_tokens
  identifier: phone or email
  hashedCode: bcrypt hash
  expiresAt: TIMESTAMP
  usedAt: TIMESTAMP (nullable)
  attempts: INTEGER
```

### Add Whitelist Entry (SQL)

```sql
INSERT INTO whitelist_users (id, identifier, identifier_type, bypass_code, is_active, label, created_at, expires_at)
VALUES (
  'wl_' || gen_random_uuid()::text,
  '03001234567', 'phone', '123456', true, 'QA Test Account',
  NOW(), NOW() + INTERVAL '1 month'
);
```

---

## Key Constants

```typescript
// otp.config.ts
export const OTP_CONFIG = {
  CODE_LENGTH: 6,
  CODE_TTL_MS: 10 * 60 * 1000,          // 10 minutes
  MAX_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000,   // 15 minutes
  MAX_SEND_PER_HOUR: 3,
  RESEND_COOLDOWN_MS: 30 * 1000,         // 30 seconds
  HASH_ROUNDS: 10,                        // bcrypt rounds
};
```

---

## Error Classes

```typescript
// otp.types.ts
export class OtpBlockedError extends Error {
  constructor(message: string, public unlocksAt: Date) { super(message); }
}
export class OtpExpiredError extends Error { }
export class OtpInvalidError extends Error { }
export class OtpRateLimitError extends Error {
  constructor(message: string, public retryAfterMs: number) { super(message); }
}
```

---

**Key rule:** Do NOT remove `checkOTPBypass()` from `auth-otp-bypass.ts`. It is critical infrastructure — global OTP suspension, per-user bypass, and whitelist bypass all flow through this function. Without it, an SMS outage becomes a full business outage requiring a code deploy at 2 AM.
