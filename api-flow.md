# AJKMART API Server – Complete Logic Flow (Visual)

> **Purpose:** Complete visual reference for the API server — middleware, auth, database, sockets, and multi-app connectivity
> **Stack:** Node.js + Express v5 + TypeScript + Drizzle ORM + PostgreSQL + Redis + Socket.IO
> **Last Updated:** 2026-05-28

---

## Table of Contents

1. [Server Boot Sequence](#1-server-boot-sequence)
2. [Global Middleware Stack (Execution Order)](#2-global-middleware-stack-execution-order)
3. [Security Layers](#3-security-layers)
4. [Rate Limiting Architecture](#4-rate-limiting-architecture)
5. [Authentication Pipeline](#5-authentication-pipeline)
6. [JWT & Refresh Token Rotation (RTR)](#6-jwt--refresh-token-rotation-rtr)
7. [Route Organization & Multi-App Connectivity](#7-route-organization--multi-app-connectivity)
8. [Feature Gate Middleware](#8-feature-gate-middleware)
9. [Database Schema Overview](#9-database-schema-overview)
10. [Redis Architecture](#10-redis-architecture)
11. [Socket.IO Architecture](#11-socketio-architecture)
12. [Error Handling Pipeline](#12-error-handling-pipeline)
13. [Idempotency System](#13-idempotency-system)
14. [Audit & Observability](#14-audit--observability)
15. [How All Four Apps Connect](#15-how-all-four-apps-connect)
16. [Request Lifecycle — End to End](#16-request-lifecycle--end-to-end)

---

## 1. Server Boot Sequence

```
┌─────────────────────────────────────────────────────────────────┐
│                   node src/index.ts  (entry)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Load environment variables (.env / process.env)              │
│  2. Validate required env vars — crash early if missing          │
│     DATABASE_URL, REDIS_URL, ACCESS_TOKEN_SECRET,                │
│     REFRESH_TOKEN_SECRET, ADMIN_ACCESS_TOKEN_SECRET              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Connect to PostgreSQL via Drizzle ORM                        │
│     • Run pending migrations (drizzle-kit)                       │
│     • Test connection — crash if unreachable                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Connect to Redis                                             │
│     • Test PING → PONG                                           │
│     • Fallback: in-memory rate limit store if Redis unavailable  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Initialize Express app (app.ts)                              │
│     • Register global middleware (see Section 2)                 │
│     • Mount all routers (see Section 7)                          │
│     • Register global error handler (see Section 12)             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Create HTTP server → attach Socket.IO (see Section 11)       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. Start listening on PORT (default 8000)                       │
│     pino logger: "API server running on :8000"                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Global Middleware Stack (Execution Order)

Every incoming HTTP request passes through these layers in order:

```
INCOMING REQUEST
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1 — LOGGING & TRACING                                     │
│  pino-http                                                       │
│    → Assign unique requestId (UUID v4) to every request          │
│    → Log: method, url, statusCode, responseTime                  │
│  requestContextMiddleware  (AsyncLocalStorage)                    │
│    → Bind requestId to async context for trace propagation       │
│    → All downstream logs include the same requestId              │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2 — SECURITY HEADERS                                      │
│  helmet                                                          │
│    → Strict-Transport-Security (HSTS)                            │
│    → Content-Security-Policy (CSP)                               │
│    → X-Frame-Options: DENY                                       │
│    → X-Content-Type-Options: nosniff                             │
│    → Referrer-Policy: strict-origin-when-cross-origin            │
│  cors  (dynamic whitelist)                                       │
│    → Allowed origins from ENV + Replit proxy domains             │
│    → Credentials: true (for HttpOnly cookie refresh tokens)      │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3 — PARSING & COMPRESSION                                 │
│  cookieParser    → parse HttpOnly refresh token cookies          │
│  compression     → gzip response bodies > 1KB                   │
│  express.json    → parse application/json bodies (max 10mb)      │
│  express.urlencoded → parse form bodies                          │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 4 — SANITIZATION                                          │
│  sanitizeBody                                                    │
│    → Strip HTML tags from all string fields (XSS prevention)     │
│    → Trim whitespace                                             │
│    → Reject null bytes (\x00)                                    │
│  suspiciousPatternDetector                                       │
│    → Heuristic analysis of request patterns                      │
│    → Block: SQL injection attempts, path traversal, shell cmds   │
│    → Log to security_events table + alert admin                  │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 5 — RATE LIMITING  (see Section 4 for full detail)        │
│  Global limiter:  2,500 requests / 15 minutes per IP             │
│  User limiter:    600 requests / minute (mobile app polling)     │
│  Auth limiter:    10 requests / minute (login/register)          │
│  Admin limiter:   500 requests / 15 minutes (stricter)           │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 6 — SESSION SECURITY                                      │
│  checkSessionRevocation                                          │
│    → Hash incoming token (SHA-256)                               │
│    → Redis GET session:bl:<hash>                                 │
│    → If found → 401 "Session revoked" (instant logout works)     │
│  verifyTokenFamily                                               │
│    → Check tokenFamilyId not in revoked families list            │
│    → Replay attack detection for refresh token reuse             │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 7 — ROUTING  (see Section 7 for route map)               │
│  routes/index.ts dispatches to domain routers:                   │
│  /api/admin/*    → adminRouter    (admin panel)                  │
│  /api/auth/*     → authRouter     (all apps)                     │
│  /api/*          → appRouter      (customer/rider/vendor)        │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 8 — GLOBAL ERROR HANDLER  (see Section 12)               │
│  Catches all unhandled errors from route handlers                │
│  Formats consistent JSON error responses                         │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
RESPONSE SENT
```

---

## 3. Security Layers

### CSRF Protection (Admin Only)

```
┌─────────────────────────────────────────────────────────────────┐
│  All state-changing admin operations (POST/PATCH/DELETE)         │
│  enforce Double-Submit Cookie pattern:                           │
│                                                                  │
│  1. Admin panel receives csrf_token in cookie on login           │
│  2. Frontend copies csrf_token → sends as X-CSRF-Token header    │
│  3. csrfProtection middleware:                                   │
│     • Read cookie value                                          │
│     • Read header value                                          │
│     • If mismatch → 403 "CSRF token invalid"                     │
│     • If match → proceed                                         │
└─────────────────────────────────────────────────────────────────┘
```

### IP Whitelist (Admin Only)

```
┌─────────────────────────────────────────────────────────────────┐
│  Admin routes protected by IP whitelist:                         │
│  GET /api/platform-config: security_admin_ip_whitelist           │
│  If requester IP not in whitelist → 403 "Access denied"          │
│  Configurable via admin settings panel                           │
│  Bypass: ADMIN_IP_WHITELIST_ENABLED=false in ENV for dev         │
└─────────────────────────────────────────────────────────────────┘
```

### Suspicious Pattern Detection

```
┌─────────────────────────────────────────────────────────────────┐
│  suspiciousPatternDetector checks every request body/query:      │
│                                                                  │
│  BLOCKED PATTERNS:                                               │
│  • SQL:   SELECT, INSERT, DROP, UNION, --, ; (in strings)        │
│  • NoSQL: $where, $gt, $ne, $regex operators                     │
│  • Path:  ../../../ traversal sequences                          │
│  • Shell: ; rm, && curl, | bash patterns                         │
│  • XSS:  <script>, javascript:, onerror=                         │
│                                                                  │
│  ON DETECTION:                                                   │
│  → 400 Bad Request returned                                      │
│  → security_events table: INSERT { ip, pattern, payload, ts }    │
│  → If same IP triggers 5+ times in 10 min → auto-ban in Redis    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Rate Limiting Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  RATE LIMIT TIERS                                │
│                                                                  │
│  TIER              WINDOW    LIMIT    APPLIES TO                 │
│  ──────────────────────────────────────────────────────────     │
│  Global            15 min    2,500    All IPs (hard floor)       │
│  Auth endpoints    1 min     10       /api/auth/* (brute force)  │
│  User API          1 min     600      Authenticated mobile apps  │
│  Admin             15 min    500      /api/admin/* routes        │
│  Search            1 min     60       /api/search endpoint       │
│  Payment           1 min     5        /api/payments endpoint     │
└─────────────────────────────────────────────────────────────────┘
```

### Redis Sliding Window Implementation

```
┌─────────────────────────────────────────────────────────────────┐
│  Lua script runs atomically in Redis on every request:           │
│                                                                  │
│  KEY: ratelimit:{ip}:{endpoint}  (Sorted Set)                    │
│                                                                  │
│  1. ZREMRANGEBYSCORE key 0 (now - windowMs)   ← remove old      │
│  2. count = ZCARD key                          ← count current   │
│  3. IF count >= limit → return 429             ← block           │
│  4. ZADD key now {requestId}                   ← record request  │
│  5. EXPIRE key windowMs                        ← TTL cleanup     │
│  6. Return remaining = limit - count - 1                         │
│                                                                  │
│  Response headers set:                                           │
│  X-RateLimit-Limit: 2500                                         │
│  X-RateLimit-Remaining: 2499                                     │
│  X-RateLimit-Reset: <unix timestamp>                             │
│                                                                  │
│  Fallback (Redis unavailable):                                   │
│  → In-memory fixed window (per process, not distributed)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Authentication Pipeline

### Guard Selection by Route

```
┌─────────────────────────────────────────────────────────────────┐
│                    INCOMING REQUEST                              │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼──────────────────┐
         /api/admin/*    /api/auth/*         /api/* (app)
              │               │                   │
              ▼               ▼                   ▼
┌──────────────────┐  ┌──────────────┐  ┌────────────────────────┐
│  authenticateAdmin│  │  PUBLIC      │  │  authenticateUser      │
│                  │  │  (no guard)  │  │                        │
│  Validate JWT    │  │  login,      │  │  Validate JWT signed    │
│  signed with:    │  │  register,   │  │  with:                  │
│  ADMIN_ACCESS_   │  │  send-otp,   │  │  ACCESS_TOKEN_SECRET    │
│  TOKEN_SECRET    │  │  platform-   │  │                        │
│                  │  │  config      │  │  role check:            │
│  Check: super    │  └──────────────┘  │  customer/rider/vendor  │
│  flag OR perms[] │                    │                        │
│  includes needed │                    │  Attach to req.user     │
│  permission      │                    └────────────────────────┘
└──────────────────┘
```

### JWT Validation Flow (Both Guards)

```
┌─────────────────────────────────────────────────────────────────┐
│  Extract Bearer token from Authorization header                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  jwt.verify(token, secret)                                       │
│  ├─ Invalid signature → 401 "Invalid token"                      │
│  └─ Expired          → 401 "Token expired" (trigger refresh)     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Extract payload:                                                │
│  { userId, role, tokenFamilyId, tokenVersion, perms?, super? }  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Check Redis session blacklist:                                  │
│  GET session:bl:SHA256(token)                                    │
│  ├─ EXISTS → 401 "Session revoked" (user logged out / banned)    │
│  └─ NOT EXISTS → continue                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Check tokenVersion matches DB users.tokenVersion                │
│  (admin password change forces all tokens invalid)               │
│  ├─ MISMATCH → 401 "Token invalidated"                           │
│  └─ MATCH → attach user to req.user → next()                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. JWT & Refresh Token Rotation (RTR)

### Token Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  ACCESS TOKEN  (short-lived — 15 minutes)                        │
│  Algorithm: HMAC-SHA256  •  Signed with ACCESS_TOKEN_SECRET      │
│                                                                  │
│  PAYLOAD:                                                        │
│  {                                                               │
│    sub:             "user_id_uuid",                              │
│    role:            "customer" | "rider" | "vendor" | "admin",   │
│    tokenFamilyId:   "uuid",    ← ties access + refresh together  │
│    tokenVersion:    42,        ← increments on password change   │
│    perms:           ["orders.view", ...],  ← admin only          │
│    super:           false,                 ← admin only          │
│    iat:             1716900000,                                   │
│    exp:             1716900900                                    │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  REFRESH TOKEN  (long-lived — 7 days)                            │
│  Stored: SHA-256 hash in refresh_tokens table                    │
│  Transmitted: HttpOnly cookie (SameSite=Strict, Secure)          │
│                                                                  │
│  DB RECORD:                                                      │
│  {                                                               │
│    id:             uuid,                                         │
│    userId:         uuid,                                         │
│    tokenHash:      "sha256hash",                                 │
│    familyId:       "uuid",                                       │
│    status:         "ACTIVE" | "ROTATED" | "REVOKED",            │
│    expiresAt:      timestamp,                                    │
│    createdAt:      timestamp                                     │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Refresh Token Rotation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Client sends:  POST /api/auth/refresh  (cookie auto-sent)       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Extract refresh token from HttpOnly cookie                   │
│  2. Hash it: SHA-256(rawToken)                                   │
│  3. DB query: SELECT * FROM refresh_tokens WHERE tokenHash = ?   │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼──────────────────────┐
      NOT FOUND           FOUND + ACTIVE        FOUND + ROTATED
         │                    │                       │
         ▼                    ▼                       ▼
  401 "Invalid         Proceed to rotate    ⚠ REPLAY ATTACK
  refresh token"                            DETECTED
                                            Mark entire
                                            tokenFamilyId
                                            as REVOKED
                                            Revoke ALL sessions
                                            in this family
                                            401 "Family breach"
                              │
                              ▼  (ACTIVE path)
┌─────────────────────────────────────────────────────────────────┐
│  4. Mark old refresh token → status = "ROTATED"                  │
│  5. Generate new access token (15 min)                           │
│  6. Generate new refresh token (7 days)                          │
│  7. Store new refresh token hash in DB                           │
│  8. Set new HttpOnly cookie                                      │
│  9. Return new access token in response body                     │
└─────────────────────────────────────────────────────────────────┘
```

### Logout / Session Revocation

```
┌─────────────────────────────────────────────────────────────────┐
│  POST /api/auth/logout                                           │
│                                                                  │
│  1. Hash current access token → SET session:bl:<hash> EX 900s   │
│     (Redis blacklist — expires same time as token)               │
│  2. Mark refresh token in DB → status = "REVOKED"               │
│  3. Clear HttpOnly cookie                                        │
│  4. Return 200 OK                                                │
│                                                                  │
│  Effect: token immediately unusable even before expiry           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Route Organization & Multi-App Connectivity

### Route Dispatcher (`routes/index.ts`)

```
┌─────────────────────────────────────────────────────────────────┐
│                      routes/index.ts                             │
│                                                                  │
│  app.use("/api/admin",  adminRouter)      ← Admin Panel only     │
│  app.use("/api/auth",   authRouter)       ← All apps (public)    │
│  app.use("/api",        appRouter)        ← Customer/Rider/Vendor│
│  app.use("/health",     healthRouter)     ← Health checks        │
└─────────────────────────────────────────────────────────────────┘
```

### App Router Breakdown (`appRouter`)

```
┌──────────────────────────────────────────────────────────────────┐
│                       appRouter                                   │
├────────────────────────────────┬─────────────────────────────────┤
│  PREFIX                        │  ROUTER FILE                     │
├────────────────────────────────┼─────────────────────────────────┤
│  /users                        │  userRouter                      │
│  /mart/stores                  │  martStoreRouter                 │
│  /food/restaurants             │  foodRouter                      │
│  /pharmacy                     │  pharmacyRouter                  │
│  /orders                       │  orderRouter                     │
│  /rides                        │  rideRouter                      │
│  /parcel                       │  parcelRouter                    │
│  /van                          │  vanRouter                       │
│  /school-van                   │  schoolVanRouter                 │
│  /wallet                       │  walletRouter                    │
│  /payments                     │  paymentRouter                   │
│  /loyalty                      │  loyaltyRouter                   │
│  /vendors                      │  vendorRouter                    │
│  /riders (profile)             │  riderRouter                     │
│  /products                     │  productRouter                   │
│  /categories                   │  categoryRouter                  │
│  /verification                 │  verificationRouter              │
│  /platform-config              │  configRouter                    │
│  /search                       │  searchRouter                    │
│  /reviews                      │  reviewRouter                    │
│  /chat                         │  chatRouter                      │
│  /notifications                │  notificationRouter              │
│  /support-chat                 │  supportChatRouter               │
│  /analytics                    │  analyticsRouter                 │
│  /promo-codes                  │  promoRouter                     │
│  /flash-deals                  │  flashDealRouter                 │
│  /banners                      │  bannerRouter                    │
└────────────────────────────────┴─────────────────────────────────┘
```

### Admin Router Breakdown

```
┌──────────────────────────────────────────────────────────────────┐
│                      adminRouter                                  │
├────────────────────────────────┬─────────────────────────────────┤
│  PREFIX                        │  HANDLER                         │
├────────────────────────────────┼─────────────────────────────────┤
│  /admin/auth                   │  adminAuthRouter (no guard)      │
│  /admin/dashboard              │  dashboardRouter + adminGuard    │
│  /admin/vendors                │  vendorMgmtRouter + adminGuard   │
│  /admin/riders                 │  riderMgmtRouter + adminGuard    │
│  /admin/kyc                    │  kycRouter + adminGuard          │
│  /admin/orders                 │  orderMgmtRouter + adminGuard    │
│  /admin/users                  │  userMgmtRouter + adminGuard     │
│  /admin/transactions           │  transactionRouter + adminGuard  │
│  /admin/withdrawals            │  withdrawalRouter + adminGuard   │
│  /admin/deposits               │  depositRouter + adminGuard      │
│  /admin/products               │  productMgmtRouter + adminGuard  │
│  /admin/categories             │  categoryMgmtRouter + adminGuard │
│  /admin/reviews                │  reviewMgmtRouter + adminGuard   │
│  /admin/promo-codes            │  promoMgmtRouter + adminGuard    │
│  /admin/flash-deals            │  flashDealMgmtRouter + adminGuard│
│  /admin/banners                │  bannerMgmtRouter + adminGuard   │
│  /admin/popups                 │  popupMgmtRouter + adminGuard    │
│  /admin/communications         │  broadcastRouter + adminGuard    │
│  /admin/analytics              │  analyticsRouter + adminGuard    │
│  /admin/audit-logs             │  auditRouter + adminGuard        │
│  /admin/roles                  │  rolesRouter + adminGuard        │
│  /admin/sos-alerts             │  sosRouter + adminGuard          │
│  /admin/health-dashboard       │  healthRouter + adminGuard       │
│  /admin/settings               │  settingsRouter + adminGuard     │
└────────────────────────────────┴─────────────────────────────────┘
```

---

## 8. Feature Gate Middleware

```
┌─────────────────────────────────────────────────────────────────┐
│  Applied to specific routes:                                     │
│  POST /api/orders/accept   →  featureGate("accept_ride")         │
│  POST /api/withdraw        →  featureGate("withdraw_money")      │
│  POST /api/products        →  featureGate("add_product")         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  featureGate(featureName) middleware:                            │
│                                                                  │
│  1. DB query:                                                    │
│     SELECT required_verifications, max_limit_per_day             │
│     FROM feature_rules                                           │
│     WHERE role = req.user.role AND feature_name = featureName    │
│                                                                  │
│  2. DB query:                                                    │
│     SELECT phone_verified, email_verified, documents_approved    │
│     FROM users WHERE id = req.user.userId                        │
│                                                                  │
│  3. For each required_verification flag:                         │
│     • phoneVerified?       → check users.phoneVerified           │
│     • emailVerified?       → check users.emailVerified           │
│     • documentsApproved?   → check users.documentsApproved       │
│                                                                  │
│  4. ANY FLAG FALSE:                                              │
│     → 403 {                                                      │
│         blocked: true,                                           │
│         message: "...",                                          │
│         missing: ["phone_verified", ...]                         │
│       }                                                          │
│                                                                  │
│  5. ALL FLAGS TRUE:                                              │
│     → Check max_limit_per_day if set                             │
│     → Count today's actions for this user                        │
│     → If at limit → 429 "Daily limit reached"                    │
│     → Else → next()                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Database Schema Overview

**115+ tables organized into logical domains:**

### Core — Users & Auth

```
┌─────────────────────────────────────────────────────────────────┐
│  users                                                           │
│  ─────────────────────────────────────────────────────────────  │
│  id (PK, UUID)          fullName          phone                  │
│  email                  cnic              passwordHash           │
│  role                   isActive          isBanned               │
│  phoneVerified          emailVerified     documentsApproved      │
│  approvalStatus         kycStatus         tokenVersion           │
│  loyaltyPoints          loyaltyTier       referralCode           │
│  createdAt              updatedAt         deletedAt (soft)       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  user_sessions                     │  refresh_tokens             │
│  ────────────────────────────────  │  ──────────────────────     │
│  id, userId, deviceInfo            │  id, userId, tokenHash      │
│  ipAddress, lastActive             │  familyId, status           │
│  createdAt                         │  expiresAt, createdAt       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  user_roles               │  feature_rules                       │
│  ───────────────────────  │  ─────────────────────────────────   │
│  id, userId, role         │  id, role, featureName               │
│  grantedBy, createdAt     │  requiredVerifications[]             │
│                           │  maxLimitPerDay, createdAt           │
└─────────────────────────────────────────────────────────────────┘
```

### Business — Vendors & Riders

```
┌─────────────────────────────────────────────────────────────────┐
│  vendor_profiles                                                  │
│  ─────────────────────────────────────────────────────────────  │
│  id, userId (FK→users)   storeName        storeCategory          │
│  storeLogo               description      storePhone             │
│  address                 latitude         longitude              │
│  deliveryRadius          minOrderAmount   commissionRate         │
│  storeStatus             tier             approvalStatus         │
│  openingHours (JSON)     blockedDates[]   createdAt              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  rider_profiles                                                   │
│  ─────────────────────────────────────────────────────────────  │
│  id, userId (FK→users)   vehicleType      plateNumber            │
│  licenseNumber           isOnline         isRestricted           │
│  zone                    rating           totalRides             │
│  cancelCount             ignoreCount      penaltyTotal           │
│  lastLocationLat         lastLocationLng  lastSeenAt             │
│  createdAt                                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Business — Orders & Products

```
┌─────────────────────────────────────────────────────────────────┐
│  orders                                                          │
│  ─────────────────────────────────────────────────────────────  │
│  id, customerId (FK)    vendorId (FK)      riderId (FK, null)    │
│  status                 paymentMethod      paymentStatus         │
│  subtotal               deliveryFee        promoDiscount         │
│  totalAmount            commission         netVendorAmount       │
│  deliveryAddress (JSON) deliveryLat        deliveryLng           │
│  instructions           promoCode          idempotencyKey        │
│  createdAt              updatedAt          deliveredAt           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  order_items                                                     │
│  ─────────────────────────────────────────────────────────────  │
│  id, orderId (FK)   productId (FK)   quantity                    │
│  unitPrice          totalPrice       customizations (JSON)       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  rides                                                           │
│  ─────────────────────────────────────────────────────────────  │
│  id, customerId (FK)   riderId (FK, null)   vehicleType          │
│  pickupAddress         pickupLat/Lng        dropAddress          │
│  dropLat/Lng           offeredFare          agreedFare           │
│  status                otp                  distanceKm           │
│  startedAt             completedAt          createdAt            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  products                                                        │
│  ─────────────────────────────────────────────────────────────  │
│  id, vendorId (FK)   categoryId (FK)   name                      │
│  description         price             salePrice                 │
│  stockQty            lowStockThreshold  sku                      │
│  images[]            isActive          createdAt                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  categories           │  product_stock_history                   │
│  ──────────────────── │  ───────────────────────────────────     │
│  id, name, slug       │  id, productId, changeType               │
│  parentId (self-ref)  │  qtyBefore, qtyAfter, changedBy          │
│  icon, sortOrder      │  reason, createdAt                       │
│  isActive, createdAt  │                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Financial

```
┌─────────────────────────────────────────────────────────────────┐
│  wallet_transactions                                             │
│  ─────────────────────────────────────────────────────────────  │
│  id, userId (FK)   type (order_credit / withdrawal / topup /    │
│                         refund / bonus / penalty / transfer)    │
│  amount            balanceBefore    balanceAfter                 │
│  referenceId       referenceType    notes                        │
│  createdAt                                                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  payouts (withdrawals)    │  deposit_requests                    │
│  ─────────────────────── │  ──────────────────────────────────   │
│  id, userId, amount       │  id, userId, amount                  │
│  method, accountDetails   │  method, receiptImage                │
│  status, processedBy      │  txId, status, confirmedBy           │
│  transactionRef           │  createdAt                           │
│  createdAt, processedAt   │                                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  idempotency_keys                                                │
│  ─────────────────────────────────────────────────────────────  │
│  id, key (UNIQUE)   userId   endpoint                            │
│  requestHash        responseStatus   responseBody                │
│  createdAt          expiresAt                                    │
│  (See Section 13 for full idempotency flow)                      │
└─────────────────────────────────────────────────────────────────┘
```

### Infrastructure

```
┌─────────────────────────────────────────────────────────────────┐
│  platform_settings  │  rate_limits     │  security_events        │
│  ──────────────────  │  ─────────────── │  ───────────────────── │
│  key (UNIQUE)        │  ip, endpoint    │  id, ip, patternType    │
│  value (JSON)        │  count, windowMs │  payload, userId        │
│  updatedBy           │  resetAt         │  severity, createdAt    │
│  updatedAt           │                  │                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  audit_logs                                                      │
│  ─────────────────────────────────────────────────────────────  │
│  id (UUID)          adminId (FK)     action                      │
│  targetType         targetId         payload (JSON)              │
│  ipAddress          sessionId        notes                       │
│  createdAt          (IMMUTABLE — no UPDATE, no DELETE)           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  location_history                                                │
│  ─────────────────────────────────────────────────────────────  │
│  id, riderId (FK)   latitude         longitude                   │
│  accuracy           speed            bearing                     │
│  orderId (FK, null) rideId (FK, null) recordedAt                 │
└─────────────────────────────────────────────────────────────────┘
```

### Schema Conventions (Applied to ALL Tables)

```
┌─────────────────────────────────────────────────────────────────┐
│  EVERY table includes:                                           │
│  • id:        UUID (generated by DB default)                     │
│  • createdAt: timestamp with timezone  (auto-set on INSERT)      │
│  • updatedAt: timestamp with timezone  (auto-set on UPDATE)      │
│                                                                  │
│  MOST tables include:                                            │
│  • deletedAt: timestamp (NULL = active, SET = soft-deleted)      │
│    → Queries always filter: WHERE deletedAt IS NULL              │
│                                                                  │
│  RELATIONSHIPS:                                                  │
│  • userId is the primary anchor across all tables                │
│  • All FKs enforce referential integrity at DB level             │
│  • Drizzle ORM enforces types at TypeScript compile time         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Redis Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    REDIS KEY NAMESPACE MAP                       │
│                                                                  │
│  PURPOSE                KEY PATTERN                  TTL        │
│  ──────────────────────────────────────────────────────────     │
│  Session blacklist      session:bl:<sha256hash>      900s       │
│                         (matches access token TTL)              │
│                                                                  │
│  Token family revoke    family:revoked:<familyId>    7d         │
│                                                                  │
│  Rate limit windows     ratelimit:<ip>:<endpoint>    window     │
│                         (Sorted Set — sliding window)           │
│                                                                  │
│  Auto-ban IPs           secban:<ip>                  1h         │
│                         (set after 5 suspicious reqs)          │
│                                                                  │
│  Platform config cache  config:platform              300s       │
│                         (5-min TTL reduces DB hits)             │
│                                                                  │
│  OTP codes              otp:phone:<phone>             300s       │
│                         otp:email:<email>             300s       │
│                         (hashed — not raw OTP)                  │
│                                                                  │
│  Rider online status    rider:online:<riderId>        60s        │
│                         (heartbeat refreshes TTL)               │
│                                                                  │
│  Ghost rider cleanup    (TTL expiry triggers cleanup logic)      │
│                         If TTL expires → rider auto-offline      │
│                                                                  │
│  Payment status poll    payment:status:<paymentId>   300s       │
│                         (cache JazzCash/EasyPaisa status)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Socket.IO Architecture

### Connection & Auth Handshake

```
┌─────────────────────────────────────────────────────────────────┐
│  Client connects to Socket.IO server                             │
│  Handshake: { auth: { token: "<JWT access token>" } }            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  io.use(authMiddleware)  (runs on every connection)              │
│  1. Extract token from handshake.auth.token                      │
│  2. jwt.verify(token, ACCESS_TOKEN_SECRET)                       │
│  3. Attach { userId, role } to socket.data                       │
│  ├─ VALID:   socket connection established                        │
│  └─ INVALID: socket.disconnect("unauthorized")                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  On connect: auto-join private room                              │
│  customer → socket.join("user:{userId}")                         │
│  rider    → socket.join("rider:{userId}")                        │
│  vendor   → socket.join("vendor:{userId}")                       │
│  admin    → socket.join("admin-fleet") + "admin:{userId}"        │
└─────────────────────────────────────────────────────────────────┘
```

### Room Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                        SOCKET ROOMS                              │
│                                                                  │
│  ROOM                    WHO JOINS         EVENTS RECEIVED       │
│  ──────────────────────────────────────────────────────────     │
│  user:{userId}           Customer          order:ack             │
│                                            order:confirmed       │
│                                            order:status          │
│                                            ride:accepted         │
│                                            ride:counter          │
│                                            wallet:update         │
│                                            notification:new      │
│                                                                  │
│  rider:{userId}          Rider             rider:new_request     │
│                                            ride:assigned         │
│                                            admin:force_online    │
│                                            admin:force_offline   │
│                                                                  │
│  vendor:{userId}         Vendor            order:new             │
│                                            order:update          │
│                                            notification:new      │
│                                                                  │
│  admin:{userId}          Admin             notification:new      │
│                                            sos:alert             │
│                                                                  │
│  admin-fleet             All admins        rider:location (all)  │
│                                            rider:online/offline  │
│                                            kyc:submitted         │
│                                                                  │
│  ride:{rideId}           Customer +        rider:location (1:1)  │
│                          Rider of ride     ride:arrived          │
│                                            ride:otp_verified     │
│                                            ride:completed        │
│                                                                  │
│  order:{orderId}         Customer +        order:status          │
│                          Vendor            rider:location        │
│                                                                  │
│  conversation:{convId}   Chat participants admin:chat            │
│                                            customer:chat         │
└─────────────────────────────────────────────────────────────────┘
```

### GPS Throttling & Ghost Rider Cleanup

```
┌─────────────────────────────────────────────────────────────────┐
│  RIDER GPS FLOW                                                  │
│                                                                  │
│  Rider emits: rider:location_update { lat, lng, battery, speed } │
│                                                                  │
│  Server-side throttle:                                           │
│  • Max 1 broadcast per 1,500ms per rider                         │
│  • Excess emits dropped (not queued)                             │
│                                                                  │
│  ON EACH VALID PING:                                             │
│  1. SET rider:online:{riderId} EX 60  (refresh Redis TTL)        │
│  2. INSERT location_history record                               │
│  3. UPDATE rider_profiles.lastLocationLat/Lng                    │
│  4. Broadcast to:                                                │
│     • ride:{activeRideId}  → customer sees rider move            │
│     • order:{activeOrderId} → customer sees rider move           │
│     • admin-fleet          → admin live map                      │
│                                                                  │
│  GHOST RIDER CLEANUP:                                            │
│  Redis key rider:online:{riderId} expires after 60s of silence   │
│  → Keyspace notification triggers server handler                 │
│  → Emit rider:offline to admin-fleet                             │
│  → UPDATE rider_profiles SET isOnline = false                    │
│  → Decrement admin dashboard online counter                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Error Handling Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│   Route handler throws error  (or calls next(error))            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│             GLOBAL ERROR HANDLER  (app.ts — last middleware)     │
│                                                                  │
│  IF AppError (custom class):                                     │
│    statusCode from error.statusCode                              │
│    message from error.message                                    │
│    code from error.code (e.g. "INSUFFICIENT_BALANCE")            │
│                                                                  │
│  IF ZodValidationError:                                          │
│    statusCode = 400                                              │
│    errors[] = formatted field errors                             │
│                                                                  │
│  IF DrizzleError (DB constraint):                                │
│    "23505" unique violation → 409 Conflict                       │
│    "23503" FK violation    → 400 Bad Request                     │
│    Other                   → 500 Internal Server Error           │
│                                                                  │
│  IF Unknown error:                                               │
│    statusCode = 500                                              │
│    message = "Internal server error"  (detail hidden in prod)    │
│    pino logger: ERROR level with full stack trace                │
│    INSERT error_logs { requestId, route, error, userId, ts }     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STANDARD ERROR RESPONSE FORMAT:                                 │
│  {                                                               │
│    success: false,                                               │
│    error: {                                                      │
│      code: "FEATURE_GATE_BLOCKED",                               │
│      message: "Upload documents to accept rides",                │
│      details?: { missing: ["documents_approved"] },              │
│      requestId: "uuid"   ← for support tracing                  │
│    }                                                             │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 13. Idempotency System

Prevents duplicate orders, double payments, and double wallet transfers from mobile app retries.

```
┌─────────────────────────────────────────────────────────────────┐
│  Mobile app sends critical mutation:                             │
│  POST /api/orders  { ...body }                                   │
│  Headers: X-Idempotency-Key: <uuid-generated-by-client>         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  idempotency middleware:                                         │
│                                                                  │
│  1. Extract X-Idempotency-Key header                             │
│  2. Hash request body: SHA-256(JSON.stringify(body))             │
│  3. SELECT * FROM idempotency_keys                               │
│     WHERE key = ? AND userId = ?                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴──────────────────┐
         NOT FOUND                           FOUND
              │                                  │
              ▼                                  ▼
┌──────────────────────────┐     ┌───────────────────────────────┐
│  INSERT idempotency_keys  │     │  requestHash matches?         │
│  { key, userId, endpoint, │     │  ├─ YES: Return cached        │
│    requestHash, status:   │     │  │       response immediately  │
│    "processing" }         │     │  │       (replay protection)   │
│  Proceed to handler       │     │  └─ NO:  409 "Idempotency key │
│  On complete:             │     │          used with different   │
│  UPDATE status="complete" │     │          request body"         │
│  responseBody=<result>    │     └───────────────────────────────┘
└──────────────────────────┘

  ENDPOINTS PROTECTED BY IDEMPOTENCY:
  POST /api/orders               (place order)
  POST /api/rides                (book ride)
  POST /api/wallet/transfer      (send money)
  POST /api/wallet/topup         (top up wallet)
  POST /api/withdraw             (withdrawal request)
  POST /api/payments             (initiate payment)
```

---

## 14. Audit & Observability

### Audit Log (Automatic)

```
┌─────────────────────────────────────────────────────────────────┐
│  Every admin action auto-inserts to audit_logs:                  │
│                                                                  │
│  TRIGGER POINTS:                                                 │
│  • Any PATCH/POST/DELETE on admin routes                         │
│  • KYC approve/reject                                            │
│  • Wallet manual adjustments                                     │
│  • Platform config changes                                       │
│  • Role assignments                                              │
│  • Vendor/rider status changes                                   │
│  • Refund issuance                                               │
│                                                                  │
│  INSERT audit_logs {                                             │
│    adminId:      req.user.userId,                                │
│    action:       "vendor.approved",                              │
│    targetType:   "vendor",                                       │
│    targetId:     vendorId,                                       │
│    payload:      { before: {...}, after: {...} },                 │
│    ipAddress:    req.ip,                                         │
│    sessionId:    req.user.sessionId                              │
│  }                                                               │
│                                                                  │
│  Table is APPEND-ONLY:                                           │
│  No UPDATE permission on audit_logs in DB                        │
│  No DELETE permission on audit_logs in DB                        │
└─────────────────────────────────────────────────────────────────┘
```

### Request Tracing (pino + AsyncLocalStorage)

```
┌─────────────────────────────────────────────────────────────────┐
│  Every log line throughout a request lifecycle includes:         │
│                                                                  │
│  {                                                               │
│    requestId: "uuid",        ← same ID from entry to exit       │
│    userId:    "uuid",        ← if authenticated                  │
│    method:    "POST",                                            │
│    url:       "/api/orders",                                     │
│    level:     "info",                                            │
│    msg:       "Order placed successfully",                       │
│    duration:  142,           ← ms                               │
│    time:      1716900000000                                      │
│  }                                                               │
│                                                                  │
│  requestId propagates through:                                   │
│  HTTP request → DB queries → Redis calls → Socket emits          │
│  Allows full trace of any request in log aggregator              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 15. How All Four Apps Connect

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONNECTIVITY MAP                              │
│                                                                  │
│  ┌──────────────────┐                                            │
│  │  Customer App     │  Expo / React Native                      │
│  │  (ajkmart)        │  Auth: /api/auth  (phone OTP / social)    │
│  │                   │  API:  /api/*     (ACCESS_TOKEN_SECRET)   │
│  │                   │  Socket: user:{userId} room               │
│  └──────────────────┘                                            │
│          │                                                       │
│  ┌──────────────────┐                                            │
│  │  Rider App        │  React + Capacitor (PWA/mobile)           │
│  │  (rider-app)      │  Auth: /api/auth  (same pipeline)         │
│  │                   │  API:  /api/*     (role=rider guard)      │
│  │                   │  Socket: rider:{userId} room              │
│  └──────────────────┘                                            │
│          │                 ┌──────────────────────────────────┐  │
│  ┌──────────────────┐      │         API SERVER               │  │
│  │  Vendor App       │ ←──▶│  Express + Socket.IO             │  │
│  │  (vendor-app)     │      │  :8000  /api base path           │  │
│  │                   │      │                                  │  │
│  │  Auth: /api/auth  │      │  PostgreSQL ← Drizzle ORM        │  │
│  │  API:  /api/*     │      │  Redis     ← Rate limits + cache │  │
│  │  Socket: vendor:  │      └──────────────────────────────────┘  │
│  │  {userId} room    │                                            │
│  └──────────────────┘                                            │
│          │                                                       │
│  ┌──────────────────┐                                            │
│  │  Admin Panel      │  React + Vite (web only)                  │
│  │  (admin)          │  Auth: /api/admin/auth (SEPARATE secret)  │
│  │                   │  CSRF: X-CSRF-Token on mutations          │
│  │                   │  IP Whitelist: enforced on /api/admin/*   │
│  │                   │  API:  /api/admin/* (adminGuard)          │
│  │                   │  Socket: admin-fleet room + admin:{id}    │
│  └──────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Auth Secrets Isolation

```
┌──────────────────────────────────────────────────────────────────┐
│  APP                  TOKEN SECRET                               │
├──────────────────────────────────────────────────────────────────┤
│  Customer / Rider     ACCESS_TOKEN_SECRET                        │
│  / Vendor             REFRESH_TOKEN_SECRET                       │
│                       (shared — role differentiates in payload)  │
├──────────────────────────────────────────────────────────────────┤
│  Admin Panel          ADMIN_ACCESS_TOKEN_SECRET  ← DIFFERENT     │
│                       REFRESH_TOKEN_SECRET       ← same store    │
│                       + CSRF token               ← extra layer   │
│                       + IP whitelist             ← extra layer   │
└──────────────────────────────────────────────────────────────────┘
```

### Mobile App Resilience

```
┌─────────────────────────────────────────────────────────────────┐
│  Mobile apps (Customer, Rider, Vendor) include:                  │
│                                                                  │
│  X-Idempotency-Key header on all mutations                       │
│    → Prevents double orders/payments on network retry            │
│                                                                  │
│  Automatic 401 handling (mutex-guarded refresh):                 │
│    → One refresh at a time (no concurrent refresh storms)        │
│    → All queued requests retry after token refreshed             │
│                                                                  │
│  userApiLimiter: 600 req/min                                     │
│    → Calibrated to allow high-frequency GPS + status polling     │
│                                                                  │
│  Socket auto-reconnect:                                          │
│    → Exponential backoff on disconnect                           │
│    → Re-auth handshake on reconnect                              │
│    → Missed events fetched via REST on reconnect                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 16. Request Lifecycle — End to End

A complete trace of `POST /api/orders` (customer placing an order):

```
CLIENT (Customer App)
  │
  │  POST /api/orders
  │  Authorization: Bearer <access_token>
  │  X-Idempotency-Key: <uuid>
  │  Cookie: refreshToken=<httponly>
  │  Body: { storeId, items, deliveryAddress, paymentMethod }
  │
  ▼
LAYER 1 — pino-http assigns requestId = "abc-123"
  │
  ▼
LAYER 2 — helmet sets security headers, cors validates origin
  │
  ▼
LAYER 3 — cookieParser, express.json parse body
  │
  ▼
LAYER 4 — sanitizeBody strips any XSS from item names/instructions
           suspiciousPatternDetector: clean ✅
  │
  ▼
LAYER 5 — Rate limit check:
           Redis: ratelimit:<ip>:/api/orders → count=3, limit=600 ✅
  │
  ▼
LAYER 6 — checkSessionRevocation:
           Redis GET session:bl:SHA256(<token>) → null (not revoked) ✅
           verifyTokenFamily: familyId not in revoked set ✅
  │
  ▼
LAYER 7 — authenticateUser:
           jwt.verify(token, ACCESS_TOKEN_SECRET) → valid ✅
           tokenVersion matches DB ✅
           req.user = { userId, role: "customer", ... }
  │
  ▼
ROUTE HANDLER — orderRouter: POST /api/orders
  │
  ├─ Zod schema validation → valid ✅
  │
  ├─ idempotency middleware:
  │    SELECT idempotency_keys WHERE key=<uuid> → NOT FOUND
  │    INSERT { key, userId, status: "processing" }
  │
  ├─ POST /api/orders/validate-cart logic:
  │    Check stock, store open, min order, promo, delivery zone
  │    All OK ✅
  │
  ├─ Payment handling:
  │    paymentMethod = "wallet"
  │    SELECT wallet balance → PKR 2,400 ≥ PKR 218 ✅
  │
  ├─ DB Transaction (atomic):
  │    INSERT orders { id, customerId, vendorId, items, total... }
  │    INSERT order_items [...]
  │    UPDATE users SET walletBalance = walletBalance - 218
  │    INSERT wallet_transactions { type: "order_debit", amount: 218 }
  │    UPDATE idempotency_keys SET status="complete", responseBody=...
  │
  ├─ Loyalty points:
  │    earnedPoints = floor(218 / 100) * 10 = 20 pts
  │    UPDATE users SET loyaltyPoints = loyaltyPoints + 20
  │
  ├─ Socket emit:
  │    io.to("user:{customerId}").emit("order:ack", { orderId })
  │    io.to("vendor:{vendorId}").emit("order:new", { orderId, ... })
  │
  ├─ FCM push notification → vendor app (if backgrounded)
  │
  ├─ Audit log: (not applicable — customer action, not admin)
  │
  └─ Response:
       {
         success: true,
         data: { orderId, status: "pending", estimatedTime: 30 }
       }
  │
  ▼
LAYER 8 — pino-http logs: POST /api/orders 201 142ms requestId=abc-123
  │
  ▼
CLIENT receives 201 Created → navigates to Order Tracking screen
```

---

*End of AJKMART API Server – Complete Logic Flow Document*
