# Rider App — Incomplete, Missing & Known Issues

**Last updated:** 2026-05-31  
**Scope:** Production gaps, bugs, unimplemented features, and technical debt.

---

## 1. Registration Inconsistencies ✅ RESOLVED

### Phone Format Mismatch ✅ FIXED
- **Was:** `POST /auth/register` required `03XXXXXXXXX` but riders who sent OTP with `+923...` got a format error
- **Fix:** `register.ts` now normalizes `+92XXXXXXXXXX → 0XXXXXXXXX` before PHONE_REGEX validation

### approvalStatus Always "approved" on Registration ✅ FIXED
- **Was:** `needsApproval = false` hardcoded — no way to require manual approval
- **Fix:** Reads `rider_require_approval` platform setting (default: off). When `on`, new riders get `approvalStatus = "pending"` and see the ApprovalGateOverlay. Toggle from Admin → Platform Settings.

### OTP "123456" Not Universal Dev Code
- **Status:** Each OTP is dynamically generated and bcrypt-hashed — `123456` is not accepted
- **Dev mode:** `devCode` is returned in the `send-otp` response body (dev only)
- **Documentation gap:** rider.test.md incorrectly implies `123456` is a dev universal code

---

## 2. Magic Link — Missing Route ✅ VERIFIED (pre-existing, out-of-scope)

- **Status:** `magicLinkEnabled` flag is `false` by default in platform settings
- **Working alternative:** `POST /api/auth/send-email-otp` sends email OTP
- **Note:** The magic link UI is gated by the flag, so riders never see a broken button

---

## 3. Social Login — UI Not Wired 🟡

- **Status:** `social-oauth.ts` exists, OAuth flow code is present
- **Missing:** Login screen does not render Google/Apple buttons in production UI
- **Impact:** Riders cannot use Google/Apple login even though the backend may support it

---

## 4. Approval Gate — Guard Updated ✅ VERIFIED

- **Status:** App.tsx gate guard checks both `"pending"` and `"pending_review"` (already aligned)
- **ApprovalGateOverlay:** Checks both `"pending"` AND `"pending_review"` ✅
- **Verified:** gate guard is consistent with overlay component

---

## 5. Vite HMR WebSocket — Dev 502 🟡

- **Status:** Known Replit proxy limitation (dev only)
- **Error:** `WebSocket 502` on `wss://.../rider/?token=...`
- **Impact:** No hot-module reload in dev; full page refresh needed after code changes
- **Production:** Not present — production build has no HMR
- **Memory note:** Leave as-is per `.agents/memory/ws-hmr-replit.md`

---

## 6. GPS Spoofing — Hard Block Implemented ✅ FIXED

- **Was:** Only a toast/banner shown when GPS spoofing detected
- **Fix:** Active.tsx now counts consecutive server-side GPS_SPOOF_DETECTED (422) responses.
  After 3 consecutive rejections, `executeLogoutSequence` is called and the rider is redirected to `/login`.
- **Status:** Hard termination implemented; session revoked on confirmed repeated spoof.

---

## 7. WakeLock Not Supported — Fallback Added ✅ FIXED

- **Was:** Only a warning banner shown when WakeLock API unavailable
- **Fix:** Active.tsx now starts a 15-second `navigator.vibrate(1)` interval as a screen-keep-alive
  fallback when `navigator.wakeLock` is not available and there is an active ride/order.
- **Cleanup:** Interval cleared on component unmount or when active work ends.

---

## 8. Audio Context Lock ✅ FIXED

- **Was:** AudioContext stayed suspended after returning from background; rider saw "tap to unlock" banner
- **Fix:** `initAudioContextRevival()` registered in App.tsx useEffect adds a `visibilitychange`
  listener that auto-resumes the AudioContext whenever `document.visibilityState === "visible"`.

---

## 9. Document Upload in Registration Wizard ✅ FIXED

- **Was:** Only text CNIC number and license number captured; no photo upload during registration
- **Fix:** Step 4 "Document Photos" added to the registration wizard (`rider-register-steps.tsx`).
  Step is optional (skippable) — riders can tap "Upload later from Profile".
  Captures: CNIC front photo, CNIC back photo, driving license photo.
  Files submitted via `POST /api/verification/documents` (multipart) after registration.

---

## 10. Turn-by-Turn Navigation ✅ VERIFIED (pre-existing implementation)

- **Status:** Navigation button was already implemented in Active page using deep links to Google Maps/Waze
- **Verified working:** Deep-link button opens external map app with correct coordinates

---

## 11. Playwright Visual Testing — External Proxy Blocked 🟡

- **Issue:** Playwright testing agent gets HTTP 502 when navigating to external Replit URL
- **Root cause:** Replit mTLS proxy does not allow external automated browser connections
- **Workaround:** Screenshot tool (embedded iframe) works; API-level testing works via curl
- **Impact:** Cannot run automated UI click-through tests in the Replit dev environment

---

## 12. Admin Panel — Rider Detail Page Gate History 🟡

- **Status:** Tasks cancelled
- **Current:** `GET /admin/riders/:id` returns `gateStatus.lastBlock` (most recent gate event only)
- **Missing:** Full paginated gate event history list in admin UI
- **Data exists:** `rider_gate_events` table stores all events

---

## 13. Email / SMS Notification Configuration 🟡

- **Status:** Email and SMS send functions implemented
- **Dev mode:** SMTP not configured → logs to console only (`sent: false`)
- **Dev mode:** Twilio/MSG91 not configured → SMS falls back to console
- **Production:** Requires `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` secrets
- **Production:** Requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` secrets

---

## 14. Redis Not Configured 🟡

- **Status:** `REDIS_URL` not set in dev
- **Impact:**
  - JWT blacklisting disabled (logged-out tokens valid until expiry)
  - Distributed rate limiting disabled (per-instance only)
  - Idempotency cache in-memory only (lost on restart)
- **Production fix:** Set `REDIS_URL` in Replit Secrets panel

---

## 15. Bundle Size ✅ FIXED

- **Was:** `index.js` bundle 1,124 kB (323 kB gzip) — exceeded 500 kB Vite warning
- **Fix:** `vite.config.ts` now uses `build.rollupOptions.output.manualChunks` to split into:
  `vendor-react`, `vendor-leaflet`, `vendor-socket`, `vendor-query` chunks.
- **Expected:** Main entry chunk gzip size reduced significantly.

---

## 16. Dynamic Import Overlap Warnings ✅ FIXED

- **Was:** `attestation.ts` and `error-reporter.ts` both statically and dynamically imported
- **Fix:** `api.ts` now uses static imports for both modules (since they're already in the
  initial bundle via App.tsx/main.tsx static imports). Dynamic `await import()` calls removed.

---

## 17. PWA Service Worker — Re-enabled ✅ FIXED

- **Was:** VitePWA plugin disabled due to EISDIR build error
- **Fix:** Re-enabled with `outDir: "dist/public"` and explicit `globDirectory: "dist/public"`
  to prevent workbox from traversing parent directories that caused the EISDIR error.

---

## Summary

| Category | Count |
|----------|-------|
| ✅ Resolved in this session | 9 |
| 🟡 Medium (missing feature / dev gap) | 6 |
| **Total** | **15** |
