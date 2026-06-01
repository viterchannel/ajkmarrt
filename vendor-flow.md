# AJKMART Vendor App – Complete Logic Flow (Visual)

> **Theme:** Dark mode with yellow/gold accents (PRESERVED — do NOT change)
> **Purpose:** Complete visual reference for every vendor-app flow
> **Last Updated:** 2026-05-28

---

## Table of Contents

1. [App Launch & Auth Check](#1-app-launch--auth-check)
2. [Registration Flow](#2-registration-flow)
3. [Login Flow](#3-login-flow)
4. [Dashboard / Home](#4-dashboard--home)
5. [Store Status Toggle](#5-store-status-toggle)
6. [Order Management](#6-order-management)
7. [Product Management](#7-product-management)
8. [Profile & Verification (KYC)](#8-profile--verification-kyc)
9. [Wallet & Financials](#9-wallet--financials)
10. [Analytics & Promotions (KYC Gated)](#10-analytics--promotions-kyc-gated)
11. [Reviews & Ratings](#11-reviews--ratings)
12. [Store Settings](#12-store-settings)
13. [Chat (Customer & Rider)](#13-chat-customer--rider)
14. [Socket Events Reference](#14-socket-events-reference)
15. [Feature Gate & KYC Gate System](#15-feature-gate--kyc-gate-system)
16. [Progressive Gate Overlays](#16-progressive-gate-overlays)
17. [Platform Config & App States](#17-platform-config--app-states)
18. [Backend API Routes Reference](#18-backend-api-routes-reference)
19. [Theme Style Guide](#19-theme-style-guide)

---

## 1. App Launch & Auth Check

```
┌─────────────────────────────────────────────────────────────────┐
│                    APP LAUNCH  (index.html)                      │
│               Load React + Capacitor/Vite shell                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│        GET /api/platform-config  →  load feature flags           │
│        Check app status:                                         │
│          "maintenance" → show MaintenanceScreen (5-min grace)    │
│          "limited"     → show AnnouncementBar (non-blocking)     │
│          "active"      → proceed normally                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│        Check sessionStorage for access_token                     │
│        (tab-scoped — cleared on tab close)                       │
└─────────────────────────────────────────────────────────────────┘
                 │                             │
           TOKEN FOUND                   NO TOKEN
                 │                             │
                 ▼                             ▼
┌──────────────────────────┐     ┌──────────────────────────────┐
│  POST /api/auth/validate  │     │       Guest Landing           │
│       -token              │     │  • Login button               │
│  Verify with backend      │     │  • Register button            │
└──────────────────────────┘     └──────────────────────────────┘
          │           │
       VALID        INVALID
          │           │
          │           ▼
          │     Clear token → Guest Landing
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  GATE CHECK SEQUENCE                             │
│                                                                  │
│  [1] approvalStatus === "pending"?                               │
│       → Show ApprovalPendingOverlay (full screen block)          │
│                                                                  │
│  [2] approvalStatus === "rejected"?                              │
│       → Show AccountRejectedOverlay with reason                  │
│                                                                  │
│  [3] needsIdCard === true?                                       │
│       → Show IdCardGateModal (forced, cannot dismiss)            │
│                                                                  │
│  [4] ALL CLEAR → Navigate to DASHBOARD (/)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DASHBOARD (Home)                             │
│   • GET /api/vendor/me  → fetch vendor profile + store info      │
│   • GET /api/orders?status=pending  → live order feed            │
│   • Connect Socket.IO  → listen for order:new events             │
│   • Show AnnouncementBar if platform status = "limited"          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Registration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     REGISTRATION SCREEN                          │
└─────────────────────────────────────────────────────────────────┘
```

### Step 1 — Personal Details

```
┌──────────────────────────────────────────────────────────────────┐
│  FIELD                REQUIRED   VALIDATION                       │
├──────────────────────────────────────────────────────────────────┤
│  Full Name            YES        min 2 characters                 │
│  Phone Number         YES        03XXXXXXXXX format               │
│  Email                NO         valid email format if provided   │
│  CNIC / ID Number     YES        XXXXX-XXXXXXX-X format           │
│  City                 YES        dropdown (GET /api/public/zones) │
│  Area                 YES        dropdown (linked to city)        │
│  Full Address         YES        free text                        │
└──────────────────────────────────────────────────────────────────┘
```

### Step 2 — Business / Store Details

```
┌──────────────────────────────────────────────────────────────────┐
│  FIELD                REQUIRED   NOTES                            │
├──────────────────────────────────────────────────────────────────┤
│  Store Name           YES        public-facing name               │
│  Store Category       YES        Food / Mart / Pharmacy / Other   │
│  Store Logo           NO         image upload                     │
│  Business Description NO         short text                       │
│  Store Phone          YES        contact number for customers     │
│  Opening Hours        YES        from / to time per day           │
│  Delivery Radius (km) YES        numeric                          │
└──────────────────────────────────────────────────────────────────┘
```

### Step 3 — Password & Terms

```
┌──────────────────────────────────────────────────────────────────┐
│  FIELD                REQUIRED   VALIDATION                       │
├──────────────────────────────────────────────────────────────────┤
│  Password             YES        8+ chars, 1 uppercase,           │
│                                  1 number, 1 symbol               │
│  Confirm Password     YES        must match                       │
│  Terms & Conditions   YES        checkbox must be checked         │
└──────────────────────────────────────────────────────────────────┘
```

### On "Register" Button Click

```
┌─────────────────────────────────────────────────────────────────┐
│  POST /api/auth/register  { all fields }                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND VALIDATION                           │
│                                                                  │
│   phone unique?       NO → 409  "Phone already exists"           │
│   email unique?       NO → 409  "Email already exists"           │
│   cnic unique?        NO → 409  "CNIC already registered"        │
│   password strong?    NO → 400  "Weak password"                  │
│   required fields?    NO → 400  "Missing required fields"        │
│                                                                  │
│   ALL OK → INSERT users + vendor_profile + store                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ACCOUNT CREATED                              │
│                                                                  │
│   isActive            = true                                     │
│   phoneVerified       = false                                    │
│   emailVerified       = false                                    │
│   documentsApproved   = false                                    │
│   approvalStatus      = "pending"  ← admin must approve          │
│   kycStatus           = "none"                                   │
│   storeStatus         = "closed"  (default)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│   Backend returns:  access_token + refresh_token                 │
│   Frontend stores → ApprovalPendingOverlay shown                 │
│   (Vendor cannot use app until admin approves)                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Login Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                       LOGIN SCREEN                               │
│                                                                  │
│   Method 1:  Phone + OTP           (Primary)                     │
│   Method 2:  Email + OTP                                         │
│   Method 3:  Username + Password                                 │
│   Method 4:  Social Login → Google / Facebook                    │
│   Method 5:  Magic Link (email passwordless)                     │
│   Method 6:  Biometric (FaceID / Fingerprint — returning users)  │
│   Method 7:  Forgot Password → /forgot-password                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND PROCESSING                            │
│   POST /api/auth/login                                           │
│                                                                  │
│   Find user by phone / email / username                          │
│   Verify credential (OTP / password hash / OAuth token)          │
│   Account banned?    → 403  "Account suspended"                  │
│   Account deleted?   → 403  "Account not found"                  │
│   phoneVerified=false → OK  (login still allowed)                │
│   Generate access_token (short-lived) + refresh_token            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND STORAGE                             │
│                                                                  │
│   access_token   → sessionStorage  (tab-scoped)                  │
│   refresh_token  → Secure storage (Capacitor Preferences)        │
│   Biometric?     → Stash refresh_token in biometric vault        │
│   isAuthenticated = true                                         │
│   Navigate → Gate Check → DASHBOARD                              │
└─────────────────────────────────────────────────────────────────┘
```

### Token Refresh Flow (Auto — 401 Mutex + Circuit Breaker)

```
┌─────────────────────────────────────────────────────────────────┐
│   API call returns 401 Unauthorized                             │
│   → resilient-fetcher catches 401                               │
│   → acquire refresh mutex (one refresh at a time)               │
│   → POST /api/auth/refresh  (secure storage)                     │
│       ├─ SUCCESS → store new access_token → retry original call  │
│       └─ FAIL    → clear tokens → redirect to /login            │
│                                                                  │
│   API returns 5xx (server error):                               │
│   → exponential backoff retry                                   │
│   → circuit breaker trips after repeated failures               │
│   → 30-second cooldown before retrying that endpoint            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Dashboard / Home

```
┌─────────────────────────────────────────────────────────────────┐
│                         Dashboard                                │
├─────────────────────────────────────────────────────────────────┤
│  TOP — STORE STATUS CARD                                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Store Name: Ali Mart          AJK-ID: VND-XYZ789          │  │
│  │  Category: Mart                Rating: ★ 4.7 (132 reviews) │  │
│  │  Wallet Balance: PKR 12,400                                │  │
│  │  ● OPEN / ○ CLOSED  [toggle]                               │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  ANNOUNCEMENT BAR  (if platform status = "limited")              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ⚠  System running in limited mode. Some features delayed. │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  QUICK STATS CARDS  (today's numbers)                            │
│  ┌──────────────┬───────────────┬──────────────┬─────────────┐  │
│  │  New Orders  │  Processing   │  Delivered   │  Cancelled  │  │
│  │     🔴 4      │     🟡 2       │     ✅ 18    │     ❌ 1   │  │
│  └──────────────┴───────────────┴──────────────┴─────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  REVENUE SUMMARY                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Today: PKR 8,400  │  This Week: PKR 42,000                │  │
│  │  Commission (10%): PKR 4,200  │  Net Payout: PKR 37,800    │  │
│  └────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  VERIFICATION BANNER  (if any flag missing)                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ⚠  Verify phone to enable order notifications [Verify →]  │  │
│  │  ⚠  Upload documents to unlock Analytics & Promos [→]     │  │
│  │  ⚠  Verify email to enable withdrawals [Verify →]          │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  LIVE INCOMING ORDERS  (Socket.IO — order:new)                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🔔 NEW ORDER  •  Order #1042  •  2 mins ago               │  │
│  │  Customer: Ali K.   Items: 3   Total: PKR 680              │  │
│  │  Delivery Address: F-7/2, Islamabad                        │  │
│  │              [❌ Reject]         [✅ Accept]                │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  BOTTOM NAVIGATION  (5 tabs)                                     │
│  ┌────────┬────────┬──────────┬────────┬────────┐               │
│  │  🏠     │  📦     │  🛍      │  💰     │  👤    │               │
│  │  Home  │ Orders │ Products │ Wallet │Profile │               │
│  └────────┴────────┴──────────┴────────┴────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Store Status Toggle

```
┌─────────────────────────────────────────────────────────────────┐
│  Vendor taps OPEN / CLOSED toggle                               │
└─────────────────────────────────────────────────────────────────┘
                 │                             │
           OPENING STORE                 CLOSING STORE
                 │                             │
                 ▼                             ▼
┌──────────────────────────┐   ┌──────────────────────────────┐
│  PATCH /api/store/status  │   │  PATCH /api/store/status      │
│  { status: "open" }       │   │  { status: "closed" }         │
│                           │   │  Pending orders still served  │
│  Store visible to         │   │  New orders blocked           │
│  customers in feed        │   └──────────────────────────────┘
│  Orders start arriving    │
└──────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Socket room joined: vendor:{vendorId}                           │
│  FCM push notifications enabled for order:new events            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Order Management

### Order Tabs (`Orders.tsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│                        ORDERS PAGE                               │
│  ┌──────────┬────────────┬────────────┬────────────────────┐    │
│  │  🔴 New  │  🟡 Active  │  ✅ Done   │   ❌ Cancelled      │    │
│  │  (4)     │  (2)        │  (18)      │   (1)              │    │
│  └──────────┴────────────┴────────────┴────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### New Order — Accept / Reject

```
┌─────────────────────────────────────────────────────────────────┐
│  Socket event:  order:new                                        │
│  • Play notification sound                                       │
│  • Show banner on dashboard + New tab badge increments           │
│  • Push notification via FCM (if app backgrounded)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                   ┌──────────┴──────────┐
              ACCEPT                  REJECT
                   │                     │
                   ▼                     ▼
┌──────────────────────────┐  ┌─────────────────────────────────┐
│  PATCH /api/orders/:id    │  │  PATCH /api/orders/:id           │
│  { status: "confirmed" }  │  │  { status: "rejected",          │
│                           │  │    reason: "out_of_stock" }      │
│  Order moves to           │  │  Customer notified               │
│  Active tab               │  │  Order moves to Cancelled tab    │
└──────────────────────────┘  └─────────────────────────────────┘
```

### Order Lifecycle Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORDER STATUS PIPELINE                         │
│                                                                  │
│   [pending]                                                      │
│       │  Vendor sees new order, accepts                          │
│       ▼                                                          │
│   [confirmed]                                                    │
│       │  Vendor taps "Start Preparing"                           │
│       │  PATCH /api/orders/:id  { status: "preparing" }          │
│       ▼                                                          │
│   [preparing]                                                    │
│       │  Vendor taps "Ready for Pickup"                          │
│       │  PATCH /api/orders/:id  { status: "ready" }              │
│       │  System auto-assigns rider OR vendor assigns manually     │
│       ▼                                                          │
│   [ready]                                                        │
│       │  Rider accepts pickup                                     │
│       │  Rider arrives at vendor store                           │
│       │  GPS minimap shows rider location live                   │
│       ▼                                                          │
│   [picked_up / in_transit]                                       │
│       │  Rider heading to customer                               │
│       ▼                                                          │
│   [delivered]                                                    │
│       │  Rider confirms delivery                                 │
│       │  Earnings auto-settled to vendor wallet (minus commission)│
│       ▼                                                          │
│   [completed]  ←  Final state                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Rider Assignment

```
┌─────────────────────────────────────────────────────────────────┐
│  When order is "ready":                                          │
│                                                                  │
│  AUTO-ASSIGN  (default)                                          │
│  → System broadcasts to nearest online riders                    │
│  → First rider to accept gets the order                          │
│  → ride:assigned socket event fires                              │
│                                                                  │
│  MANUAL ASSIGN                                                   │
│  → Vendor opens rider list                                       │
│  → GET /api/riders/available?lat=&lng=                           │
│  → Select specific rider → POST /api/orders/:id/assign-rider     │
│  → Rider notified via socket + FCM                               │
└─────────────────────────────────────────────────────────────────┘
```

### Bulk Actions

```
┌─────────────────────────────────────────────────────────────────┐
│  Select multiple orders → Bulk Action toolbar appears            │
│                                                                  │
│  [✅ Bulk Accept]  →  PATCH /api/orders/bulk-accept              │
│  [❌ Bulk Reject]  →  PATCH /api/orders/bulk-reject              │
│  [🖨 Print Labels] →  generate PDF labels                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Product Management

```
┌─────────────────────────────────────────────────────────────────┐
│                       PRODUCTS PAGE                              │
│   GET /api/products?vendorId=me  (paginated inventory list)      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🔍 Search products...          [+ Add Product]  [📤 Bulk] │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  PRODUCT CARD:                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  [IMG]  Mineral Water 1.5L                    PKR 80       │  │
│  │         Stock: 240 units    ⚠ Low Stock: 10 left           │  │
│  │         Category: Beverages                                │  │
│  │         [✏ Edit]  [🔁 Stock]  [👁 Toggle Active]  [🗑 Del] │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Add / Edit Product

```
┌─────────────────────────────────────────────────────────────────┐
│  PRODUCT FORM                                                    │
│                                                                  │
│  FIELD               REQUIRED   NOTES                            │
│  ─────────────────────────────────────────────────              │
│  Product Name        YES        min 2 chars                      │
│  Category            YES        from platform category list      │
│  Price (PKR)         YES        numeric, > 0                     │
│  Sale Price          NO         must be < regular price          │
│  Stock Quantity      YES        numeric                          │
│  Low Stock Alert     NO         threshold for warning badge      │
│  Description         NO         rich text                        │
│  Images              YES        min 1 photo, max 5               │
│  SKU / Barcode       NO         for inventory tracking           │
│  Is Active           YES        toggle to show/hide in store     │
└─────────────────────────────────────────────────────────────────┘
                              │
                   ┌──────────┴──────────┐
                  ADD                  EDIT
                   │                     │
                   ▼                     ▼
         POST /api/products      PATCH /api/products/:id
                   │                     │
                   ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              FEATURE GATE CHECK: add_product                     │
│              Requires: documents_approved = true                 │
│              → GATE CLOSED: 403 "Upload documents to add products"│
└─────────────────────────────────────────────────────────────────┘
```

### Bulk Upload / Edit

```
┌─────────────────────────────────────────────────────────────────┐
│  Tap [📤 Bulk Upload]                                             │
│  Download CSV template → fill product data → upload CSV          │
│  POST /api/products/bulk-upload  (multipart CSV)                 │
│                                                                  │
│  Backend processes rows:                                         │
│  • Valid rows → inserted/updated                                 │
│  • Invalid rows → error report returned                          │
│  • Results shown as success/fail summary                         │
└─────────────────────────────────────────────────────────────────┘
```

### Stock History

```
┌─────────────────────────────────────────────────────────────────┐
│  Tap [🔁 Stock] on any product                                   │
│  GET /api/products/:id/stock-history                             │
│                                                                  │
│  Shows log of:                                                   │
│  • Manual stock adjustments (who, when, +/- qty)                 │
│  • Auto-deductions from delivered orders                         │
│  • Restocks via bulk edit                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Profile & Verification (KYC)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Profile.tsx                               │
│   GET /api/verification/status  →  load all verification flags   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  VERIFICATION STATUS CARD                        │
│                                                                  │
│  ✅  CNIC / ID Card Number                                       │
│      Provided at registration → Auto-verified                    │
│                                                                  │
│  🟡  PHONE VERIFICATION                                          │
│      Status: NOT VERIFIED                                        │
│      [Send OTP] → POST /api/verification/phone/send              │
│      Enter 6-digit code                                          │
│      [Confirm] → POST /api/verification/phone/confirm            │
│      ├─ Success: phoneVerified = true                            │
│      └─ Bonus:   PKR 20 auto-credited to wallet                  │
│                                                                  │
│  🟡  EMAIL VERIFICATION  (shown if email provided)               │
│      Status: NOT VERIFIED                                        │
│      [Send OTP] → POST /api/verification/email/send              │
│      Enter 6-digit code                                          │
│      [Confirm] → POST /api/verification/email/confirm            │
│      └─ Success: emailVerified = true                            │
│                                                                  │
│  🟡  DOCUMENT UPLOAD (KYC)                                       │
│      Status: NOT SUBMITTED                                       │
│      [Upload Documents]                                          │
│      Upload: CNIC front + CNIC back + Business License           │
│      POST /api/verification/documents  (multipart/form-data)     │
│      kycStatus = "pending" → admin reviews in Admin Panel        │
│      Admin APPROVES → documentsApproved = true                   │
│                         kycStatus = "verified"                   │
│      Admin REJECTS  → kycStatus = "rejected" + reason shown      │
└─────────────────────────────────────────────────────────────────┘

Verification State & What Each Unlocks:
┌───────────────────────────┬─────────────┬──────────────────────┐
│  Flag                     │  Value      │  Unlocks             │
├───────────────────────────┼─────────────┼──────────────────────┤
│  phoneVerified            │  true/false │  Order notifications  │
│  emailVerified            │  true/false │  Wallet withdrawals  │
│  documentsApproved        │  true/false │  Add products,        │
│                           │             │  Analytics, Promos   │
│  kycStatus                │  none /     │  "verified" unlocks   │
│                           │  pending /  │  full KYC features   │
│                           │  verified / │                      │
│                           │  rejected   │                      │
└───────────────────────────┴─────────────┴──────────────────────┘
```

### Verification Bonus System

```
┌─────────────────────────────────────────────────────────────────┐
│  BONUS TRACKING                                                  │
│                                                                  │
│  Phone Verified   →  PKR 20 wallet bonus (auto-credited)         │
│  KYC Approved     →  PKR 100 wallet bonus (auto-credited)        │
│                                                                  │
│  GET /api/verification/bonus-status  →  show claimed/unclaimed   │
│  POST /api/verification/claim-bonus  →  claim pending bonus      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Wallet & Financials

### Wallet Tab (`Wallet.tsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│                        WALLET TAB                                │
│   GET /api/wallet  (cursor-paginated transactions)               │
│                                                                  │
│  BALANCE CARD                                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Available Balance:  PKR 12,400                            │  │
│  │  Pending (settling): PKR 3,200                             │  │
│  │  Total Earned:       PKR 95,000  (all time)                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────┬──────────────────┬─────────────────┐          │
│  │ [💸 Withdraw] │  [💳 Deposit]     │  [📋 History]   │          │
│  └──────────────┴──────────────────┴─────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Withdrawal Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Vendor taps [💸 Withdraw]                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│            FEATURE GATE CHECK: withdraw_money                    │
│            Requires: email_verified + documents_approved         │
└─────────────────────────────────────────────────────────────────┘
          │                              │
    GATE OPEN                      GATE CLOSED
          │                              │
          ▼                              ▼
┌──────────────────────────┐  ┌──────────────────────────────────┐
│  WithdrawModal            │  │  403 Response:                   │
│  • Enter amount           │  │  "Verify email and upload        │
│    (min: PKR 500)         │  │  documents to enable             │
│  • Select method:         │  │  withdrawals"                    │
│    - Bank Transfer        │  │  → Redirect to Profile >         │
│    - EasyPaisa            │  │    Verification                  │
│    - JazzCash             │  └──────────────────────────────────┘
│  • Admin approval flow    │
│  POST /api/withdraw       │
│  { amount, method,        │
│    accountDetails }       │
└──────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Biometric confirmation (FaceID / Fingerprint if enabled)        │
│  Withdrawal request queued → admin approves payout               │
│  Processing time set by platformConfig.withdrawalDays            │
└─────────────────────────────────────────────────────────────────┘
```

### Auto-Settlement Logic

```
┌─────────────────────────────────────────────────────────────────┐
│  Order completes (status = "delivered")                          │
│                                                                  │
│  Order Total:            PKR 680                                 │
│  Platform Commission:    PKR 68   (10% — from platformConfig)    │
│  Net to Vendor:          PKR 612                                 │
│                                                                  │
│  → PKR 612 auto-credited to vendor wallet                        │
│  → Transaction logged: type = "order_credit"                     │
└─────────────────────────────────────────────────────────────────┘
```

### Deposit Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Vendor taps [💳 Deposit]                                        │
│  See bank account details (platform bank info)                   │
│  Transfer manually                                               │
│  Upload bank transfer receipt (image)                            │
│  POST /api/wallet/deposit { amount, receipt_image }              │
│  Admin confirms → amount credited to wallet                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Analytics & Promotions (KYC Gated)

### Analytics (`Analytics.tsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Vendor taps Analytics tab                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              KYC GATE CHECK                                      │
│              Requires: kycStatus === "verified"                  │
└─────────────────────────────────────────────────────────────────┘
          │                              │
    GATE OPEN                      GATE CLOSED
          │                              │
          ▼                              ▼
┌──────────────────────────┐  ┌──────────────────────────────────┐
│  ANALYTICS DASHBOARD      │  │  KYC Gate Overlay                │
│                           │  │  "Complete KYC verification to   │
│  Date Range Picker:       │  │   access analytics"              │
│  Today / 7d / 30d / Custom│  │  [Go to Verification →]          │
│                           │  └──────────────────────────────────┘
│  CHARTS:                  │
│  • Revenue trend (line)   │
│  • Orders per day (bar)   │
│  • Top selling products   │
│  • Peak hours heatmap     │
│  • Customer return rate   │
│  • Average order value    │
│                           │
│  GET /api/analytics        │
│  ?from=&to=&vendorId=me   │
└──────────────────────────┘
```

### Promotions (`Promos.tsx`) — KYC Gated

```
┌─────────────────────────────────────────────────────────────────┐
│  PROMOTIONS  (Requires kycStatus = "verified")                   │
├─────────────────────────────────────────────────────────────────┤
│  CREATE DISCOUNT CODE                                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Code:        SUMMER20                                     │  │
│  │  Type:        Percentage / Fixed Amount                    │  │
│  │  Value:       20%                                          │  │
│  │  Min Order:   PKR 500                                      │  │
│  │  Max Uses:    100  (leave blank for unlimited)             │  │
│  │  Expiry:      2026-06-30                                   │  │
│  │  [Create Promo] → POST /api/promos                         │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

AD CAMPAIGNS  (Campaigns.tsx) — KYC Gated
┌─────────────────────────────────────────────────────────────────┐
│  Boost store visibility in customer feed                         │
│  • Select campaign duration (1 day / 7 days / 30 days)          │
│  • Set daily budget (PKR)                                        │
│  • Preview how store will appear                                 │
│  • POST /api/campaigns  →  admin reviews + activates             │
│  • Budget deducted from wallet balance                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Reviews & Ratings

```
┌─────────────────────────────────────────────────────────────────┐
│                       REVIEWS PAGE                               │
│   GET /api/reviews?vendorId=me  (paginated)                      │
│                                                                  │
│  OVERALL RATING: ★ 4.7  (132 reviews)                            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  5 ★ ████████████████████░░  82%                           │  │
│  │  4 ★ ████░░░░░░░░░░░░░░░░░  12%                           │  │
│  │  3 ★ █░░░░░░░░░░░░░░░░░░░░   4%                           │  │
│  │  2 ★ ░░░░░░░░░░░░░░░░░░░░░   1%                           │  │
│  │  1 ★ ░░░░░░░░░░░░░░░░░░░░░   1%                           │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  REVIEW CARD:                                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ★★★★★   Ahmad R.   •  Order #1041  •  2 days ago          │  │
│  │  "Fast delivery, items were fresh!"                        │  │
│  │  [↩ Reply] → POST /api/reviews/:id/reply                   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Store Settings

```
┌─────────────────────────────────────────────────────────────────┐
│                      STORE SETTINGS                              │
│   GET /api/store/me  →  load store profile                       │
│   PATCH /api/store/me  →  save changes                           │
│                                                                  │
│  SECTIONS:                                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  📷 Store Logo / Banner      [Upload Image]                │  │
│  │  🏪 Store Name               [Edit]                        │  │
│  │  📝 Description              [Edit]                        │  │
│  │  📞 Store Phone              [Edit]                        │  │
│  │  📍 Address / Location       [Edit + Map Pin]              │  │
│  │  📦 Delivery Radius          [Slider: 1–20 km]             │  │
│  │  💸 Min Order Amount         [PKR field]                   │  │
│  │  🕐 Opening Hours            [Per-day time pickers]        │  │
│  │  🚫 Blocked Dates            [Date picker for holidays]    │  │
│  │  🔔 Notification Preferences [Toggles]                     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 13. Chat (Customer & Rider)

```
┌─────────────────────────────────────────────────────────────────┐
│                         CHAT TAB                                 │
│   GET /api/chat/threads?vendorId=me                              │
│                                                                  │
│  THREAD LIST:                                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  👤 Ahmad K.  • Order #1042  • "Is my order ready?"  2m   │  │
│  │  🏍 Rider Hassan  • "Arrived at store"                8m   │  │
│  │  🛡 Admin Support  • "KYC approved!"                 1h   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  CHAT SCREEN:                                                    │
│  • Real-time via Socket.IO  admin:chat / customer:chat events    │
│  • Image send (order proof, receipts)                            │
│  • Order context card shown at top of thread                     │
│  • POST /api/chat/send  { threadId, message, image? }            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 14. Socket Events Reference

```
┌──────────────────────┬───────────────┬────────────────────────┬──────────────────────────┐
│  Event Name          │  Direction    │  Payload               │  Action                   │
├──────────────────────┼───────────────┼────────────────────────┼──────────────────────────┤
│  connect             │  OUT          │  { token: JWT }         │  Join vendor room         │
├──────────────────────┼───────────────┼────────────────────────┼──────────────────────────┤
│  order:new           │  IN           │  { orderId, items,      │  Play sound + banner +    │
│                      │               │    total, customer }    │  badge increment           │
│  order:update        │  IN           │  { orderId, status }    │  Sync order card UI       │
├──────────────────────┼───────────────┼────────────────────────┼──────────────────────────┤
│  rider:location      │  IN           │  { riderId, lat, lng }  │  Update GPS minimap       │
│                      │               │                        │  (live rider on map)      │
│  ride:assigned       │  IN           │  { riderId, orderId }   │  Show rider info on order │
├──────────────────────┼───────────────┼────────────────────────┼──────────────────────────┤
│  notification:new    │  IN           │  { title, body, type }  │  In-app notification bell │
│  admin:chat          │  IN           │  { message, from }      │  Show in Chat tab         │
│  customer:chat       │  IN           │  { message, orderId }   │  Show in Chat thread      │
├──────────────────────┼───────────────┼────────────────────────┼──────────────────────────┤
│  disconnect          │  AUTO         │  —                      │  Auto-reconnect           │
└──────────────────────┴───────────────┴────────────────────────┴──────────────────────────┘
```

---

## 15. Feature Gate & KYC Gate System

### Feature Gate (API Middleware)

```
┌─────────────────────────────────────────────────────────────────┐
│                     feature_rules Table                          │
├──────────────┬──────────────────┬──────────────────────────────┐
│  role        │  feature_name    │  required_verifications       │
├──────────────┼──────────────────┼──────────────────────────────┤
│  vendor      │  add_product     │  ["documents_approved"]       │
│  vendor      │  withdraw_money  │  ["email_verified",           │
│              │                  │   "documents_approved"]       │
│  vendor      │  run_campaign    │  ["documents_approved",       │
│              │                  │   "kycStatus=verified"]       │
└──────────────┴──────────────────┴──────────────────────────────┘
```

### KYC Gate (Frontend — `KycGate` component)

```
┌─────────────────────────────────────────────────────────────────┐
│  Vendor navigates to gated page                                  │
│  (Analytics / Promotions / Campaigns)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│   Check: kycStatus === "verified" ?                              │
└─────────────────────────────────────────────────────────────────┘
          │                              │
         YES                            NO
          │                              │
          ▼                              ▼
┌──────────────────────┐    ┌────────────────────────────────────┐
│  Show page content   │    │  KYC Gate Overlay (full screen)     │
└──────────────────────┘    │  "This feature requires KYC         │
                            │   verification"                     │
                            │  Status shown:                      │
                            │   none    → [Start KYC →]           │
                            │   pending → "Under review..."       │
                            │   rejected→ "Rejected: <reason>"    │
                            │              [Re-submit →]          │
                            └────────────────────────────────────┘
```

---

## 16. Progressive Gate Overlays

```
┌─────────────────────────────────────────────────────────────────┐
│  App loads → runs gate checks in this exact order:              │
│                                                                  │
│  GATE 1: Maintenance Gate                                        │
│  ─────────────────────────────────────────────────────────────  │
│  IF config.platform.appStatus === "maintenance"                  │
│  → 5-minute grace period (countdown shown)                       │
│  → After 5 min: full-screen MaintenanceScreen                    │
│  → All routes blocked                                            │
│                                                                  │
│  GATE 2: Approval Gate                                           │
│  ─────────────────────────────────────────────────────────────  │
│  IF approvalStatus === "pending"                                  │
│  → Show ApprovalPendingOverlay                                   │
│  → "Your vendor account is under review (1-2 business days)"    │
│  → All routes blocked until admin approves                       │
│                                                                  │
│  IF approvalStatus === "rejected"                                 │
│  → Show AccountRejectedOverlay with rejection reason             │
│  → Contact support link shown                                    │
│                                                                  │
│  GATE 3: ID Card Gate                                            │
│  ─────────────────────────────────────────────────────────────  │
│  IF needsIdCard === true  (CNIC not on file)                     │
│  → Show IdCardGateModal  (cannot be dismissed)                   │
│  → Vendor must submit CNIC to continue                           │
│  → POST /api/vendor/cnic  →  gate clears                         │
│                                                                  │
│  GATE 4: KYC Gate  (per-feature, not app-wide)                   │
│  ─────────────────────────────────────────────────────────────  │
│  IF accessing Analytics / Promos / Campaigns                     │
│  AND kycStatus !== "verified"                                    │
│  → Show KycGate overlay on that route only                       │
│  → Other routes remain accessible                                │
│                                                                  │
│  ALL GATES CLEAR → Full app access                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 17. Platform Config & App States

```
┌─────────────────────────────────────────────────────────────────┐
│            GET /api/platform-config  (on every app boot)         │
│                                                                  │
│  APP STATUS:                                                     │
│  ┌──────────────┬────────────────────────────────────────────┐  │
│  │  "active"    │  Normal operation                          │  │
│  │  "limited"   │  Degraded — AnnouncementBar shown          │  │
│  │  "maintenance│  Full block after 5-min grace period       │  │
│  └──────────────┴────────────────────────────────────────────┘  │
│                                                                  │
│  MODULES  (can be disabled per deployment):                      │
│  ┌──────────────────┬─────────────────────────────────────┐     │
│  │  wallet          │  Show Wallet tab                    │     │
│  │  analytics       │  Show Analytics tab                 │     │
│  │  promotions      │  Show Promos tab                    │     │
│  │  campaigns       │  Show Campaigns tab                 │     │
│  │  reviews         │  Show Reviews tab                   │     │
│  │  chat            │  Show Chat tab                      │     │
│  │  bulkUpload      │  Show Bulk Upload button            │     │
│  └──────────────────┴─────────────────────────────────────┘     │
│                                                                  │
│  FINANCIAL CONFIG:                                               │
│  ┌──────────────────────┬─────────────────────────────────┐     │
│  │  commissionRate      │  10% (default)                  │     │
│  │  minWithdrawalAmount │  PKR 500                        │     │
│  │  withdrawalDays      │  2-3 business days              │     │
│  │  autoSettleDelay     │  24 hours after delivery        │     │
│  └──────────────────────┴─────────────────────────────────┘     │
│                                                                  │
│  IF module disabled → route shows ModuleDisabled component       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 18. Backend API Routes Reference

```
┌──────────┬────────────────────────────────────────┬──────────────────────────────┬───────────┐
│  Method  │  Route                                  │  Purpose                     │  Auth     │
├──────────┼────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  POST    │  /api/auth/register                      │  Register new vendor          │  NO       │
│  POST    │  /api/auth/login                         │  Login (all methods)          │  NO       │
│  POST    │  /api/auth/refresh                        │  Refresh access token        │  COOKIE   │
│  POST    │  /api/auth/validate-token                │  Validate on app launch      │  NO       │
│  POST    │  /api/auth/magic-link                    │  Request magic link          │  NO       │
│  GET     │  /auth/magic-link                        │  Verify magic link token     │  NO       │
├──────────┼────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  GET     │  /api/vendor/me                          │  Get own vendor profile      │  YES      │
│  PATCH   │  /api/vendor/cnic                        │  Submit CNIC (ID gate)       │  YES      │
│  GET     │  /api/store/me                           │  Get store settings          │  YES      │
│  PATCH   │  /api/store/me                           │  Update store settings       │  YES      │
│  PATCH   │  /api/store/status                       │  Open / Close store          │  YES      │
├──────────┼────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  POST    │  /api/verification/phone/send            │  Send phone OTP              │  YES      │
│  POST    │  /api/verification/phone/confirm         │  Confirm phone OTP           │  YES      │
│  POST    │  /api/verification/email/send            │  Send email OTP              │  YES      │
│  POST    │  /api/verification/email/confirm         │  Confirm email OTP           │  YES      │
│  POST    │  /api/verification/documents             │  Upload KYC documents        │  YES      │
│  GET     │  /api/verification/status                │  Get all verification flags  │  YES      │
│  GET     │  /api/verification/bonus-status          │  Get bonus claim status      │  YES      │
│  POST    │  /api/verification/claim-bonus           │  Claim verification bonus    │  YES      │
├──────────┼────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  GET     │  /api/orders                             │  List orders (tabbed/filter) │  YES      │
│  PATCH   │  /api/orders/:id                         │  Update order status         │  YES      │
│  POST    │  /api/orders/bulk-accept                 │  Bulk accept orders          │  YES      │
│  POST    │  /api/orders/bulk-reject                 │  Bulk reject orders          │  YES      │
│  POST    │  /api/orders/:id/assign-rider            │  Manually assign rider       │  YES      │
│  GET     │  /api/riders/available                   │  List nearby online riders   │  YES      │
├──────────┼────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  GET     │  /api/products                           │  List vendor products        │  YES      │
│  POST    │  /api/products                           │  Add product                 │  YES + 🔒 │
│  PATCH   │  /api/products/:id                       │  Edit product                │  YES + 🔒 │
│  DELETE  │  /api/products/:id                       │  Delete product              │  YES      │
│  POST    │  /api/products/bulk-upload               │  Bulk upload CSV             │  YES + 🔒 │
│  GET     │  /api/products/:id/stock-history         │  Product stock history       │  YES      │
├──────────┼────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  GET     │  /api/wallet                             │  Wallet balance + history    │  YES      │
│  POST    │  /api/withdraw                           │  Request withdrawal          │  YES + 🔒 │
│  POST    │  /api/wallet/deposit                     │  Submit deposit proof        │  YES      │
├──────────┼────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  GET     │  /api/analytics                          │  Sales analytics data        │  YES + 🔑 │
│  GET     │  /api/reviews                            │  Customer reviews list       │  YES      │
│  POST    │  /api/reviews/:id/reply                  │  Reply to review             │  YES      │
│  POST    │  /api/promos                             │  Create promo code           │  YES + 🔑 │
│  GET     │  /api/promos                             │  List promo codes            │  YES + 🔑 │
│  DELETE  │  /api/promos/:id                         │  Delete promo code           │  YES + 🔑 │
│  POST    │  /api/campaigns                          │  Create ad campaign          │  YES + 🔑 │
├──────────┼────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  GET     │  /api/chat/threads                       │  List chat threads           │  YES      │
│  POST    │  /api/chat/send                          │  Send message                │  YES      │
│  GET     │  /api/platform-config                    │  Platform feature flags      │  NO       │
│  GET     │  /api/public/zones                       │  Cities/areas for dropdowns  │  NO       │
└──────────┴────────────────────────────────────────┴──────────────────────────────┴───────────┘

🔒 = Feature gate middleware (documents_approved required)
🔑 = KYC gate (kycStatus = "verified" required)
```

---

## 19. Theme Style Guide

```
┌───────────────────────┬──────────────────────────┬────────────┐
│  Element              │  Value                    │  Status    │
├───────────────────────┼──────────────────────────┼────────────┤
│  Background           │  #0A0A0A  (dark black)    │  PRESERVED │
│  Primary Accent       │  #FFD700  (gold/yellow)   │  PRESERVED │
│  Secondary Accent     │  #FFC107  (amber)         │  PRESERVED │
│  Text Primary         │  #FFFFFF  (white)         │  PRESERVED │
│  Text Secondary       │  #A0A0A0  (grey)          │  PRESERVED │
│  Card Background      │  #1A1A1A                  │  PRESERVED │
│  Input Background     │  #2A2A2A                  │  PRESERVED │
│  Success              │  #4CAF50  (green)         │  PRESERVED │
│  Warning              │  #FF9800  (orange)        │  PRESERVED │
│  Error                │  #F44336  (red)           │  PRESERVED │
│  Font                 │  Inter / system-ui        │  PRESERVED │
│  Border Radius        │  12px cards / 8px inputs  │  PRESERVED │
│  Bottom Nav           │  5 tabs — icon + label    │  PRESERVED │
├───────────────────────┼──────────────────────────┼────────────┤
│  Existing Pages       │  DO NOT REDESIGN          │            │
│  Dashboard.tsx        │  Home / stats / feed      │  ✅        │
│  Orders.tsx           │  Order management tabs    │  ✅        │
│  Products.tsx         │  Inventory management     │  ✅        │
│  Wallet.tsx           │  Financials               │  ✅        │
│  Analytics.tsx        │  Sales analytics (gated)  │  ✅        │
│  Promos.tsx           │  Discount codes (gated)   │  ✅        │
│  Campaigns.tsx        │  Ad campaigns (gated)     │  ✅        │
│  Reviews.tsx          │  Customer reviews         │  ✅        │
│  Store.tsx            │  Store settings           │  ✅        │
│  Profile.tsx          │  Profile + KYC verify     │  ✅        │
│  Chat.tsx             │  Customer/rider chat      │  ✅        │
└───────────────────────┴──────────────────────────┴────────────┘
```

---

*End of AJKMART Vendor App – Complete Logic Flow Document*
