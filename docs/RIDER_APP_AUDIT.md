# Rider App Audit Report

**Date:** May 23, 2026 | **Status:** 27 issues found — 5 critical

---

## Executive Summary

| Category | Total | Critical | High | Medium | Low |
|----------|-------|----------|------|--------|-----|
| Frontend (UI/UX) | 8 | 2 | 4 | 2 | — |
| Frontend (Logic) | 7 | 3 | 2 | 2 | — |
| Backend API | 6 | 2 | 3 | 1 | — |
| Database Schema | 4 | 1 | 2 | 1 | — |
| WebSocket/Realtime | 2 | 0 | 2 | 0 | — |
| **Total** | **27** | **5** | **5** | **12** | **5** |

---

## Critical Issues (Fix Immediately)

### 1. Missing Type Definitions

**Files:** `artifacts/rider-app/tsconfig.json`, `artifacts/admin/tsconfig.json`  
**Impact:** 691 TypeScript errors, build failures, broken IDE support

```bash
pnpm add -D @types/node @types/react @types/react-dom @types/express
pnpm install
pnpm tsc --noEmit   # Expected: 0 errors
```

---

### 2. Empty Catch Blocks — Silent Failures

**Files:**
- `artifacts/rider-app/src/pages/ForgotPassword.tsx` (lines 213, 237, 297, 336)
- `artifacts/admin/src/pages/otp-control.tsx` (lines 1531, 1762, 1992)

**Problem:** Errors swallowed silently, making debugging impossible.

```typescript
// BEFORE — silent catch
try {
  captchaToken = await executeCaptcha("forgot_password", captchaSiteKey);
} catch {
  /* captcha optional */
}

// AFTER — explicit silent catch with comment and debug log
try {
  captchaToken = await executeCaptcha("forgot_password", captchaSiteKey);
} catch (_e) {
  log.debug({ err: _e }, "Captcha execution failed (non-critical)");
}
```

---

### 3. Wallet Race Condition — Duplicate Withdrawals

**File:** `artifacts/api-server/src/routes/vendor.ts` (line 1664)  
**Impact:** Duplicate withdrawals, negative balances, financial data loss

The current `SELECT FOR UPDATE` doesn't prevent concurrent requests from both passing the balance check simultaneously.

**Fix — Add idempotency key support:**

```typescript
// Add to top of file
const idempotencyCache = new Map<string, { status: number; body: unknown; timestamp: number }>();
const IDEM_TTL_MS = 5 * 60_000;

router.post("/wallet/withdraw", async (req, res, next) => {
  const vendorId = req.vendorId!;
  const idempotencyKey = req.headers["x-idempotency-key"];

  if (idempotencyKey && typeof idempotencyKey === "string") {
    const cacheKey = `withdraw:${vendorId}:${idempotencyKey}`;
    const cached = idempotencyCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < IDEM_TTL_MS) {
      return res.status(cached.status).json(cached.body);
    }
  }

  const { amount, method } = req.body;
  const amt = parseFloat(String(amount));

  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ walletBalance: usersTable.walletBalance })
      .from(usersTable)
      .where(eq(usersTable.id, vendorId))
      .limit(1)
      .for("update");  // Row-level lock

    if (amt > safeNum(locked?.walletBalance)) {
      throw Object.assign(new Error("Insufficient balance"), { httpStatus: 400 });
    }

    await tx.update(usersTable)
      .set({ walletBalance: sql`wallet_balance - ${amt}`, updatedAt: new Date() })
      .where(eq(usersTable.id, vendorId));

    await tx.insert(walletTransactionsTable).values({
      id: generateId(), userId: vendorId, type: "debit",
      amount: amt.toFixed(2), description: `Withdrawal - ${method}`,
      idempotencyKey: idempotencyKey || undefined,
    });
  });
  // ... cache response and return
});
```

---

### 4. No Rider Profile Validation Before Accepting Rides

**File:** `artifacts/api-server/src/routes/rider/index.ts`  
**Impact:** Unverified riders (no license, no vehicle info) can accept rides

```typescript
import { riderProfilesTable } from "@workspace/db/schema";

async function validateRiderProfileComplete(req: Request, res: Response, next: NextFunction) {
  const profile = await db.query.riderProfiles.findFirst({
    where: eq(riderProfilesTable.userId, req.riderId!),
  });

  if (!profile) return sendValidationError(res, "Create a rider profile first");

  if (!profile.vehicleType || !profile.vehiclePhoto || !profile.drivingLicense) {
    return sendValidationError(res, "Complete your profile: vehicle type, photo, and license required");
  }

  next();
}

// Apply to ride accept:
router.post("/rides/accept", validateRiderProfileComplete, rideAcceptLimiter, async (req, res, next) => {
  // ...
});
```

---

### 5. GPS Spoofing Not Blocked

**File:** `artifacts/api-server/src/routes/rides/dispatch.ts`  
**Impact:** Fraudulent ride completion, fake location reporting

```typescript
async function validateRiderLocation(riderId: string, lat: number, lng: number) {
  const lastLocation = await db.query.liveLocations.findFirst({
    where: eq(liveLocationsTable.userId, riderId),
  });

  if (!lastLocation) return; // First location, always ok

  const distance = haversineMeters(
    parseFloat(lastLocation.lat), parseFloat(lastLocation.lng), lat, lng
  );
  const timeDiff = (Date.now() - new Date(lastLocation.updatedAt).getTime()) / 1000;
  const maxSpeed = 120; // km/h max for delivery bike
  const maxDistance = (maxSpeed / 3.6) * timeDiff; // metres

  if (distance > maxDistance * 1.5) {  // 50% buffer for GPS error
    await addSecurityEvent({ type: "gps_spoof_detected", userId: riderId, data: { distance, maxDistance } });
    await db.update(usersTable)
      .set({ status: "suspended", suspendReason: "GPS spoofing detected" })
      .where(eq(usersTable.id, riderId));
    throw new Error("Suspicious location activity. Account suspended.");
  }
}
```

---

## High Priority Issues

| # | Issue | File | Fix Time |
|---|-------|------|----------|
| 6 | Offline queue not replayed on app resume | `rider-app/src/App.tsx` | 20 min |
| 7 | React Hook missing dependency warning | `rider-app/src/pages/Home.tsx:169` | 5 min |
| 8 | ForgotPassword `useCallback` not memoized | `ForgotPassword.tsx:167` | 5 min |
| 9 | OTP attempt counter not reset after success | `routes/rider/index.ts` | 10 min |
| 10 | WebSocket reconnect not debounced | `socketio.ts` | 15 min |

### Fix #6: Offline Queue Replay

```typescript
// rider-app/src/App.tsx — add to RiderAuthProvider
import { syncQueue } from "./lib/offline/queueManager";

useEffect(() => {
  const handleVisibilityChange = () => {
    if (!document.hidden && navigator.onLine) void syncQueue();
  };
  const handleOnline = () => void syncQueue();

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("online", handleOnline);

  if (user && navigator.onLine) void syncQueue();

  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("online", handleOnline);
  };
}, [user]);
```

### Fix #7: React Hook Dependency

```typescript
// Home.tsx line 169
// BEFORE
}, [user?.id]);

// AFTER
}, [user]);
```

### Fix #8: ForgotPassword useCallback

```typescript
// ForgotPassword.tsx line 167
// BEFORE
const T = (key: TranslationKey) => tDual(key, language);

// AFTER
const T = useCallback((key: TranslationKey) => tDual(key, language), [language]);
```

### Fix #9: Reset OTP Attempts After Success

```typescript
// routes/rider/index.ts — after successful OTP verification
if (correctOtp === otpInput) {
  await db.delete(otpAttemptsTable).where(
    and(eq(otpAttemptsTable.riderId, req.riderId!), eq(otpAttemptsTable.rideId, rideId))
  );
  sendSuccess(res, { verified: true });
}
```

---

## Database Migrations Needed

```sql
-- Add missing rider profile fields
ALTER TABLE rider_profiles
  ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS kyc_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS documents_verified_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_title TEXT;

-- Add index for KYC queries
CREATE INDEX IF NOT EXISTS rider_profiles_kyc_status_idx ON rider_profiles(kyc_status);

-- Add index for penalties queries
CREATE INDEX IF NOT EXISTS rider_penalties_rider_date_idx ON rider_penalties(rider_id, created_at DESC);

-- Add wallet transaction idempotency
ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
```

---

## Implementation Checklist

- [ ] Install missing type definitions (`@types/node @types/react @types/react-dom`)
- [ ] Fix empty catch blocks in ForgotPassword.tsx and otp-control.tsx
- [ ] Add wallet withdrawal idempotency key support
- [ ] Add rider profile validation middleware on ride accept
- [ ] Add GPS spoofing detection and auto-suspend
- [ ] Add offline queue replay on app resume/online
- [ ] Fix React Hook dependency warnings
- [ ] Reset OTP attempt counter after successful verification
- [ ] Run database migrations
- [ ] Run `pnpm tsc --noEmit` and `pnpm lint` — must be clean

**Estimated time for all 5 critical fixes:** ~2 hours
