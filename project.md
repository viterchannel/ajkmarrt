# AJKMart Super-App — Complete Project Definition

> **Version:** 1.0.0 | **Date:** May 28, 2026 | **Status:** Active Development
> **Region:** Azad Jammu & Kashmir (AJK), Pakistan

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Business Goals & Vision](#2-business-goals--vision)
3. [Target Audience](#3-target-audience)
4. [Services & Features](#4-services--features)
5. [System Architecture](#5-system-architecture)
6. [Monorepo Structure](#6-monorepo-structure)
7. [Technology Stack](#7-technology-stack)
8. [Applications (Artifacts)](#8-applications-artifacts)
9. [Shared Libraries (lib/)](#9-shared-libraries-lib)
10. [Database Schema](#10-database-schema)
11. [Authentication System](#11-authentication-system)
12. [API Design](#12-api-design)
13. [Real-Time Features](#13-real-time-features)
14. [Payment & Wallet System](#14-payment--wallet-system)
15. [Maps & Location Services](#15-maps--location-services)
16. [Internationalization (i18n)](#16-internationalization-i18n)
17. [Admin Panel Capabilities](#17-admin-panel-capabilities)
18. [Security Architecture](#18-security-architecture)
19. [Environment Variables](#19-environment-variables)
20. [Dev Workflows & Ports](#20-dev-workflows--ports)
21. [Design System & Tokens](#21-design-system--tokens)
22. [Testing Strategy](#22-testing-strategy)
23. [Deployment Architecture](#23-deployment-architecture)
24. [Development Conventions](#24-development-conventions)
25. [Roadmap & Phase Plan](#25-roadmap--phase-plan)

---

## 1. Project Overview

**AJKMart** is a full-stack, multi-service **super-app** built exclusively for the Azad Jammu & Kashmir (AJK) region of Pakistan. It consolidates multiple urban services into a single unified platform — similar to Careem, Daraz, and Foodpanda — but designed ground-up for the AJK market, culture, and language.

The platform operates as a **pnpm monorepo** containing five deployable applications and eight shared libraries, all written in TypeScript.

### Core Services
| Service | Description |
|---|---|
| **AJKMart (Mart)** | Grocery & general e-commerce marketplace |
| **Food Delivery** | Restaurant ordering and doorstep delivery |
| **Ride-Hailing** | Taxi and bike rides within the city |
| **Pharmacy** | Medicine & healthcare product ordering |
| **Parcel Delivery** | Local parcel pickup and drop |
| **Inter-city Transport** | Van/bus booking for inter-city routes |

---

## 2. Business Goals & Vision

- **Primary Goal:** Become the #1 digital super-app for the 4.5 million people of AJK.
- **Mission:** Digitize daily life services — shopping, commute, food, medicine — in a region historically underserved by tech platforms.
- **Revenue Model:** Commission per order/ride, subscription plans for vendors, delivery charges, promoted listings, digital wallet float.
- **USP:** Urdu-first design, local payment methods, AJK-specific geography, and offline-resilient UX.

---

## 3. Target Audience

| User Type | Description |
|---|---|
| **Customers** | General public using the mobile app (Expo React Native) |
| **Riders** | Delivery agents and taxi drivers using the Rider PWA |
| **Vendors** | Shops, restaurants, and pharmacies using the Vendor Web App |
| **Admins** | Operations team using the Admin Dashboard |

---

## 4. Services & Features

### 4.1 Mart / E-Commerce
- Product catalog with hierarchical categories (Mart type)
- Product variants (size, color, weight)
- Cart management and wishlist
- Flash deals and banner promotions
- Vendor storefronts with ratings and reviews
- Order tracking with real-time status updates
- Address management (multiple delivery addresses)

### 4.2 Food Delivery
- Restaurant listings with menus
- Food category browsing
- Real-time order tracking via Socket.IO
- Estimated delivery time
- Rating and review system

### 4.3 Ride-Hailing
- Taxi and bike booking
- Real-time fare estimation
- Live rider location tracking on map
- OTP-verified ride start (trip_otp)
- Ride history and receipts
- SOS / safety feature during active rides

### 4.4 Pharmacy
- Medicine catalog with categories
- Prescription upload support
- Pharmacy vendor management
- Delivery to doorstep

### 4.5 Parcel Delivery
- Parcel pickup scheduling
- Weight-based pricing
- Real-time delivery tracking

### 4.6 Inter-City Transport (Van)
- Route listing and seat booking
- Schedule management by admin
- Van vendor management

### 4.7 Digital Wallet
- Wallet top-up via external payment gateways
- Peer-to-peer (P2P) transfers
- Pay for all services from wallet
- Transaction history with full audit trail
- SELECT FOR UPDATE concurrency-safe balance operations

### 4.8 Loyalty & Referrals
- Points-based loyalty program
- Referral codes and bonus credit
- Streak rewards and milestones

### 4.9 Support & Communication
- In-app support chat (Socket.IO)
- Push notifications (FCM)
- WhatsApp delivery notifications
- SMS OTP via multiple gateways

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Customer App │  │  Rider App   │  │     Vendor App       │  │
│  │ (Expo RN)    │  │ (React/Vite) │  │    (React/Vite)      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│  ┌──────┴─────────────────┴──────────────────────┴───────────┐  │
│  │                    Admin Panel (React/Vite)                │  │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │  REST + WebSocket
┌─────────────────────────────▼───────────────────────────────────┐
│                       API SERVER (Port 8080)                     │
│           Express 5 · Drizzle ORM · Socket.IO · Pino            │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐  ┌──────────────┐  ┌──────────┐
        │PostgreSQL│  │ File Storage │  │ SMS / GW │
        │(Primary  │  │ (Uploads/KYC)│  │ Gateways │
        │  DB)     │  └──────────────┘  └──────────┘
        └──────────┘
```

### Key Architectural Decisions
- **Single API Server** serves all clients (customer, rider, vendor, admin)
- **Role-Based Access Control (RBAC)** enforced via `requireRole()` middleware
- **Real-time** via Socket.IO rooms per ride/order/chat
- **Monorepo** with pnpm workspaces for code sharing
- **Drizzle ORM** with full TypeScript type safety on all queries
- **Swagger / OpenAPI** auto-generated from Zod schemas (`/api-docs`)

---

## 6. Monorepo Structure

```
/
├── artifacts/                    # Deployable applications
│   ├── api-server/               # Express 5 REST + Socket.IO API (Port 8080)
│   │   └── src/
│   │       ├── routes/           # 50+ route modules
│   │       │   ├── auth/         # Multi-method auth (OTP, password, OAuth, 2FA)
│   │       │   ├── admin/        # Admin sub-routers (20+ modules)
│   │       │   ├── rides/        # Ride-hailing logic
│   │       │   ├── rider/        # Rider profile, KYC, status
│   │       │   ├── vendor/       # Vendor profile, orders, store
│   │       │   ├── orders.ts     # Mart/food/pharmacy orders
│   │       │   ├── wallet.ts     # Wallet transactions
│   │       │   ├── products.ts   # Product catalog
│   │       │   ├── categories.ts # Hierarchical categories
│   │       │   ├── home-feed.ts  # Banners + flash deals + trending
│   │       │   ├── payments.ts   # Payment gateway integration
│   │       │   ├── notifications.ts # Push + SMS + WhatsApp
│   │       │   ├── loyalty.ts    # Loyalty points system
│   │       │   ├── referrals.ts  # Referral program
│   │       │   ├── reviews.ts    # Ratings & reviews
│   │       │   ├── support-chat.ts # In-app support
│   │       │   └── ...           # 30+ more modules
│   │       ├── middleware/
│   │       │   └── security.ts   # requireRole() RBAC factory
│   │       ├── services/
│   │       │   └── password.ts   # bcrypt + JWT signing
│   │       └── lib/
│   │           └── socketio.ts   # Socket.IO rooms + ghost-rider cleanup
│   │
│   ├── admin/                    # Admin Dashboard (React + Vite, Port 3000)
│   │   └── src/
│   │       ├── pages/            # 20+ admin pages
│   │       │   ├── live-riders-map.tsx  # Real-time fleet tracking
│   │       │   ├── analytics.ts         # Revenue & usage analytics
│   │       │   ├── kyc-queue.ts         # KYC review queue
│   │       │   └── ...
│   │       ├── components/
│   │       └── lib/
│   │
│   ├── rider-app/                # Rider PWA (React + Vite, Dark Theme, Port 3002)
│   │   └── src/
│   │       ├── pages/            # Rider dashboard, active ride, history
│   │       ├── lib/auth/
│   │       │   ├── LoginScreen.tsx    # 7 auth methods
│   │       │   └── RegisterWizard.tsx # Multi-step registration
│   │       └── App.tsx
│   │
│   ├── vendor-app/               # Vendor Web App (React + Vite, Port 3001)
│   │   └── src/
│   │       ├── pages/            # Store management, orders, products
│   │       ├── lib/auth/
│   │       │   ├── LoginScreen.tsx
│   │       │   └── RegisterWizard.tsx
│   │       └── App.tsx
│   │
│   └── ajkmart/                  # Customer Mobile App (Expo React Native)
│       └── [DO NOT EDIT — managed separately]
│
├── lib/                          # Shared packages
│   ├── db/                       # Drizzle schema + PostgreSQL migrations
│   ├── api-spec/                 # OpenAPI / Zod schema definitions
│   ├── api-zod/                  # Zod request/response validators
│   ├── api-client-react/         # React Query hooks + typed API client
│   ├── auth-react/               # Drop-in auth SDK (hooks + components)
│   ├── auth-utils/               # Token utilities (shared between FE/BE)
│   ├── i18n/                     # Translations: EN / UR / Roman Urdu
│   ├── phone-utils/              # Phone number formatting for AJK
│   ├── logger/                   # Pino-based structured logger
│   ├── ui/                       # Shared UI component primitives
│   ├── integrations-gemini-ai/   # Google Gemini AI integration
│   └── service-constants/        # Shared enums and constants
│
├── e2e/                          # Playwright end-to-end tests
├── scripts/                      # Build and utility scripts
├── docs/                         # Project documentation
├── .local/                       # Agent skills and session data
├── package.json                  # Root workspace config
├── pnpm-workspace.yaml           # pnpm workspace definition
├── tsconfig.base.json            # Shared TypeScript config
└── playwright.config.ts          # E2E test configuration
```

---

## 7. Technology Stack

### Backend
| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | v20+ |
| Framework | Express | v5.x |
| ORM | Drizzle ORM | Latest |
| Database | PostgreSQL | v16 |
| Real-time | Socket.IO | v4 |
| Logging | Pino | Latest |
| API Docs | Swagger UI / OpenAPI | Auto-generated |
| Validation | Zod | v3 |

### Web Frontends (Admin / Rider / Vendor)
| Layer | Technology |
|---|---|
| Framework | React 18/19 |
| Build Tool | Vite |
| Styling | TailwindCSS |
| State / Data | React Query (TanStack Query) |
| Routing | Wouter |
| Maps | Leaflet (OSM / Mapbox / Google — runtime config) |
| Auth SDK | `@workspace/auth-react` |

### Mobile (Customer App)
| Layer | Technology |
|---|---|
| Framework | Expo (React Native) |
| Styling | NativeWind (Tailwind for RN) |
| Navigation | expo-router |
| Auth | `@workspace/auth-react` (adapted) |

### Dev Tooling
| Tool | Purpose |
|---|---|
| pnpm workspaces | Package management & monorepo |
| TypeScript ~5.9 | Full-stack type safety |
| ESLint + Prettier | Linting and formatting |
| Husky + lint-staged | Pre-commit hooks |
| Playwright | End-to-end testing |
| Concurrently | Parallel script execution |

---

## 8. Applications (Artifacts)

### 8.1 API Server (`artifacts/api-server`)
- **Port:** 8080
- **Framework:** Express 5 with TypeScript
- **Entry:** `src/index.ts`
- **Key Modules:**
  - 50+ route files organized by domain
  - Unified auth system (`/api/auth/*`)
  - Admin API (`/api/admin/*`) with 20+ sub-routers
  - Ride-hailing engine with real-time Socket.IO
  - Wallet with concurrency-safe transactions
  - KYC document verification queue
  - SMS gateway abstraction layer
  - Gemini AI integration for recommendations
  - Swagger UI at `/api-docs`

### 8.2 Admin Panel (`artifacts/admin`)
- **Port:** 3000 | **Base Path:** `/admin`
- **Primary Color:** `#1A56DB` (blue) | **Accent:** `#F59E0B` (amber)
- **Key Pages:**
  - Live Rider Map (real-time fleet tracking)
  - KYC Queue (document review & approve/reject)
  - Order Management (all service types)
  - Finance Dashboard (revenue, payouts, wallet)
  - Platform Settings (auth methods, feature flags)
  - User Management (all roles)
  - Analytics & Reports
  - Content Management (banners, popups, notifications)
  - SMS Gateway Configuration
  - Loyalty Program Management
  - Experiment / A-B Testing Controls

### 8.3 Rider App (`artifacts/rider-app`)
- **Port:** 3002 | **Base Path:** `/rider`
- **Theme:** Dark (`#0b0e11` background, `#F0B90B` gold primary)
- **Features:**
  - Multi-method login (7 auth methods)
  - Multi-step onboarding wizard (vehicle, documents, license)
  - Active ride management with map
  - OTP verification for trip start
  - Earnings dashboard
  - KYC document upload
  - Push notifications

### 8.4 Vendor App (`artifacts/vendor-app`)
- **Port:** 3001 | **Base Path:** `/vendor`
- **Primary Color:** `#1A56DB` (blue) | **Accent:** `#F59E0B` (amber)
- **Features:**
  - Multi-step store registration
  - Product & inventory management
  - Order acceptance and fulfillment
  - Store analytics and earnings
  - Menu management (for restaurants)
  - KYC and business verification

### 8.5 Customer App (`artifacts/ajkmart`)
- **Platform:** Expo React Native (iOS + Android)
- **Status:** DO NOT EDIT — managed by a separate team
- **Features:** Full super-app experience on mobile

---

## 9. Shared Libraries (lib/)

| Package | Description |
|---|---|
| `@workspace/db` | Drizzle ORM schema definitions, migrations, and DB client |
| `@workspace/api-spec` | OpenAPI / Zod type definitions for all API endpoints |
| `@workspace/api-zod` | Request/response Zod validators shared across FE and BE |
| `@workspace/api-client-react` | React Query hooks + typed Axios/fetch API client |
| `@workspace/auth-react` | Drop-in auth SDK: `useAuth`, `LoginScreen`, `OtpInput`, token storage |
| `@workspace/auth-utils` | Token parsing, JWT helpers, cookie utilities |
| `@workspace/i18n` | Translation strings: English, Urdu (Nastaliq), Roman Urdu |
| `@workspace/phone-utils` | AJK phone number formatting and validation |
| `@workspace/logger` | Pino-based structured logging with log levels |
| `@workspace/ui` | Shared TailwindCSS component primitives |
| `@workspace/integrations-gemini-ai` | Google Gemini AI client wrapper |
| `@workspace/service-constants` | Enums: service types, order statuses, ride states |

---

## 10. Database Schema

### Core Tables

```sql
-- Users (all roles in one table, role enum)
users
  id, phone, email, cnic, password_hash, role
  (customer | rider | vendor | admin)
  full_name, avatar_url, is_verified, is_active
  created_at, updated_at

-- Rider-specific profile
rider_profiles
  id, user_id (FK → users), vehicle_type, vehicle_number
  license_number, license_expiry, cnic_front_url, cnic_back_url
  license_front_url, is_kyc_verified, kyc_status
  current_lat, current_lng, is_online, created_at

-- Vendor-specific profile
vendor_profiles
  id, user_id (FK → users), store_name, store_type
  store_address, business_reg_number, store_logo_url
  is_kyc_verified, is_active, commission_rate, created_at

-- Rides
rides
  id, customer_id, rider_id, pickup_lat, pickup_lng
  dropoff_lat, dropoff_lng, fare, status, trip_otp
  otp_verified, is_parcel, parcel_details (JSONB)
  started_at, completed_at, cancelled_at, created_at

-- Orders (Mart / Food / Pharmacy)
orders
  id, customer_id, vendor_id, rider_id, service_type
  (mart | food | pharmacy), items (JSONB), subtotal
  delivery_fee, total, status, delivery_address_id, created_at

-- Digital Wallet
wallets
  id, user_id (FK → users), balance (NUMERIC), currency
  created_at, updated_at

wallet_transactions
  id, wallet_id, type (credit | debit), amount
  reference_type, reference_id, note, created_at

-- Products
products
  id, vendor_id, category_id, name, description
  price, compare_price, stock, sku, images (JSONB)
  is_active, is_featured, created_at

-- Categories (hierarchical self-reference)
categories
  id, parent_id (FK → categories), name, slug, type
  (mart | food | pharmacy), image_url, sort_order

-- Auth / Session Tables
refresh_tokens
  id, user_id, token_hash, device_fingerprint
  ip_address, family_id, revoked_at, expires_at

magic_link_tokens
  id, user_id, token_hash (SHA-256), expires_at, used_at

otp_codes
  id, phone/email, code_hash, purpose, attempts
  expires_at, used_at

-- Loyalty
loyalty_points
  id, user_id, points_balance, lifetime_earned, created_at

loyalty_transactions
  id, user_id, points, type (earn | redeem | expire)
  reference, created_at

-- Referrals
referral_codes
  id, user_id, code (unique), total_uses, created_at

referral_uses
  id, referrer_id, referred_id, bonus_given, created_at
```

---

## 11. Authentication System

### Supported Methods (Admin-Configurable per Role)

| Method | Description |
|---|---|
| **Phone OTP** | 6-digit SMS/WhatsApp/email fallback |
| **Email OTP** | 6-digit code to email |
| **Password** | Email/phone + password |
| **Magic Link** | One-click login via email |
| **Google OAuth** | Google Sign-In |
| **Facebook OAuth** | Facebook SDK |
| **TOTP 2FA** | Authenticator app as second factor |

### Token Architecture
- **Access Token:** JWT, expires in **15 minutes**
- **Refresh Token:** Rotates on every use, expires in **7 days**
- **Token Family Breach Detection:** Replay of a revoked refresh token revokes entire family (all sessions)
- **Device Fingerprinting:** Stored with each refresh token
- **Magic Link:** Raw token → SHA-256 hash stored in DB

### Security Rules
- `JWT_SECRET` is mandatory — app throws at startup if missing (no hardcoded fallback)
- Dev OTP (`000000`) only works when **both** `NODE_ENV=development` AND `ALLOW_DEV_OTP=true`
- Magic link URL format: `{APP_BASE_URL}/auth/magic-link?token=<raw_token>`

### Auth SDK (`@workspace/auth-react`)
```
hooks/
  useAuth()          — Current user, login state, logout
  useLoginFlow()     — Multi-step login state machine
  useTokenRefresh()  — Automatic silent token refresh

components/
  LoginScreen        — All 7 login methods in one component
  OtpInput           — 6-digit OTP input with auto-focus
  PhoneInput         — Phone number input with country selector
  PasswordInput      — Password field with show/hide toggle
  SocialButtons      — Google + Facebook OAuth buttons
  BiometricPrompt    — Native biometric prompt (mobile)
```

---

## 12. API Design

### Base URL
```
Development:  http://localhost:8080/api
Production:   https://<domain>/api
Swagger UI:   /api-docs
```

### Route Namespaces

| Prefix | Description |
|---|---|
| `POST /api/auth/*` | Authentication (all methods) |
| `GET/POST /api/home-feed` | Banners + flash deals + trending |
| `GET/POST /api/products/*` | Product catalog |
| `GET/POST /api/categories/*` | Category tree |
| `GET/POST /api/orders/*` | Order lifecycle |
| `GET/POST /api/rides/*` | Ride booking and management |
| `GET/POST /api/wallet/*` | Wallet operations |
| `GET/POST /api/rider/*` | Rider profile and status |
| `GET/POST /api/vendor/*` | Vendor profile and store |
| `GET/POST /api/cart/*` | Shopping cart |
| `GET/POST /api/wishlist/*` | Wishlist |
| `GET/POST /api/reviews/*` | Ratings and reviews |
| `GET/POST /api/loyalty/*` | Loyalty points |
| `GET/POST /api/referrals/*` | Referral program |
| `GET/POST /api/notifications/*` | Push notifications |
| `GET/POST /api/payments/*` | Payment gateway |
| `GET/POST /api/admin/*` | Admin-only operations |
| `GET /api/health` | Health check |

### RBAC Middleware
```typescript
// Usage in routes:
router.get('/profile', requireRole('rider'), handler)
router.post('/products', requireRole('vendor'), handler)
router.delete('/users/:id', requireRole('admin'), handler)

// Multiple roles:
router.get('/orders', requireRole(['vendor', 'admin']), handler)
```

---

## 13. Real-Time Features

### Socket.IO Architecture
```
Rooms:
  ride:{rideId}       — Customer + Rider for live ride updates
  support:{ticketId}  — Customer + Agent for live chat
  admin:fleet         — Admin fleet map (all rider locations)
  vendor:{vendorId}   — Vendor new order alerts

Events:
  rider:location      — Rider GPS update (broadcast to room)
  ride:status         — Ride state change
  order:status        — Order state change
  chat:message        — Support chat message
  rider:online        — Rider comes online
  rider:offline       — Rider goes offline
```

### Ghost Rider Cleanup
- Riders who disconnect without going offline are marked offline after a configurable timeout
- Prevents "ghost riders" showing as available on the fleet map

---

## 14. Payment & Wallet System

### Wallet Operations
- **Deposit:** Via payment gateways (JazzCash, EasyPaisa, bank transfer)
- **P2P Transfer:** `SELECT FOR UPDATE` prevents double-spend race conditions
- **Withdraw:** Request-based, admin-approved
- **Pay:** Deducted automatically on order/ride completion

### Transaction Integrity
```sql
BEGIN;
SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE;
-- Check sufficient balance
UPDATE wallets SET balance = balance - ? WHERE user_id = ?;
INSERT INTO wallet_transactions (...) VALUES (...);
COMMIT;
```

### Payment Gateways
- JazzCash (Pakistan mobile wallet)
- EasyPaisa (Pakistan mobile wallet)
- Bank transfer (manual)
- Admin-configurable gateway settings

---

## 15. Maps & Location Services

### Provider Strategy
- Map provider (OSM / Mapbox / Google Maps) is loaded from **database config** at runtime
- No hardcoded provider — admin can switch without redeployment
- **Frontend:** Leaflet.js for all web apps
- **Mobile:** Native map component in Expo

### Location Features
- Rider real-time GPS broadcast (Socket.IO)
- Fleet map in admin panel with history playback
- Geocoding for address input
- Delivery zone eligibility checking
- ETA calculation

---

## 16. Internationalization (i18n)

### Supported Languages

| Code | Language | Script | Direction |
|---|---|---|---|
| `en` | English | Latin | LTR |
| `ur` | Urdu | Nastaliq (Noto Nastaliq Urdu) | RTL |
| `ur-roman` | Roman Urdu | Latin | LTR |

### Dual-Display Mode
- Admin can enable showing both Urdu and English simultaneously
- Useful for bilingual operations staff

### Font Stack
- **Latin / Roman Urdu:** Inter (400–700)
- **Urdu (Nastaliq):** Noto Nastaliq Urdu

---

## 17. Admin Panel Capabilities

### Operations
- User management (all roles: customer, rider, vendor, admin)
- KYC queue — review, approve, reject documents
- Order management across all service types
- Ride management and dispute resolution
- Support chat monitoring

### Finance
- Revenue analytics by service type, date range, vendor
- Wallet balance overview and freeze accounts
- Payout management for riders and vendors
- Commission configuration per vendor

### Platform Configuration
- **Auth Control:** Toggle any auth method on/off per role
- **Feature Flags:** Enable/disable services or features
- **SMS Gateways:** Add, test, prioritize SMS providers
- **Map Provider:** Switch map tile provider from DB config
- **Platform Settings:** App name, terms, privacy policy

### Content Management
- Banners and promotional sliders
- Popups and announcements
- Push notification broadcasts
- Deep link management
- FAQ management
- Release notes

### Analytics & Insights
- Revenue analytics dashboard
- Search analytics (what users search for)
- Wishlist analytics (most wishlisted products)
- Ride statistics (heatmaps, peak hours)
- Experiment (A/B test) results

### Safety & Security
- SOS alert management
- Fraud detection flags
- Token family breach alerts
- IP whitelist management
- Security audit logs

---

## 18. Security Architecture

### Transport
- HTTPS in production (TLS 1.2+)
- All API calls require valid JWT (except public endpoints)

### Authentication Security
- bcrypt for password hashing (cost factor configurable)
- JWT with short expiry (15 min access tokens)
- Refresh token rotation on every use
- Token family breach detection (replay attack prevention)
- Rate limiting on OTP requests (configurable per gateway)
- Device fingerprinting on sessions

### Authorization
- `requireRole()` middleware on every protected route
- Role enum: `customer | rider | vendor | admin`
- No privilege escalation possible via API

### Data Security
- TOTP secrets encrypted at rest with AES (`TOTP_ENCRYPTION_KEY`)
- Magic link tokens stored as SHA-256 hashes (never raw)
- Email verification tokens stored as HMAC hashes (`TOKEN_HASH_SECRET`)
- No hardcoded secrets — all from environment variables

### Input Validation
- Zod validators on all request bodies
- `@workspace/api-zod` shared between frontend and backend

---

## 19. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | JWT signing key — app throws at startup if missing |
| `TOTP_ENCRYPTION_KEY` | ✅ | AES-256 key for TOTP secrets at rest |
| `TOKEN_HASH_SECRET` | ✅ | HMAC key for magic link + email verify tokens |
| `APP_BASE_URL` | ✅ | Base URL for magic link emails (e.g. `https://ajkmart.pk`) |
| `ALLOW_DEV_OTP` | Dev only | Set `true` to expose OTP in API response |
| `NODE_ENV` | ✅ | `development` or `production` |
| `PORT` | Optional | API server port (default: `8080`) |
| `GEMINI_API_KEY` | Optional | Google Gemini AI for recommendations |
| `FCM_SERVER_KEY` | Optional | Firebase push notifications |
| `TWILIO_SID` | Optional | Twilio SMS gateway |
| `TWILIO_AUTH_TOKEN` | Optional | Twilio SMS gateway auth |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth |
| `FACEBOOK_APP_ID` | Optional | Facebook OAuth |

---

## 20. Dev Workflows & Ports

| Workflow | Command | Port | Preview Path |
|---|---|---|---|
| **API Server** | `cd artifacts/api-server && PORT=8080 pnpm dev` | 8080 | `/api-docs` |
| **Admin Panel** | `cd artifacts/admin && PORT=3000 BASE_PATH=/admin pnpm dev` | 3000 | `/admin` |
| **Vendor App** | `cd artifacts/vendor-app && PORT=3001 BASE_PATH=/vendor pnpm dev` | 3001 | `/vendor` |
| **Rider App** | `cd artifacts/rider-app && PORT=3002 BASE_PATH=/rider pnpm dev` | 3002 | `/rider` |

### API Proxy Wiring
Each Vite frontend proxies `/api` → `http://127.0.0.1:8080`.
Controlled by `API_PORT` env var (default: `8080`) or `VITE_API_PROXY_TARGET`.

### Install & Run
```bash
# Install all dependencies
pnpm install

# Run all apps in parallel
pnpm dev

# Run only API server
pnpm --filter @workspace/api-server run dev

# Run only Admin
pnpm --filter @workspace/admin run dev

# Type check all packages
pnpm typecheck
```

---

## 21. Design System & Tokens

### Color Palette

| App | Primary | Accent | Background | Text |
|---|---|---|---|---|
| Admin | `#1A56DB` (Blue) | `#F59E0B` (Amber) | `#FFFFFF` | `#111827` |
| Vendor App | `#1A56DB` (Blue) | `#F59E0B` (Amber) | `#FFFFFF` | `#111827` |
| Rider App | `#F0B90B` (Gold) | — | `#0b0e11` (Dark) | `#FFFFFF` |
| Customer App | `#1A56DB` (Blue) | `#F0B90B` (Gold) | `#FFFFFF` | `#111827` |

### Typography
- **Primary Font:** Inter (weights: 400, 500, 600, 700)
- **Urdu Font:** Noto Nastaliq Urdu
- **Base Size:** 16px
- **Scale:** Tailwind default type scale

### Component Library
- TailwindCSS utility-first
- Shared primitives in `@workspace/ui`
- Consistent spacing using Tailwind's 4-point grid

---

## 22. Testing Strategy

### Unit / Integration Tests
```bash
# Backend auth tests
pnpm --filter @workspace/api-server run test

# Auth SDK tests
pnpm --filter @workspace/auth-react run test
```

### End-to-End Tests (Playwright)
```bash
# All E2E tests (requires running API server)
pnpm --filter @workspace/e2e run test

# Per-app E2E
pnpm e2e:admin
pnpm e2e:vendor
pnpm e2e:rider

# View E2E report
pnpm e2e:report
```

### TypeScript Checks
```bash
# Check all packages (CI mode)
pnpm typecheck:ci

# Check all TypeScript (including libs)
pnpm typecheck:all
```

### Current TypeScript Status
- `artifacts/api-server` — `tsc --noEmit` ✅ Error-free
- `artifacts/rider-app` — `tsc --noEmit` ✅ Error-free
- `artifacts/vendor-app` — `tsc --noEmit` ✅ Error-free
- `artifacts/admin` — `tsc --noEmit` ✅ Error-free

---

## 23. Deployment Architecture

### Production Stack
```
┌─────────────────────────────────────────┐
│            Reverse Proxy (Nginx)        │
│  /        → Customer App (static)       │
│  /admin   → Admin Panel (static)        │
│  /vendor  → Vendor App (static)         │
│  /rider   → Rider App (static)          │
│  /api     → API Server (Node.js)        │
└─────────────────────────────────────────┘
              │
    ┌─────────▼──────────┐
    │  API Server         │
    │  (PM2 / Docker)     │
    │  Port: 8080         │
    └─────────┬──────────┘
              │
    ┌─────────▼──────────┐
    │  PostgreSQL 16      │
    │  (Primary + Replica)│
    └────────────────────┘
```

### Build Commands
```bash
# Build all apps for production
pnpm build

# Build individual apps
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/admin run build
pnpm --filter @workspace/rider-app run build
pnpm --filter @workspace/vendor-app run build
```

---

## 24. Development Conventions

### Code Style
- **Language:** TypeScript throughout (strict mode)
- **Formatter:** Prettier (auto-run on commit via lint-staged)
- **Linter:** ESLint with TypeScript + React rules
- **Imports:** Organized automatically by `prettier-plugin-organize-imports`

### Git Conventions
- Pre-commit hooks via Husky run: `prettier --write` + `eslint --fix`
- Conventional commits recommended: `feat:`, `fix:`, `chore:`, `docs:`

### Critical Rules
- ❌ **DO NOT modify** `artifacts/api-server/src/routes/auth.ts` directly
- ❌ **DO NOT modify** `artifacts/ajkmart/` (customer mobile app)
- ✅ Ask before making major architectural changes
- ✅ Prefer iterative development — small, focused PRs

### File Naming
- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- Routes: `kebab-case.ts`
- Constants: `UPPER_SNAKE_CASE`

---

## 25. Roadmap & Phase Plan

### Phase 1 — Core Foundation ✅
- [x] Monorepo setup (pnpm workspaces, TypeScript)
- [x] PostgreSQL database with Drizzle ORM
- [x] Express 5 API server scaffold
- [x] Multi-method authentication system (7 methods)
- [x] Token rotation + breach detection
- [x] Admin, Rider, Vendor React apps bootstrapped
- [x] Shared auth SDK (`@workspace/auth-react`)

### Phase 1b — Auth & Profiles ✅
- [x] Rider registration wizard + KYC upload
- [x] Vendor registration wizard + store setup
- [x] Admin auth management + user management
- [x] Magic link email authentication
- [x] TOTP 2FA
- [x] Device fingerprinting

### Phase 2 — Commerce & Rides ✅
- [x] Product catalog + categories
- [x] Cart + wishlist + orders
- [x] Ride booking engine
- [x] Real-time Socket.IO rooms
- [x] Digital wallet (deposit, P2P, pay)
- [x] Home feed (banners + flash deals + trending)
- [x] Vendor order management

### Phase 3 — Advanced Features (In Progress)
- [x] Loyalty points system
- [x] Referral program
- [x] Push notifications (FCM)
- [x] WhatsApp delivery notifications
- [x] Support chat (Socket.IO)
- [x] Analytics dashboard (admin)
- [x] Live fleet map (admin)
- [ ] Inter-city transport (van booking)
- [ ] Pharmacy module (full)
- [ ] Parcel delivery (full)
- [ ] AI-powered recommendations (Gemini)
- [ ] Payment gateway full integration (JazzCash / EasyPaisa)

### Phase 4 — Scale & Polish (Planned)
- [ ] Customer mobile app (Expo) — full feature parity
- [ ] Performance optimizations (Redis caching)
- [ ] CDN for media assets
- [ ] Automated E2E test coverage >80%
- [ ] Multi-region deployment
- [ ] Fraud detection engine
- [ ] Advanced analytics (cohort, funnel)

---

## Quick Reference

```bash
# Clone and setup
git clone <repo-url>
cd ajkmart
pnpm install

# Set required env vars
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, etc.

# Run database migrations
pnpm --filter @workspace/db run migrate

# Start all services
pnpm dev

# Access apps
# API Docs:   http://localhost:8080/api-docs
# Admin:      http://localhost:3000/admin
# Vendor:     http://localhost:3001/vendor
# Rider:      http://localhost:3002/rider
```

---

*Document maintained by the AJKMart engineering team. Last updated: May 28, 2026.*
