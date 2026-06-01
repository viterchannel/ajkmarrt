# Registration Guide

How to register users (vendor, rider, customer) in development and testing environments — including OTP bypass methods and technical details.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [4 OTP Bypass Methods](#4-otp-bypass-methods)
3. [Step-by-Step Registration Flows](#step-by-step-registration-flows)
4. [Technical Details](#technical-details)
5. [Test Accounts](#test-accounts)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start

No real SMS API needed. Pick a method:

| Method | Setup | Best For |
|--------|-------|----------|
| **devCode** | 0 min | Quick personal test |
| **Whitelist** | 2 min | QA team / multiple accounts |
| **Per-User Bypass** | 1 min | Helping stuck users |
| **Global Suspend** | 30 sec | Simulate SMS outage |

Minimum requirements:
```bash
# Check dev mode is active
echo $NODE_ENV   # Expected: development

# Start backend
pnpm --filter @workspace/api-server run dev
```

---

## 4 OTP Bypass Methods

### Method 1: devCode (Fastest)

When you call `POST /api/auth/send-otp` in development mode, the actual OTP code is returned in the response body:

```json
{
  "success": true,
  "otpRequired": true,
  "channel": "sms",
  "devCode": "654321"
}
```

Use `654321` (or whatever code is returned) in the OTP field. A new code is generated each time.

**Requirements:** `NODE_ENV=development` (or `staging`)  
**Production:** Never returned

### Method 2: Whitelist Bypass (Team/QA)

Add a phone number to the whitelist in the admin panel. That number will always bypass OTP.

**Setup (once):**
1. Go to `/admin/otp-control`
2. Under "Whitelist Bypass" → click "+ Add"
3. Fill in:
   - Identifier: `03001234567`
   - Bypass Code: `123456`
   - Active: ✅
   - Expires: (optional, e.g., 1 month out)
4. Save

**Testing (repeat any number of times):**
- Use `03001234567` as phone → `POST /api/auth/send-otp` returns `{ otpRequired: false }`
- App skips OTP screen automatically

**Or via SQL:**
```sql
INSERT INTO whitelist_users (id, identifier, identifier_type, bypass_code, is_active, label, created_at, expires_at)
VALUES (
  'wl_' || gen_random_uuid()::text,
  '03001234567', 'phone', '123456', true, 'QA Test Vendor',
  NOW(), NOW() + INTERVAL '1 month'
);
```

**Production safety:** Codes `000000` and `123456` are automatically rejected if `NODE_ENV=production`.

### Method 3: Per-User Bypass (Support)

Grant a temporary OTP bypass to a specific user via the admin panel:

1. Go to `/admin/otp-control` → "Per-User OTP Bypass"
2. Search for user by phone
3. Click "Grant Bypass" → select duration (e.g., 1 hour)
4. User can now log in without receiving an OTP

**Or via API:**
```http
POST /api/admin/users/{userId}/otp/bypass
{ "minutes": 60 }
```

### Method 4: Global OTP Suspension (Emergency/Testing)

Suspends OTP for all users simultaneously:

1. Go to `/admin/otp-control` → "Global OTP Suspension"
2. Click "1 hour"
3. Enter reason: `"Testing registration flow"`
4. Click "Confirm Suspension"

All users can now register and log in without OTP until the timer expires (or you click "Restore Now").

---

## Step-by-Step Registration Flows

### Vendor Registration (using devCode)

```
1. Open Vendor App:  http://localhost:3001/vendor

2. Click "Register"

3. Phone step:
   Enter: 03001234567
   Click: "Next"

4. OTP step:
   Click: "Send OTP"
   Backend returns: { "devCode": "654321" }
   Enter OTP: 654321
   Click: "Verify"

5. Full Name: "Test Vendor"
   Click: "Next"

6. City: Karachi
   Click: "Next"

7. Password: VendorPass@123   (min 8 chars, uppercase, special char)
   Click: "Register"

✅ Vendor account created (roles: ["vendor"], is_verified: false — pending admin approval)
```

### Rider Registration (using Whitelist)

```
SETUP (admin panel, once):
  Phone: 03001234568 | Code: 123456 | Active: ✅

REGISTRATION:
1. Open Rider App: http://localhost:3002/rider
2. Phone: 03001234568
3. "Send OTP" → backend returns { otpRequired: false } → screen skips OTP
4. Name: "Test Rider" → City → Password: RiderPass@123
✅ Done
```

### Customer Registration (using Global Suspend)

```
1. Admin: Suspend OTP for 1 hour
2. Open Customer App
3. Phone: 03001234569
4. "Send OTP" → skipped
5. Complete registration normally
✅ Done
```

---

## Technical Details

### How devCode Works

```typescript
// otp.verify.ts
function isDevMode(): boolean {
  return process.env.NODE_ENV === "development" || process.env.NODE_ENV === "staging";
}

return {
  success: true,
  otpRequired: true,
  channel: delivery.usedChannel,
  expiresAt,
  ...(isDevMode() && { devCode: code }),  // ← only in dev/staging
};
```

### Registration API Endpoint

```http
POST /api/auth/register
Content-Type: application/json

{
  "phone": "+923001234567",
  "otp": "654321",
  "fullName": "Test User",
  "city": "Karachi",
  "password": "Password@123",
  "userType": "vendor"
}

Response (success):
{
  "success": true,
  "data": {
    "user": {
      "id": "user_xxx",
      "phone": "+923001234567",
      "roles": ["vendor"],
      "is_verified": false,
      "approval_status": "pending"
    },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

### Curl Testing

```bash
# 1. Send OTP
curl -X POST http://localhost:5000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+923001234567", "identifierType": "phone", "otpType": "auth"}' | jq .

# 2. Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+923001234567",
    "otp": "654321",
    "fullName": "Test Vendor",
    "city": "Karachi",
    "password": "TestVendor@123",
    "userType": "vendor"
  }' | jq .
```

### OTP Backend Check Flow

```
POST /api/auth/send-otp { phone: "03001234567" }
            ↓
Check: user.otpBypassUntil > NOW() ?
  ✅ → Return { otpRequired: false }
  ❌ → Continue
            ↓
Check: platform_settings[otp_global_disabled_until] > NOW() ?
  ✅ → Return { otpRequired: false }
  ❌ → Continue
            ↓
Check: phone in whitelist_users (active) ?
  ✅ → Return { otpRequired: false }
  ❌ → Continue
            ↓
Generate OTP → Deliver via SMS/WhatsApp → Return { otpRequired: true, devCode? }
```

---

## Test Accounts

```
VENDOR:
  Phone:    03001234567
  Name:     Test Vendor 1
  Password: TestVendor@123

RIDER:
  Phone:    03001234568
  Name:     Test Rider 1
  Password: TestRider@123

CUSTOMER:
  Phone:    03001234569
  Name:     Test Customer 1
  Password: TestCustomer@123
```

Password requirements: minimum 8 characters, at least one uppercase letter, one special character.

---

## Troubleshooting

### devCode not in response

```bash
# Check 1: NODE_ENV must be "development"
echo $NODE_ENV

# Check 2: Look for dev mode log message
# Should see: "[DEV MODE] AJKMart API — running without vault"

# Check 3: Restart backend, try again
pnpm --filter @workspace/api-server run dev
```

### Whitelist not working

```sql
-- Verify entry exists and is active
SELECT identifier, bypass_code, is_active, expires_at
FROM whitelist_users
WHERE identifier = '03001234567';
```

Common fixes:
- Phone format must be consistent — use `03001234567` OR `+923001234567`, not mixed
- `is_active` must be `true`
- `expires_at` must be in the future (or null)

### "Already Registered" error

Use a different phone number, or delete the existing user in the admin panel and re-register.

### Admin panel not loading

- URL: `http://localhost:3000` (admin runs on port 3000)
- OTP Control page: `http://localhost:3000/otp-control`
- Ensure admin backend is running: `pnpm --filter @workspace/api-server run dev`
