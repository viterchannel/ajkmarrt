# AJKMART Rider App – Complete Logic Flow (Visual)

> **Theme:** Dark mode with yellow/gold accents (PRESERVED — do NOT change)
> **Purpose:** Complete visual reference for every rider-app flow
> **Last Updated:** 2026-05-30

---

## Table of Contents

1. [App Launch & Auth Check](#1-app-launch--auth-check)
2. [Registration Wizard (Multi-Step)](#2-registration-wizard-multi-step)
3. [Login Flow](#3-login-flow)
4. [Dashboard / Home Feed](#4-dashboard--home-feed)
5. [Online / Offline Toggle](#5-online--offline-toggle)
6. [Accept Ride / Order Flow](#6-accept-ride--order-flow)
7. [Active Ride / Delivery Tracking](#7-active-ride--delivery-tracking)
8. [Profile & Verification (KYC)](#8-profile--verification-kyc)
9. [Wallet, Earnings & Withdrawal](#9-wallet-earnings--withdrawal)
10. [GPS Tracking & Offline Queue](#10-gps-tracking--offline-queue)
11. [Socket Events Reference](#11-socket-events-reference)
12. [Feature Gate System](#12-feature-gate-system)
13. [Progressive Gate Overlays](#13-progressive-gate-overlays)
14. [Platform Config Modules](#14-platform-config-modules)
15. [Backend API Routes Reference](#15-backend-api-routes-reference)
16. [Theme Style Guide](#16-theme-style-guide)

---

## 1. App Launch & Auth Check

```
┌─────────────────────────────────────────────────────────────────┐
│                    APP LAUNCH  (index.html)                      │
│                   Load React + Capacitor shell                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│        Check @capacitor/preferences for access_token             │
└─────────────────────────────────────────────────────────────────┘
                 │                             │
           TOKEN FOUND                   NO TOKEN
                 │                             │
                 ▼                             ▼
┌──────────────────────────┐     ┌──────────────────────────────┐
│  POST /api/auth/validate  │     │       GuestLanding.tsx        │
│       -token              │     │  • Onboarding / Splash        │
│  Verify with backend      │     │  • "Get Started" button       │
└──────────────────────────┘     │  • "Skip" option              │
          │           │          └──────────────────────────────┘
       VALID        INVALID                   │
          │           │               ┌───────┴────────┐
          │           ▼               │                │
          │    Clear stored token   SKIP           REGISTER
          │    → GuestLanding        │                │
          │                          ▼                ▼
          │                  Guest Dashboard    RegisterWizard.tsx
          │                  (browse only,      (multi-step form)
          │                   no rides)
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DASHBOARD (Home.tsx)                        │
│   • GET /api/riders/me  → fetch rider profile                    │
│   • Show verification badges if flags missing                    │
│   • Connect Socket.IO → listen for ride/order requests           │
│   • Show approval pending overlay if approvalStatus = pending    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Registration Wizard (Multi-Step)

```
┌─────────────────────────────────────────────────────────────────┐
│                    RegisterWizard.tsx                            │
│            Progress Bar: Step 1 → Step 2 → Step 3               │
└─────────────────────────────────────────────────────────────────┘
```

### Step 1 — Personal Details (`StepPersonal`)

```
┌──────────────────────────────────────────────────────────────────┐
│  FIELD               REQUIRED   VALIDATION                        │
├──────────────────────────────────────────────────────────────────┤
│  Full Name           YES        min 2 characters                  │
│  Phone Number        YES        03XXXXXXXXX format (Pakistan)     │
│  Email               NO         valid email format if provided    │
│  CNIC / ID Number    YES        XXXXX-XXXXXXX-X format            │
│  City                YES        text + dropdown (getPublicZones)  │
│  Area                YES        text + dropdown (linked to city)  │
│  Full Address        YES        free text                         │
└──────────────────────────────────────────────────────────────────┘
```

### Step 2 — Vehicle Information (`StepDocuments`)

```
┌──────────────────────────────────────────────────────────────────┐
│  FIELD                    REQUIRED   OPTIONS / FORMAT             │
├──────────────────────────────────────────────────────────────────┤
│  Vehicle Type             YES        Bike / Car / Rickshaw / Van  │
│  Plate Number             YES        e.g. RWP-1234                │
│  Driving License Number   YES        text                         │
└──────────────────────────────────────────────────────────────────┘
```

### Step 3 — Password & Terms

```
┌──────────────────────────────────────────────────────────────────┐
│  FIELD               REQUIRED   VALIDATION                        │
├──────────────────────────────────────────────────────────────────┤
│  Password            YES        8+ chars, 1 uppercase,            │
│                                 1 number, 1 symbol                │
│  Confirm Password    YES        must match Password               │
│  Terms & Conditions  YES        checkbox must be checked          │
└──────────────────────────────────────────────────────────────────┘
```

### On "Register" Button Click

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Auto-fetch browser geolocation (lat / lng)                   │
│       ├─ GRANTED  → attach lat/lng to payload                    │
│       └─ DENIED   → show manual city/area selector               │
│  2. POST /api/auth/register  { all fields + lat/lng }            │
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
│   city/area/address?  NO → 400  "Required fields missing"        │
│                                                                  │
│   ALL OK → INSERT users + rider_profile                          │
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
│   approvalStatus      = "pending_review"  ← Admin manually       │
│                         approves after document review.          │
│                         Riders cannot accept any rides until     │
│                         approvalStatus = "approved".             │
│   kycStatus           = "none"                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│   Backend returns:  access_token + refresh_token                 │
│   Frontend stores → auto-login → navigate to DASHBOARD           │
└─────────────────────────────────────────────────────────────────┘

❌ REMOVED from registration (old version):
   • Document upload (CNIC photos, vehicle photo, license photo)
   • Phone OTP verification at registration time
   • Email OTP verification at registration time
```

---

## 3. Login Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      LoginScreen.tsx                             │
│                                                                  │
│   Method 1:  Phone + Password                                    │
│   Method 2:  Email + Password                                    │
│   Method 3:  Magic Link (email)                                  │
│   Method 4:  Social → Google OAuth (Phase 1 only)                │
│              Facebook / Apple → future phases                    │
│   Method 5:  Forgot Password → /forgot-password                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               POST /api/auth/login                               │
│                                                                  │
│   Find user by phone or email                                    │
│   Verify bcrypt password hash                                    │
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
│   access_token   → @capacitor/preferences                        │
│   refresh_token  → HttpOnly cookie                               │
│   isAuthenticated = true                                         │
│   Navigate → DASHBOARD (/home)                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Token Refresh Flow (Auto — 401 Mutex)

```
┌─────────────────────────────────────────────────────────────────┐
│   API call returns 401 Unauthorized                             │
│   → apiFetch() catches 401                                      │
│   → acquire refresh mutex (one refresh at a time)               │
│   → POST /api/auth/refresh-token  (cookie)                       │
│       ├─ SUCCESS → store new access_token → retry original call  │
│       └─ FAIL    → clear tokens → redirect to /login            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Dashboard / Home Feed

```
┌─────────────────────────────────────────────────────────────────┐
│                        Home.tsx                                  │
├─────────────────────────────────────────────────────────────────┤
│  TOP — RIDER STATUS CARD                                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Name: Ali Hassan          AJK-ID: AJK-ABC123             │  │
│  │  Wallet Balance: PKR 2,400                                 │  │
│  │  Earnings Today: PKR 850                                   │  │
│  │  ● ONLINE / ○ OFFLINE  [toggle]                            │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  STATS MINI BAR                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Rides Today: 6  │  Acceptance Rate: 84%  │  Rating: 4.8  │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  GOAL PROGRESS BAR  (if earnings goal set)                       │
│  ▓▓▓▓▓▓▓▓░░░░  PKR 850 / PKR 1,500 daily goal  (57%)           │
├─────────────────────────────────────────────────────────────────┤
│  VERIFICATION BANNER  (if any flag is missing)                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ⚠  Verify phone to unlock ride requests    [Verify →]    │  │
│  │  ⚠  Account pending admin approval — rides locked         │  │
│  │  ⚠  Upload documents to start accepting rides [Upload →]  │  │
│  │  ⚠  Verify email to enable withdrawals       [Verify →]   │  │
│  │  ⚠  Top up wallet to start receiving rides   [Top Up →]   │  │
│  │  → Clicking each → Profile > Verification section         │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  LIVE REQUEST FEED  (RequestCard components — Socket.IO)         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  📦 DELIVERY ORDER  •  2.3 km away                         │  │
│  │  Pickup: Shop A, G-10 Islamabad                            │  │
│  │  Drop:   Customer, F-7 Islamabad                           │  │
│  │  Fare:   PKR 180     ETA: 12 min                           │  │
│  │                              [❌ Decline]  [✅ Accept]      │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🏍  RIDE REQUEST  •  1.1 km away                          │  │
│  │  Pickup: Blue Area                                         │  │
│  │  Drop:   Bahria Town Gate 1                                │  │
│  │  Fare:   PKR 250  (negotiable)    [Counter Offer]          │  │
│  │                              [❌ Decline]  [✅ Accept]      │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  BOTTOM NAVIGATION  (4 tabs)                                     │
│  ┌──────────┬──────────┬──────────┬──────────┐                  │
│  │   🏠      │   🏍      │   💰      │   👤      │                  │
│  │  Home    │  Active  │ Earnings │ Profile  │                  │
│  │ Dashboard│ Tracking │ Wallet   │ Settings │                  │
│  └──────────┴──────────┴──────────┴──────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Online / Offline Toggle

```
┌─────────────────────────────────────────────────────────────────┐
│  Rider taps ONLINE / OFFLINE toggle                              │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
       GOING ONLINE                          GOING OFFLINE
          │                                        │
          ▼                                        ▼
┌─────────────────────┐                 ┌─────────────────────┐
│  PATCH /api/riders   │                 │  PATCH /api/riders   │
│  /status             │                 │  /status             │
│  { online: true }    │                 │  { online: false }   │
│  emit rider:online   │                 │  Stop location pings │
└─────────────────────┘                 └─────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Start GPS location ping every 10 seconds                        │
│  emit rider:location_update { lat, lng }                         │
│  Begin receiving rider:new_request socket events                 │
│                                                                  │
│  Stationary Detection:                                           │
│  If rider has not moved >10m in 60 seconds, increase ping        │
│  interval to 30s to reduce battery/data usage.                   │
│  When movement resumes, revert to 10s interval.                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Accept Ride / Order Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Socket event received:  rider:new_request                       │
│  • Play notification sound                                       │
│  • Show RequestCard popup with 30-second countdown timer         │
└─────────────────────────────────────────────────────────────────┘
                              │
                   ┌──────────┴──────────┐
               ACCEPT                DECLINE / TIMEOUT
                   │                      │
                   ▼                      ▼
┌──────────────────────────┐   ┌──────────────────────────────┐
│  FEATURE GATE CHECK (3 gates — ALL must pass)  │   │  Request removed from feed    │
│  Feature: accept_ride                          │   │  No penalty (for now)         │
│                                                │   └──────────────────────────────┘
│  Gate 1: phoneVerified = true                  │
│  Gate 2: approvalStatus = "approved"           │
│          (admin manually approved)             │
│  Gate 3: walletBalance >= platform_min_balance │
│          (admin-configurable dynamic value)    │
└────────────────────────────────────────────────┘
          │             │
    GATE OPEN       GATE CLOSED
          │             │
          ▼             ▼
┌─────────────┐  ┌────────────────────────────────────────────┐
│ POST /api/   │  │  403 Response — reason shown as banner:    │
│ orders/accept│  │  • "Verify your phone to accept rides."    │
│ or /rides    │  │  • "Account pending admin approval."       │
│ /accept      │  │  • "Please top up your wallet with        │
└─────────────┘  │    minimum Rs. [X] to start receiving      │
                 │    rides."  [Top Up →]                      │
                 └────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│   ride:assigned socket event confirmed                           │
│   Order locked to this rider                                     │
│   Navigate → /active  (Active Ride tracking)                     │
└─────────────────────────────────────────────────────────────────┘
```

### Ride Negotiation (Ride Requests only)

```
┌─────────────────────────────────────────────────────────────────┐
│  Rider taps [Counter Offer]                                      │
│  Enter counter fare amount → POST /api/rides/counter             │
│  Customer sees counter → Accepts or Declines                     │
│       ├─ Customer ACCEPTS → ride:assigned → go to /active        │
│       └─ Customer DECLINES → back to feed                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Active Ride / Delivery Tracking

```
┌─────────────────────────────────────────────────────────────────┐
│                      ActiveRides.tsx                             │
│              GpsMiniMap (Leaflet) — Live Map                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               STATUS STEPPER (4 steps)                           │
│                                                                  │
│   [1] Accepted          [2] Arrived          [3] OTP / Pickup    │
│   Heading to pickup  ──▶ At location     ──▶ Verify customer  ──▶│
│                                                                  │
│   [4] Delivered / Completed                                      │
│   Ride/order finished → earnings credited                        │
└─────────────────────────────────────────────────────────────────┘

Step-by-Step API Calls:
┌────────────────────────────────────────────────────────────────┐
│  Step 1 → Heading to Pickup                                    │
│    PATCH /api/orders/:id/status  { status: "heading_pickup" }  │
│    Start continuous GPS ping                                    │
├────────────────────────────────────────────────────────────────┤
│  Step 2 → Arrived at Pickup                                    │
│    Tap [Arrived] button                                        │
│    PATCH /api/orders/:id/status  { status: "arrived" }         │
│    (Queued offline if no network — queueManager)               │
├────────────────────────────────────────────────────────────────┤
│  Step 3 → OTP Verification (Rides) / Pickup Confirm (Delivery) │
│                                                                │
│  RIDES:                                                        │
│    Customer shows 4-digit OTP to rider                        │
│    Rider enters OTP → POST /api/rides/:id/verify-otp          │
│    ride:otp_verified socket event fires                        │
│    Status → "in_progress"                                      │
│                                                                │
│  DELIVERIES:                                                   │
│    No OTP — Rider taps [Confirm Pickup] button                 │
│    POST /api/orders/:id/pickup-confirm                         │
│    Status → "in_progress"                                      │
├────────────────────────────────────────────────────────────────┤
│  Step 4 → Completed                                            │
│    PATCH /api/orders/:id/status  { status: "delivered" }       │
│    Earnings auto-credited to wallet                            │
│    Navigate → /home  (back to feed)                            │
└────────────────────────────────────────────────────────────────┘

Customer Contact Bar:
┌────────────────────────────────────────────────────────────────┐
│  [📞 Call Customer]   [💬 Chat Customer]   [🆘 SOS Button]     │
│                                                                │
│  SOS → triggers emergency alert to admin                       │
└────────────────────────────────────────────────────────────────┘
```

---

## 8. Profile & Verification (KYC)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Profile.tsx                               │
│   GET /api/verification/status  →  load all verification flags  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  VERIFICATION STATUS CARD                        │
│                                                                  │
│  ✅  CNIC / ID Card Number                                       │
│      Already provided at registration → Auto-verified            │
│                                                                  │
│  🟡  PHONE VERIFICATION                                          │
│      Status: NOT VERIFIED                                        │
│      [Send OTP] → POST /api/verification/phone/send              │
│      Enter 6-digit code                                          │
│      [Confirm] → POST /api/verification/phone/confirm            │
│      ├─ Success: phoneVerified = true                            │
│      └─ Bonus:   PKR 20 auto-credited to wallet                  │
│                                                                  │
│  🟡  EMAIL VERIFICATION  (only shown if email provided)          │
│      Status: NOT VERIFIED                                        │
│      [Send OTP] → POST /api/verification/email/send              │
│      Enter 6-digit code                                          │
│      [Confirm] → POST /api/verification/email/confirm            │
│      └─ Success: emailVerified = true                            │
│                                                                  │
│  🟡  DOCUMENT UPLOAD (KYC)                                       │
│      Status: NOT SUBMITTED                                       │
│      [Upload Documents]                                          │
│      Upload: CNIC front photo + CNIC back photo + License photo  │
│      POST /api/verification/documents  (multipart/form-data)     │
│      kycStatus = "pending" → admin reviews in Admin Panel        │
│      Admin APPROVES → documentsApproved = true                   │
│      Admin REJECTS  → kycStatus = "rejected" + reason shown      │
└─────────────────────────────────────────────────────────────────┘

Verification State Summary:
┌───────────────────────────┬─────────────┬──────────────────────┐
│  Flag                     │  Value      │  Unlocks             │
├───────────────────────────┼─────────────┼──────────────────────┤
│  phoneVerified            │  true/false │  Gate 1: accept ride │
│  approvalStatus="approved"│  true/false │  Gate 2: accept ride │
│  walletBalance>=min       │  dynamic    │  Gate 3: accept ride │
│  emailVerified            │  true/false │  Withdrawals         │
│  documentsApproved        │  true/false │  KYC / accept rides  │
│  kycStatus                │  none /     │  Shows KYC progress  │
│                           │  pending /  │                      │
│                           │  approved / │                      │
│                           │  rejected   │                      │
└───────────────────────────┴─────────────┴──────────────────────┘
```

---

## 9. Wallet, Earnings & Withdrawal

### Earnings Tab (`Earnings.tsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│                       EARNINGS TAB                               │
│                                                                  │
│   SUMMARY CARDS                                                  │
│   ┌───────────────┬──────────────────┬───────────────────┐      │
│   │  Today         │   This Week       │   This Month       │      │
│   │  PKR 850       │   PKR 4,200       │   PKR 18,600       │      │
│   └───────────────┴──────────────────┴───────────────────┘      │
│                                                                  │
│   GOAL PROGRESS                                                  │
│   Daily Target: PKR 1,500                                        │
│   ▓▓▓▓▓▓▓▓▓░░░  57%  —  PKR 650 remaining                       │
│                                                                  │
│   COMPLETED RIDES / ORDERS  (paginated list)                     │
│   • 12:30  Delivery  F-7 → G-9    PKR 180  ✅                   │
│   • 11:45  Ride      Blue Area → Bahria    PKR 310  ✅           │
│   • 10:20  Delivery  I-8 → H-11   PKR 145  ✅                   │
└─────────────────────────────────────────────────────────────────┘
```

### Wallet Tab (`Wallet.tsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│                        WALLET TAB                                │
│                                                                  │
│   Balance: PKR 2,400                                             │
│   GET /api/wallet  (cursor-paginated transactions)               │
│                                                                  │
│   ┌──────────────┬──────────────────┬─────────────────┐         │
│   │  [Withdraw]  │   [Deposit]       │  [COD Remit]    │         │
│   └──────────────┴──────────────────┴─────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
                    WITHDRAWAL TAPPED
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              FEATURE GATE CHECK: withdraw_money                  │
│              Requires: phone_verified + documents_approved       │
│                        + email_verified                          │
│                                                                  │
│  Email check: Registration pe email optional hai, lekin          │
│  withdrawal attempt par isEmailVerified check hoga.              │
└─────────────────────────────────────────────────────────────────┘
          │                              │
    GATE OPEN                      GATE CLOSED
          │                              │
          ▼                              ▼
┌─────────────────────┐    ┌──────────────────────────────────┐
│  WithdrawModal.tsx   │    │  403 Response:                   │
│                      │    │  "Verify phone and upload        │
│  Step 1: Email check │    │  documents to enable             │
│  isEmailVerified?    │    │  withdrawals"                    │
│  └─ false → Popup:   │    │  → Redirect to Profile >         │
│   "Please add and    │    │    Verification                  │
│   verify your email  │    └──────────────────────────────────┘
│   to securely process│
│   your earnings."    │
│   → OTP verify flow  │
│   → withdrawal unlock│
│                      │
│  Step 2: Enter amount│
│  Select method:      │
│  • Bank Transfer     │
│  • EasyPaisa         │
│  • JazzCash          │
│  POST /api/withdraw  │
│  { amount, method }  │
└─────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│   Biometric confirmation (FaceID / Fingerprint if enabled)       │
│   lib/biometric.ts → Capacitor Biometrics API                    │
│   Withdrawal request submitted → admin approves payout           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. GPS Tracking & Offline Queue

### Real-time GPS Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Rider is ONLINE                                                 │
│  gpsQueue.ts starts location collection                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴──────────┐
             NETWORK OK            NETWORK LOST
                    │                    │
                    ▼                    ▼
        ┌───────────────────┐   ┌──────────────────────────────┐
        │ emit               │   │  Buffer pings in-memory       │
        │ rider:location_    │   │  gpsQueue stores offline      │
        │ update {lat, lng}  │   │  PATCH /api/rider/location    │
        │ every 10 seconds   │   │  queued for batch sync        │
        └───────────────────┘   └──────────────────────────────┘
                                              │
                                    NETWORK RESTORED
                                              │
                                              ▼
                                  ┌─────────────────────────┐
                                  │  POST /api/rider/         │
                                  │  location/batch           │
                                  │  Send all buffered pings  │
                                  └─────────────────────────┘
```

### Offline Status Update Queue (`queueManager.ts`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Rider taps [Arrived] or [Delivered] with no network             │
│  Action queued in queueManager (@capacitor/preferences or        │
│  capacitor-sqlite)                                               │
│  NOTE: Raw IndexedDB is unreliable in native Capacitor apps —    │
│  iOS has different storage limits and clearing behavior.         │
│  UI shows optimistic update (status appears changed)             │
└─────────────────────────────────────────────────────────────────┘
                              │
                    NETWORK RESTORED
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  queueManager flushes all pending PATCH requests in order        │
│  Server confirms each status update                              │
│  Stale UI state corrected if server disagrees                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Socket Events Reference

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Socket.IO Events  (socket.tsx)                      │
├─────────────────┬───────────────┬───────────────────────┬───────────────────┤
│  Event Name     │  Direction    │  Payload               │  Action           │
├─────────────────┼───────────────┼───────────────────────┼───────────────────┤
│  connect        │  OUT (auth)   │  socket.auth =         │  Join rider room  │
│                 │               │  { token: JWT }        │  (use Socket.IO   │
│                 │               │  ← handshake only,     │  auth option, NOT │
│                 │               │    NOT event payload   │  event payload;   │
│                 │               │    (avoids JWT in logs)│  avoids log leak) │
│  rider:online   │  OUT          │  { riderId }           │  Sync avail state │
│  rider:location │  OUT          │  { lat, lng, ts }      │  Send GPS ping    │
│  _update        │               │                        │                   │
├─────────────────┼───────────────┼───────────────────────┼───────────────────┤
│  rider:new      │  IN           │  { orderId, type,      │  Play sound +     │
│  _request       │               │    pickup, drop, fare} │  Show RequestCard │
│  ride:assigned  │  IN           │  { rideId, orderId }   │  Lock ride to me  │
│  order:accepted │  IN           │  { orderId }           │  Remove from feed │
│                 │               │                        │  (another rider)  │
│  order:cancelled│  IN           │  { orderId }           │  Remove + toast   │
│  ride:otp       │  IN           │  { rideId }            │  Advance stepper  │
│  _verified      │               │                        │                   │
│  admin:chat     │  IN           │  { message, from }     │  Show in Chat tab │
├─────────────────┼───────────────┼───────────────────────┼───────────────────┤
│  disconnect     │  AUTO         │  —                     │  Auto-reconnect   │
│                 │               │                        │  on restore       │
└─────────────────┴───────────────┴───────────────────────┴───────────────────┘
```

---

## 12. Feature Gate System

### Database Table: `feature_rules`

```
┌──────────────┬─────────────────┬───────────────────────────────┬────────────────┐
│  role        │  feature_name   │  required_verifications        │  limit/day     │  wallet_balance_check         │
├──────────────┼─────────────────┼───────────────────────────────┼────────────────┼───────────────────────────────┤
│  rider       │  accept_ride    │  ["phone_verified",            │  unlimited     │  dynamic (admin-configured)   │
│              │                 │   "approval_status_approved"]  │                │  fetch live from DB each req  │
│  rider       │  withdraw_money │  ["phone_verified",            │  —             │  n/a                          │
│              │                 │   "documents_approved",        │                │                               │
│              │                 │   "email_verified"]            │                │                               │
│  customer    │  withdraw_money │  ["phone_verified",            │  —             │  n/a                          │
│              │                 │   "documents_approved"]        │                │                               │
│  vendor      │  add_product    │  ["documents_approved"]        │  —             │  n/a                          │
└──────────────┴─────────────────┴───────────────────────────────┴────────────────┴───────────────────────────────┘
```

### Dynamic Minimum Balance

```
┌─────────────────────────────────────────────────────────────────┐
│                  Dynamic Minimum Balance                         │
│                                                                  │
│  Admin dashboard → Settings panel → set platform_min_balance    │
│  Value stored in DB (platform_config table).                     │
│  System fetches live value on every accept_ride gate check.      │
│                                                                  │
│  UX — if wallet balance < platform_min_balance:                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  ⚠ Please top up your wallet with minimum Rs. [X] to start │ │
│  │    receiving rides.                         [Top Up →]      │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Admin can change the minimum at any time — change takes effect  │
│  immediately without app restart.                                │
└─────────────────────────────────────────────────────────────────┘
```

### Middleware Flow (`featureAccess` middleware)

```
┌─────────────────────────────────────────────────────────────────┐
│  API Request arrives                                             │
│  e.g. POST /api/orders/accept  or  POST /api/withdraw            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Lookup feature_rules WHERE role = req.user.role              │
│     AND feature_name = <action>                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Check each required verification flag on user:               │
│     • phoneVerified       ?                                      │
│     • emailVerified       ?                                      │
│     • documentsApproved   ?                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
             ┌────────────────┴────────────────┐
         ALL TRUE                         ANY FALSE
             │                                 │
             ▼                                 ▼
┌──────────────────────┐          ┌────────────────────────────┐
│  next() — request     │          │  403 Forbidden             │
│  proceeds normally    │          │  { blocked: true,          │
└──────────────────────┘          │    message: "...",          │
                                  │    missing: ["phone_ver.."] │
                                  │  }                          │
                                  └────────────────────────────┘
```

---

## 13. Progressive Gate Overlays

These overlays intercept the UI before the rider can use the app:

```
┌─────────────────────────────────────────────────────────────────┐
│  App loads → runs gate checks in this order:                    │
│                                                                  │
│  GATE 1: Approval Gate                                           │
│  ─────────────────────────────────────────────────────────────  │
│  IF approvalStatus === "pending"                                 │
│  → Show ApprovalPendingOverlay                                   │
│  → "Your account is under review. We'll notify you shortly."    │
│  → All routes blocked until approved                             │
│                                                                  │
│  GATE 2: ID Card Gate                                            │
│  ─────────────────────────────────────────────────────────────  │
│  IF cnic is missing / not set                                    │
│  → Show IdCardGateModal (forced, cannot dismiss)                 │
│  → Rider must enter CNIC to continue                             │
│                                                                  │
│  GATE 3: Verification Gate (on 403 response)                     │
│  ─────────────────────────────────────────────────────────────  │
│  IF any API returns 403 with { blocked: true }                   │
│  → Show VerificationGateModal                                    │
│  → Lists missing verifications with action buttons              │
│  → Rider goes to Profile → completes required verification       │
│  → Gate clears when flag becomes true                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 14. Platform Config Modules

Fetched from `GET /api/platform-config` on app boot. Controls which features/routes are enabled per platform deployment.

```
┌─────────────────────────────────────────────────────────────────┐
│                    PlatformConfig  (useConfig.ts)                │
│                                                                  │
│  MODULES  (can be disabled per deployment):                      │
│  ┌──────────────┬───────────────────────────────────────────┐   │
│  │  wallet      │  Show Wallet tab                          │   │
│  │  earnings    │  Show Earnings tab                        │   │
│  │  history     │  Show History tab                         │   │
│  │  gpsTracking │  Enable live GPS features                 │   │
│  │  supportChat │  Enable Chat tab                          │   │
│  └──────────────┴───────────────────────────────────────────┘   │
│                                                                  │
│  FEATURES  (service-type toggles):                               │
│  ┌──────────────┬───────────────────────────────────────────┐   │
│  │  mart        │  Delivery orders (AJK Mart)               │   │
│  │  food        │  Food delivery orders                     │   │
│  │  rides       │  Ride-hailing (bike/car)                  │   │
│  │  van         │  Van/pool service (VanDriver.tsx)         │   │
│  │  sos         │  SOS emergency button                     │   │
│  │  reviews     │  Customer rating after ride               │   │
│  └──────────────┴───────────────────────────────────────────┘   │
│                                                                  │
│  IF module disabled → route shows ModuleDisabled component       │
│  IF feature disabled → RequestCard hides that order type         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 15. Backend API Routes Reference

```
┌──────────┬────────────────────────────────────┬──────────────────────────────┬───────────┐
│  Method  │  Route                              │  Purpose                     │  Auth     │
├──────────┼────────────────────────────────────┼──────────────────────────────┼───────────┤
│  POST    │  /api/auth/register                  │  Register new rider          │  NO       │
│  POST    │  /api/auth/login                     │  Login (phone/email/pass)    │  NO       │
│  POST    │  /api/auth/refresh-token             │  Refresh access token        │  COOKIE   │
│  POST    │  /api/auth/validate-token            │  Validate on app launch      │  NO       │
│  POST    │  /api/auth/magic-link                │  Request magic link          │  NO       │
│  GET     │  /api/auth/magic-link                │  Verify magic link token     │  NO       │
│  GET     │  /api/auth/google                    │  Initiate Google OAuth       │  NO       │
│  GET     │  /api/auth/google/callback           │  Google OAuth callback       │  NO       │
├──────────┼────────────────────────────────────┼──────────────────────────────┼───────────┤
│  GET     │  /api/riders/me                      │  Get own profile + flags     │  YES      │
│  PATCH   │  /api/riders/status                  │  Set online/offline          │  YES      │
│  PATCH   │  /api/rider/location                 │  Real-time GPS update        │  YES      │
│  POST    │  /api/rider/location/batch           │  Batch offline GPS sync      │  YES      │
├──────────┼────────────────────────────────────┼──────────────────────────────┼───────────┤
│  POST    │  /api/verification/phone/send        │  Send phone OTP              │  YES      │
│  POST    │  /api/verification/phone/confirm     │  Confirm phone OTP           │  YES      │
│  POST    │  /api/verification/email/send        │  Send email OTP              │  YES      │
│  POST    │  /api/verification/email/confirm     │  Confirm email OTP           │  YES      │
│  POST    │  /api/verification/documents         │  Upload KYC docs             │  YES      │
│  GET     │  /api/verification/status            │  Get verification status     │  YES      │
├──────────┼────────────────────────────────────┼──────────────────────────────┼───────────┤
│  GET     │  /api/orders/requests               │  Get live ride/order feed    │  YES      │
│  POST    │  /api/orders/accept                  │  Accept delivery order       │  YES + 🔒 │
│  POST    │  /api/rides/accept                   │  Accept ride request         │  YES + 🔒 │
│  POST    │  /api/rides/counter                  │  Counter-offer fare          │  YES      │
│  POST    │  /api/rides/:id/verify-otp           │  Verify customer OTP (rides) │  YES      │
│  POST    │  /api/orders/:id/pickup-confirm      │  Delivery pickup confirm      │  YES      │
│  POST    │  /api/sos                            │  SOS emergency alert to admin│  YES      │
│  PATCH   │  /api/orders/:id/status              │  Update order status         │  YES      │
├──────────┼────────────────────────────────────┼──────────────────────────────┼───────────┤
│  GET     │  /api/wallet                         │  Wallet + transactions       │  YES      │
│  POST    │  /api/withdraw                       │  Request withdrawal          │  YES + 🔒 │
│  POST    │  /api/wallet/deposit                 │  Submit deposit              │  YES      │
│  POST    │  /api/wallet/cod-remittance          │  Submit COD cash handover    │  YES      │
├──────────┼────────────────────────────────────┼──────────────────────────────┼───────────┤
│  GET     │  /api/earnings                       │  Daily/weekly/monthly        │  YES      │
│  GET     │  /api/history                        │  Completed rides (paginated) │  YES      │
│  GET     │  /api/platform-config               │  Module/feature flags        │  NO       │
│  GET     │  /api/public/zones                   │  Cities/areas for dropdowns  │  NO       │
└──────────┴────────────────────────────────────┴──────────────────────────────┴───────────┘

🔒 = Feature gate middleware applied
```

---

## 16. Theme Style Guide

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
│  Bottom Nav           │  4 tabs — icon + label    │  PRESERVED │
├───────────────────────┼──────────────────────────┼────────────┤
│  Existing Pages       │  DO NOT REDESIGN          │            │
│  GuestLanding.tsx     │  Onboarding/splash        │  ✅        │
│  GuestDashboard.tsx   │  Guest browse mode        │  ✅        │
│  RegisterWizard.tsx   │  Multi-step registration  │  ✅        │
│  LoginScreen.tsx      │  Login                    │  ✅        │
│  Home.tsx             │  Dashboard / feed         │  ✅        │
│  Profile.tsx          │  Profile + verify card    │  ✅        │
│  ActiveRides.tsx      │  Live order tracking      │  ✅        │
│  Earnings.tsx         │  Earnings + history       │  ✅        │
│  Wallet.tsx           │  Wallet + transactions    │  ✅        │
│  Chat.tsx             │  Support chat             │  ✅        │
└───────────────────────┴──────────────────────────┴────────────┘
```

---

*End of AJKMART Rider App – Complete Logic Flow Document*
