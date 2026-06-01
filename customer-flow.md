# AJKMART Customer App – Complete Logic Flow (Visual)

> **Theme:** Dark mode with yellow/gold accents (PRESERVED — do NOT change)
> **Purpose:** Complete visual reference for every customer-facing app flow
> **Last Updated:** 2026-05-28

---

## Table of Contents

1. [App Launch & Auth Check](#1-app-launch--auth-check)
2. [Registration Wizard](#2-registration-wizard)
3. [Login Flow](#3-login-flow)
4. [Home Screen](#4-home-screen)
5. [Browse & Search](#5-browse--search)
6. [Mart — Grocery Shopping](#6-mart--grocery-shopping)
7. [Food — Restaurant Ordering](#7-food--restaurant-ordering)
8. [Pharmacy](#8-pharmacy)
9. [Cart & Checkout](#9-cart--checkout)
10. [Payment Flow](#10-payment-flow)
11. [Order Tracking (Live)](#11-order-tracking-live)
12. [Ride Booking](#12-ride-booking)
13. [Parcel Delivery](#13-parcel-delivery)
14. [School Van / Pool](#14-school-van--pool)
15. [Orders Tab — History & Active](#15-orders-tab--history--active)
16. [Wallet](#16-wallet)
17. [Loyalty Program](#17-loyalty-program)
18. [Profile & Addresses](#18-profile--addresses)
19. [Notifications & Deep Links](#19-notifications--deep-links)
20. [Feature Gates & Maintenance](#20-feature-gates--maintenance)
21. [Socket Events Reference](#21-socket-events-reference)
22. [Backend API Routes Reference](#22-backend-api-routes-reference)
23. [Theme Style Guide](#23-theme-style-guide)

---

## 1. App Launch & Auth Check

```
┌─────────────────────────────────────────────────────────────────┐
│                    APP LAUNCH  (Expo Router)                     │
│   app/_layout.tsx  →  Providers:                                 │
│   AuthContext  •  CartContext  •  LanguageContext                 │
│   PlatformConfigContext  •  QueryClient                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│        GET /api/platform-config  (first network call)            │
│        Bootstraps: feature flags, delivery fees, UI text,        │
│        maintenance status, loyalty rules, auth methods           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│        appStatus check:                                          │
│        "maintenance" → MaintenanceScreen overlay (full block)    │
│        "limited"     → AnnouncementBar shown, app usable         │
│        "active"      → proceed normally                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│        AuthGuard.tsx — Check stored auth token                   │
└─────────────────────────────────────────────────────────────────┘
                 │                             │
           TOKEN FOUND                   NO TOKEN
                 │                             │
                 ▼                             ▼
┌──────────────────────────┐     ┌──────────────────────────────┐
│  GET /api/users/profile   │     │       app/auth/index.tsx      │
│  Validate + load profile  │     │  Login  or  Guest Browse      │
│  Extract loyalty tier     │     │  (some browsing allowed       │
│  Connect Socket.IO        │     │   without account)            │
└──────────────────────────┘     └──────────────────────────────┘
          │           │
       VALID        INVALID
          │           │
          │           ▼
          │    Clear token → Login
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   HOME SCREEN  (tabs)/index.tsx                  │
│   • Service grid (Mart / Food / Rides / Pharmacy / Parcel / Van) │
│   • Banner carousel (platform banners from admin)                │
│   • Flash deals section                                          │
│   • Personalized product recommendations                         │
│   • Push notification handler registered                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Registration Wizard

```
┌─────────────────────────────────────────────────────────────────┐
│                  app/auth/register.tsx                           │
│              Multi-step registration wizard                       │
│         Progress indicator: Step 1 → 2 → 3 → 4                  │
└─────────────────────────────────────────────────────────────────┘
```

### Step 1 — Phone OTP

```
┌─────────────────────────────────────────────────────────────────┐
│  Enter phone number  (03XXXXXXXXX format)                        │
│  [Send OTP]  →  POST /api/auth/send-otp { phone }               │
│  Enter 6-digit OTP (received via SMS)                            │
│  [Verify OTP]  →  POST /api/auth/verify-otp { phone, code }     │
│  ├─ SUCCESS: phone pre-verified, proceed to Step 2               │
│  └─ FAIL:    "Invalid OTP" / "OTP expired — Resend"              │
└─────────────────────────────────────────────────────────────────┘
```

### Step 2 — Personal Details

```
┌──────────────────────────────────────────────────────────────────┐
│  FIELD               REQUIRED   VALIDATION                        │
├──────────────────────────────────────────────────────────────────┤
│  Full Name           YES        min 2 characters                  │
│  Email               NO         valid email format                │
│  Date of Birth       NO         date picker                       │
│  Gender              NO         Male / Female / Prefer not to say │
└──────────────────────────────────────────────────────────────────┘
```

### Step 3 — Location

```
┌─────────────────────────────────────────────────────────────────┐
│  Auto-detect via GPS  →  requestForegroundPermissionsAsync()     │
│       ├─ GRANTED  →  Reverse-geocode to city/area                │
│       └─ DENIED   →  Show manual city/area dropdown              │
│                       (GET /api/public/zones)                    │
│  Confirm home address for default delivery                       │
└─────────────────────────────────────────────────────────────────┘
```

### Step 4 — Security (CNIC & Password)

```
┌──────────────────────────────────────────────────────────────────┐
│  FIELD               REQUIRED   VALIDATION                        │
├──────────────────────────────────────────────────────────────────┤
│  CNIC / ID Number    YES        XXXXX-XXXXXXX-X format            │
│  Password            YES        8+ chars, 1 uppercase,            │
│                                 1 number, 1 symbol                │
│  Confirm Password    YES        must match                        │
│  Terms & Conditions  YES        checkbox                          │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  POST /api/auth/register  { all fields + phone (pre-verified) }  │
│                                                                  │
│  Account Created:                                                │
│  phoneVerified = true  (already done in Step 1)                  │
│  emailVerified = false                                           │
│  loyaltyTier   = "bronze"  (default)                             │
│  loyaltyPoints = 0                                               │
│                                                                  │
│  Backend returns: access_token + refresh_token                   │
│  Frontend stores → auto-login → HOME SCREEN                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Login Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   app/auth/index.tsx                             │
│                                                                  │
│   Method 1:  Phone + OTP           (Primary)                     │
│   Method 2:  Email + Password                                    │
│   Method 3:  Social Login → Google / Facebook                    │
│   Method 4:  Magic Link (email)                                  │
│   Method 5:  Biometric (FaceID / Fingerprint — returning users)  │
│              attemptBiometricLogin() from AuthContext            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│   POST /api/auth/login  { credential + method }                  │
│   Account suspended? → 403  "Account suspended"                  │
│   Account not found? → 404  "No account found"                   │
│   Wrong password?    → 401  "Invalid credentials"                │
│   SUCCESS → access_token + refresh_token                         │
│   isAuthenticated = true → HOME SCREEN                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Home Screen

```
┌─────────────────────────────────────────────────────────────────┐
│                  HOME  app/(tabs)/index.tsx                      │
├─────────────────────────────────────────────────────────────────┤
│  TOP BAR                                                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  📍 Deliver to: F-7/2, Islamabad  [Change]                 │  │
│  │  🔔 Notifications bell  •  💬 Chat                          │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  SEARCH BAR  (taps → app/search.tsx)                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🔍  Search products, food, medicine...                    │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  BANNER CAROUSEL  (BannerCarousel.tsx)                           │
│  ◀ [  Promo Banner 1  ] ▶  [  Flash Deal  ] ▶  [  New Vendor  ] │
├─────────────────────────────────────────────────────────────────┤
│  SERVICE GRID  (ServiceGrid.tsx)                                  │
│  ┌────────┬────────┬────────┬────────┬────────┬────────┐        │
│  │  🛒     │  🍔     │  💊     │  🏍     │  📦     │  🚌    │        │
│  │  Mart  │  Food  │Pharmacy│  Ride  │ Parcel │  Van   │        │
│  └────────┴────────┴────────┴────────┴────────┴────────┘        │
│  (ServiceGuard hides disabled services per platformConfig)       │
├─────────────────────────────────────────────────────────────────┤
│  FLASH DEALS  (FlashDeals.tsx)                                   │
│  Time-limited offers  •  Countdown timer per deal                │
│  Horizontal scroll  →  tap → product/store page                  │
├─────────────────────────────────────────────────────────────────┤
│  PERSONALIZED SECTIONS                                           │
│  • "Order Again" (recently ordered items)                        │
│  • "Nearby Stores" (sorted by distance)                          │
│  • "Trending in your area"                                       │
├─────────────────────────────────────────────────────────────────┤
│  BOTTOM NAVIGATION  (4 tabs)                                     │
│  ┌──────────┬──────────┬──────────┬──────────┐                  │
│  │   🏠      │   📦      │   💰      │   👤      │                  │
│  │  Home   │  Orders  │  Wallet  │  Profile │                  │
│  └──────────┴──────────┴──────────┴──────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Browse & Search

```
┌─────────────────────────────────────────────────────────────────┐
│                   app/search.tsx                                 │
│            Universal search: Mart + Food + Pharmacy              │
└─────────────────────────────────────────────────────────────────┘
                              │
                   Customer taps search bar
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│   EMPTY STATE (before typing)                                    │
│   • Recent search history (stored locally)                       │
│   • Trending search terms (GET /api/search/trending)             │
│   • Popular categories                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                    Customer types query
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│   GET /api/search?q=<query>&type=all&lat=&lng=                   │
│   Debounced (300ms) — fires as user types                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│   RESULTS PAGE                                                   │
│                                                                  │
│   FILTER BAR:                                                    │
│   Type: [All] [Products] [Stores] [Restaurants] [Medicine]       │
│   Sort:  Relevance / Price Low→High / Price High→Low / Rating    │
│   Filters: Price range slider  •  Min rating  •  Category        │
│            Distance (km)  •  Open now only                       │
│                                                                  │
│   RESULT CARDS:                                                  │
│   Products:    Image, Name, Price, Store name, Add to Cart       │
│   Stores:      Logo, Name, Rating, ETA, Min order, Open/Closed   │
│   Restaurants: Same as stores + cuisine type                     │
│                                                                  │
│   NO RESULTS:                                                    │
│   "No results for '...'"  →  logged as failed search analytics   │
│   Suggestions: similar products, nearby stores                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Mart — Grocery Shopping

```
┌─────────────────────────────────────────────────────────────────┐
│                  app/mart/index.tsx                              │
│   GET /api/mart/stores?lat=&lng=  (sorted by distance)           │
│                                                                  │
│   STORE CARDS:                                                   │
│   ┌───────────────────────────────────────────────────────────┐ │
│   │  [Logo]  Ali Mart                    ★ 4.7  (132)          │ │
│   │          Grocery  •  0.8 km  •  ETA 25 min                 │ │
│   │          Min order: PKR 200  •  Delivery: PKR 50  •  ● OPEN │ │
│   └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                   Customer taps a store
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               app/mart/store/[id].tsx                            │
│   GET /api/mart/stores/:id  →  store info + product catalog      │
│                                                                  │
│   STORE HEADER:                                                  │
│   Banner image  •  Name  •  Rating  •  Hours  •  Delivery info   │
│                                                                  │
│   CATEGORY TABS  (horizontal scroll):                            │
│   Beverages  •  Snacks  •  Dairy  •  Household  •  Bakery  •...  │
│                                                                  │
│   PRODUCT GRID:                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  [IMG]  Mineral Water 1.5L           PKR 80              │   │
│   │         In Stock  •  Ali Mart                            │   │
│   │         ❤ Wishlist          [  −  │ 2 │  +  ]           │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   FLASH DEALS section (if store has active deals)                │
│   CART FAB (floating):  🛒 3 items  •  PKR 360  [View Cart]      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Food — Restaurant Ordering

```
┌─────────────────────────────────────────────────────────────────┐
│                  app/food/index.tsx                              │
│   GET /api/food/restaurants?lat=&lng=                            │
│                                                                  │
│   CUISINE FILTER ROW (horizontal):                               │
│   🍕 Pizza  •  🍔 Burgers  •  🍛 Desi  •  🥗 Healthy  •  🍜 ...  │
│                                                                  │
│   RESTAURANT CARD:                                               │
│   ┌───────────────────────────────────────────────────────────┐ │
│   │  [Banner]  Karachi Biryani House      ★ 4.8               │ │
│   │            Pakistani  •  1.2 km  •  ETA 35 min            │ │
│   │            Min order: PKR 300  •  Delivery: FREE           │ │
│   │            🏷 20% OFF on orders above PKR 500              │ │
│   └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                   Customer taps a restaurant
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│            app/food/restaurant/[id].tsx                          │
│   GET /api/food/restaurants/:id  →  menu + categories            │
│                                                                  │
│   MENU SECTIONS (sticky scroll):                                 │
│   Starters  •  Mains  •  Breads  •  Drinks  •  Desserts         │
│                                                                  │
│   MENU ITEM CARD:                                                │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  [IMG]  Chicken Biryani (Full)       PKR 450             │   │
│   │         Slow-cooked basmati rice with tender chicken     │   │
│   │         🌶 Spicy  •  ⏱ 25 min                             │   │
│   │         [Customise & Add →]                              │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ITEM CUSTOMIZATION MODAL:                                      │
│   • Size: Small / Medium / Full                                  │
│   • Add-ons: Extra raita (+PKR 50), Salad (+PKR 30)              │
│   • Special instructions: text field                             │
│   [Add to Cart  PKR 480]                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Pharmacy

```
┌─────────────────────────────────────────────────────────────────┐
│                  app/pharmacy/index.tsx                          │
│   GET /api/pharmacy/stores?lat=&lng=                             │
│                                                                  │
│   CATEGORY GRID:                                                 │
│   💊 OTC Medicines  •  🧴 Skincare  •  👶 Baby Care              │
│   💪 Vitamins       •  🩺 Medical Devices  •  🌿 Herbal          │
│                                                                  │
│   ⚕ PRESCRIPTION UPLOAD:                                        │
│   [📷 Upload Prescription]                                       │
│   → Image sent to pharmacy for manual review                     │
│   → Pharmacist confirms items + price → customer approves        │
│   → POST /api/pharmacy/prescription { image, pharmacyId }        │
│                                                                  │
│   SEARCH:                                                        │
│   Search by medicine name, brand, or generic compound            │
│   Results show: Available stores + prices + stock status         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              app/pharmacy/checkout.tsx                           │
│   Same checkout flow as Mart (see Section 9)                     │
│   Age verification prompt if item is age-restricted              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Cart & Checkout

### Cart Management (`app/cart/index.tsx` + `CartContext.tsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│                     CART RULES                                   │
│                                                                  │
│   One cart per service type at a time                            │
│   (Mart cart and Food cart are separate)                         │
│                                                                  │
│   Customer adds item from DIFFERENT store while cart has items:  │
│   → CartSwitchModal appears:                                     │
│   "Your cart has items from Ali Mart.                            │
│    Start a new cart from Hassan Pharmacy?"                       │
│   [Keep Ali Mart]  or  [Start New Cart]                          │
└─────────────────────────────────────────────────────────────────┘

CART SCREEN:
┌─────────────────────────────────────────────────────────────────┐
│  Store: Ali Mart  •  ETA: 25 min                                 │
├─────────────────────────────────────────────────────────────────┤
│  ITEM ROWS:                                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Mineral Water 1.5L  •  PKR 80    [  −  │ 2 │  +  ]  🗑   │  │
│  │  Lays Chips 50g      •  PKR 50    [  −  │ 1 │  +  ]  🗑   │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  PROMO CODE:                                                     │
│  [Enter promo code...]  [Apply]                                  │
│  → GET /api/orders/validate-promo { code, cartTotal }            │
│  ├─ Valid:   "SUMMER20 applied — PKR 42 discount"                │
│  └─ Invalid: "Code expired" / "Min order not met" / "Not found"  │
├─────────────────────────────────────────────────────────────────┤
│  ORDER SUMMARY:                                                  │
│  Subtotal:          PKR 210                                      │
│  Delivery Fee:      PKR  50                                      │
│  Promo Discount:   −PKR  42                                      │
│  ────────────────────────                                        │
│  Total:             PKR 218                                      │
├─────────────────────────────────────────────────────────────────┤
│  DELIVERY ADDRESS:                                               │
│  📍 F-7/2, Islamabad  [Change]                                   │
│  Delivery notes: "Ring bell twice"                               │
├─────────────────────────────────────────────────────────────────┤
│  [Proceed to Checkout →]                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Cart Validation & Checkout

```
┌─────────────────────────────────────────────────────────────────┐
│  Customer taps [Proceed to Checkout]                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  POST /api/orders/validate-cart                                  │
│  { items, storeId, promoCode?, deliveryAddress }                 │
│                                                                  │
│  Checks:                                                         │
│  • All items still in stock?      NO → "X is out of stock"       │
│  • Store still open?              NO → "Store is now closed"     │
│  • Min order met?                 NO → "Minimum order is PKR 200"│
│  • Promo code still valid?        NO → "Promo no longer valid"   │
│  • Delivery address in range?     NO → "Outside delivery zone"   │
│                                                                  │
│  ALL OK → Proceed to Payment Selection                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Payment Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PAYMENT SELECTION                             │
│                                                                  │
│   ○ Cash on Delivery (COD)                                       │
│   ○ Wallet Balance  (PKR 2,400 available)                        │
│   ○ JazzCash        (Mobile account)                             │
│   ○ EasyPaisa       (Mobile account)                             │
│                                                                  │
│  [Place Order →]                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼──────────────────┬────────────────┐
       COD                 WALLET            JAZZCASH         EASYPAISA
        │                    │                    │                │
        ▼                    ▼                    ▼                ▼
┌─────────────┐   ┌──────────────────┐   ┌──────────────────────────┐
│ POST /orders │   │ Check balance ≥  │   │  POST /api/payments      │
│ { payment:   │   │ order total      │   │  { method, amount }      │
│   "cod" }    │   │ ├─ YES: deduct   │   │  Receive payment URL     │
│              │   │ │  POST /orders  │   │  Redirect customer to    │
│ Order placed │   │ └─ NO: "Insuffi- │   │  JazzCash/EasyPaisa app  │
│ immediately  │   │   cient balance" │   │  Customer approves       │
└─────────────┘   │   Top up wallet  │   │  GET /payments/:id/status│
                  │   or change       │   │  (poll until confirmed)  │
                  │   payment method  │   │  ├─ paid   → place order │
                  └──────────────────┘   │  └─ failed → show error  │
                                         └──────────────────────────┘
```

### Order Placement

```
┌─────────────────────────────────────────────────────────────────┐
│   POST /api/orders                                               │
│   { storeId, items, deliveryAddress, paymentMethod,              │
│     promoCode?, instructions? }                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│   Socket events fire immediately:                                │
│   order:ack        → "Order received by system"                  │
│   order:confirmed  → "Vendor confirmed your order"               │
│                                                                  │
│   Order ID assigned  →  Navigate to Order Tracking               │
│   Cart cleared automatically                                     │
│   Loyalty points awarded (if applicable)                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Order Tracking (Live)

```
┌─────────────────────────────────────────────────────────────────┐
│                 app/order/index.tsx                              │
│              GET /api/orders/:id  →  full order detail           │
└─────────────────────────────────────────────────────────────────┘

STATUS STEPPER:
┌─────────────────────────────────────────────────────────────────┐
│  [1] Order Placed   [2] Confirmed   [3] Preparing   [4] Ready   │
│  [5] Rider Picked Up   [6] On the Way   [7] Delivered ✅         │
│                                                                  │
│  Each step timestamp shown  •  ETA updates in real-time          │
└─────────────────────────────────────────────────────────────────┘

LIVE MAP (when rider is assigned):
┌─────────────────────────────────────────────────────────────────┐
│  Socket event: rider:location { lat, lng }                       │
│  → Rider pin moves on map with smooth animation interpolator     │
│  → ETA recalculates based on current rider position              │
│                                                                  │
│  Fallback (if socket disconnects):                               │
│  → HTTP polling: GET /api/orders/:id/track  every 15 seconds     │
│                                                                  │
│  RIDER INFO CARD:                                                │
│  🏍 Hassan M.  •  ★ 4.9  •  [📞 Call]  [💬 Chat]               │
└─────────────────────────────────────────────────────────────────┘

ON DELIVERY:
┌─────────────────────────────────────────────────────────────────┐
│   "Your order has been delivered!"                               │
│   [⭐ Rate your experience]  →  Rating + Review screen           │
│   [🔁 Reorder]               →  Adds same items to cart         │
│   [❓ Problem with order]    →  Support chat thread opened       │
└─────────────────────────────────────────────────────────────────┘

CANCELLATION FLOW:
┌─────────────────────────────────────────────────────────────────┐
│  Customer can cancel BEFORE rider is assigned                    │
│  [Cancel Order] → Select reason → POST /api/orders/:id/cancel    │
│  • COD order:     no charge                                      │
│  • Wallet order:  full refund to wallet                          │
│  • Digital:       refund via same method (processing time)       │
│                                                                  │
│  AFTER rider assigned → Cannot cancel (contact support)          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Ride Booking

```
┌─────────────────────────────────────────────────────────────────┐
│                  app/ride/index.tsx                              │
│              (ServiceGuard checks feature_rides flag)            │
└─────────────────────────────────────────────────────────────────┘

BOOKING FORM (RideBookingForm.tsx):
┌─────────────────────────────────────────────────────────────────┐
│  📍 Pickup:    [Current location / search]                        │
│  📍 Drop:      [Enter destination]                                │
│                                                                  │
│  VEHICLE TYPE:                                                   │
│  ┌──────────┬──────────┬──────────┐                              │
│  │   🏍 Bike │  🚗 Car  │  🛺 Rikshaw│                              │
│  │  PKR 100 │ PKR 200  │ PKR 150  │                              │
│  └──────────┴──────────┴──────────┘                              │
│  (fares calculated from platform config + distance matrix)       │
│                                                                  │
│  Route preview on map  •  Estimated time shown                   │
│                                                                  │
│  [Book Ride  PKR 180 →]                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│   POST /api/rides { pickup, drop, vehicleType, fare }            │
│   Status: "searching" — broadcast to nearby online riders        │
└─────────────────────────────────────────────────────────────────┘

NEGOTIATION FLOW (if rider sends counter offer):
┌─────────────────────────────────────────────────────────────────┐
│  Rider counters: "PKR 220"                                       │
│  Customer sees:  "Hassan offers this ride for PKR 220"           │
│  [✅ Accept PKR 220]   or   [❌ Decline]   or   [Counter: PKR ___]│
│  → POST /api/rides/:id/counter-response { action, amount? }      │
└─────────────────────────────────────────────────────────────────┘

LIVE RIDE TRACKING (RideTracker.tsx):
┌─────────────────────────────────────────────────────────────────┐
│  STATUS FLOW:                                                    │
│  searching → accepted → rider_heading → arrived → in_transit    │
│  → completed                                                     │
│                                                                  │
│  "searching":   Spinner + "Finding a rider near you..."          │
│  "accepted":    Rider card shown — Name, Photo, Rating, Plate    │
│  "arrived":     "Hassan has arrived at your pickup location"     │
│                 Show 4-digit OTP to give to rider                │
│  "in_transit":  Live map — rider moving to destination           │
│  "completed":   Fare summary + [Rate Rider] + [Rebook]           │
│                                                                  │
│  RIDE CONTROLS:                                                  │
│  [📞 Call Rider]   [💬 Chat Rider]   [🆘 SOS]                   │
│  [Cancel Ride]  (only while "searching" — no charge)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 13. Parcel Delivery

```
┌─────────────────────────────────────────────────────────────────┐
│                  app/parcel/index.tsx                            │
│              (ServiceGuard checks feature_parcel flag)           │
│                                                                  │
│  BOOKING FORM:                                                   │
│  📍 Pickup Address:   ___________________                        │
│  📍 Drop Address:     ___________________                        │
│  📦 Package details:  Weight / Size / Fragile? / Description     │
│  👤 Recipient Name:   ___________________                        │
│  📞 Recipient Phone:  ___________________                        │
│                                                                  │
│  FARE ESTIMATE:  PKR 150  (based on distance + package size)     │
│  Payment: COD / Wallet                                           │
│                                                                  │
│  [Send Parcel →]  →  POST /api/parcel { all fields }             │
│  Tracking works same as order tracking (socket + polling)        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 14. School Van / Pool

```
┌─────────────────────────────────────────────────────────────────┐
│              app/school/index.tsx  •  app/van/index.tsx          │
│              (ServiceGuard checks feature_van flag)              │
│                                                                  │
│  SCHOOL VAN:                                                     │
│  • Monthly subscription to fixed routes                          │
│  • Child registration (name, school, grade)                      │
│  • Pickup + drop times per day                                   │
│  • Live tracking of van on school run                            │
│  • SMS alert when van is 5 min away                              │
│  POST /api/school-van/subscribe { childDetails, routeId }        │
│                                                                  │
│  POOL / VAN SHARING:                                             │
│  • Book shared van ride for groups                               │
│  • See available van routes nearby                               │
│  • Pay per seat                                                  │
│  POST /api/van/book { routeId, seats, pickup, drop }             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 15. Orders Tab — History & Active

```
┌─────────────────────────────────────────────────────────────────┐
│                  app/(tabs)/orders.tsx                           │
│   GET /api/orders?customerId=me  (paginated, all types)          │
│                                                                  │
│   TABS:                                                          │
│   [🔴 Active]  [✅ Completed]  [❌ Cancelled]                     │
│                                                                  │
│   ACTIVE ORDER CARD:                                             │
│   ┌───────────────────────────────────────────────────────────┐ │
│   │  🛒 Mart Order #1042  •  Ali Mart  •  Preparing...         │ │
│   │  PKR 218  •  3 items                                       │ │
│   │  ETA: ~20 min                      [Track Order →]         │ │
│   └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│   COMPLETED ORDER CARD:                                          │
│   ┌───────────────────────────────────────────────────────────┐ │
│   │  ✅ Mart Order #1041  •  Ali Mart  •  28 May, 12:30        │ │
│   │  PKR 450  •  5 items                                       │ │
│   │  [🔁 Reorder]  [📋 View Details]  [⭐ Rate]                │ │
│   └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 16. Wallet

```
┌─────────────────────────────────────────────────────────────────┐
│                  app/(tabs)/wallet.tsx                           │
│   GET /api/wallet  →  balance + paginated transactions           │
│   Socket: wallet:update / wallet:balance  →  live balance sync   │
└─────────────────────────────────────────────────────────────────┘

WALLET SCREEN:
┌─────────────────────────────────────────────────────────────────┐
│  BALANCE CARD                                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Available Balance                                         │  │
│  │  PKR 2,400                                                 │  │
│  │  Loyalty Points: 320 pts  (≈ PKR 32 value)                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────┬──────────────┬──────────────┬──────────────┐      │
│  │ [💳 Top   │  [📤 Send /   │  [🔁 Loyalty  │  [📋 History │      │
│  │   Up]    │   Transfer]  │   Redeem]    │   ]          │      │
│  └──────────┴──────────────┴──────────────┴──────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### Top-Up Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Customer taps [💳 Top Up]                                       │
│                                                                  │
│  Enter amount: PKR ___                                           │
│  Method: JazzCash / EasyPaisa / Bank Transfer                    │
│                                                                  │
│  BANK TRANSFER:                                                  │
│  Show platform bank account details                              │
│  Customer transfers manually                                     │
│  Enter Transaction ID (TxID) from bank                          │
│  POST /api/wallet/topup { amount, txId, method: "bank" }         │
│  Admin confirms → balance credited                               │
│                                                                  │
│  JAZZCASH / EASYPAISA:                                           │
│  POST /api/payments { amount, method }                           │
│  Redirect to payment app  →  Poll status                         │
│  GET /api/payments/:id/status (every 3s, timeout 5min)           │
│  ├─ paid   → balance credited instantly                          │
│  └─ failed → "Payment failed, try again"                         │
└─────────────────────────────────────────────────────────────────┘
```

### Transfer Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Customer taps [📤 Send / Transfer]                              │
│                                                                  │
│  METHOD:                                                         │
│  ○ Send by Phone Number  →  Enter recipient phone                │
│  ○ Send by QR Code       →  Scan recipient QR                    │
│                                                                  │
│  Enter amount: PKR ___                                           │
│  Reason (optional): ___                                          │
│                                                                  │
│  Biometric confirmation (if enabled)                             │
│  POST /api/wallet/transfer { toPhone/toUserId, amount, note }    │
│  ├─ SUCCESS: Both wallets updated, socket notifies both parties  │
│  └─ FAIL:   "Recipient not found" / "Insufficient balance"       │
└─────────────────────────────────────────────────────────────────┘
```

### Transaction History

```
┌─────────────────────────────────────────────────────────────────┐
│  Filter: [All] [Orders] [Top-ups] [Transfers] [Refunds] [Loyalty]│
│                                                                  │
│  TRANSACTION ROW:                                                │
│  2026-05-28 14:30  Order #1042  •  −PKR 218  •  Balance: 2,182  │
│  2026-05-28 10:00  Top-up       •  +PKR 500  •  Balance: 2,400  │
│  2026-05-27 18:20  Transfer to Ali K.  •  −PKR 200              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 17. Loyalty Program

```
┌─────────────────────────────────────────────────────────────────┐
│  Rules fetched from:  GET /api/platform-config  →  loyalty{}     │
│                                                                  │
│  EARNING POINTS:                                                 │
│  Every PKR 100 spent on orders → 10 loyalty points earned        │
│  Points auto-credited when order = "delivered"                   │
│  Referral bonus: 50 pts when referee places first order          │
│                                                                  │
│  TIER SYSTEM:                                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🥉 Bronze    0 – 499 pts    Default                     │    │
│  │  🥈 Silver    500 – 1999 pts  +5% cashback on orders     │    │
│  │  🥇 Gold      2000 – 4999 pts +10% cashback + priority   │    │
│  │               dispatch                                   │    │
│  │  💎 Platinum  5000+ pts      +15% cashback + free        │    │
│  │               delivery on all orders                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  REDEEMING POINTS:                                               │
│  100 points = PKR 10 wallet credit                               │
│  Minimum redeem: 100 points                                      │
│  [Redeem Points] → POST /api/loyalty/redeem { points }           │
│  → Wallet credited instantly                                     │
│                                                                  │
│  PROGRESS BAR (visible in Profile and Wallet):                   │
│  ▓▓▓▓▓▓▓▓░░░░  320 / 500 pts to Silver  (64%)                   │
│                                                                  │
│  CASHBACK:                                                       │
│  Applied at checkout automatically based on tier                 │
│  Shown as line item in order summary                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 18. Profile & Addresses

```
┌─────────────────────────────────────────────────────────────────┐
│                  app/(tabs)/profile.tsx                          │
│   GET /api/users/profile  →  load profile data                   │
└─────────────────────────────────────────────────────────────────┘

PROFILE SCREEN SECTIONS:
┌─────────────────────────────────────────────────────────────────┐
│  USER CARD                                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  [Avatar]  Ali Khan            AJK-ID: AJK-XYZ001          │  │
│  │            0300-1234567        ali@email.com               │  │
│  │            Tier: 🥈 Silver  •  320 loyalty points           │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  MENU ITEMS:                                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  📍 Saved Addresses                        [>]             │  │
│  │  🔔 Notification Preferences               [>]             │  │
│  │  🔒 Security (Password / Biometric / 2FA)  [>]             │  │
│  │  🌐 Language                               [>]             │  │
│  │  🎁 Referral Code: ALIK2024                [Share]         │  │
│  │  ❓ Help & Support                         [>]             │  │
│  │  ⭐ Rate the App                            [>]             │  │
│  │  📄 Terms & Privacy Policy                 [>]             │  │
│  │  🚪 Logout                                 [>]             │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Saved Addresses

```
┌─────────────────────────────────────────────────────────────────┐
│  GET /api/users/addresses  →  list saved addresses               │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🏠 Home     F-7/2, Islamabad            [Edit] [Delete]   │  │
│  │  🏢 Office   Blue Area, G-5, Islamabad   [Edit] [Delete]   │  │
│  └───────────────────────────────────────────────────────────┘  │
│  [+ Add New Address]  →  Map pin picker + label + notes           │
│  POST /api/users/addresses { label, lat, lng, text, notes }      │
└─────────────────────────────────────────────────────────────────┘
```

### Account Verification (in Profile)

```
┌─────────────────────────────────────────────────────────────────┐
│  VERIFICATION STATUS                                             │
│                                                                  │
│  ✅  Phone: Verified (done at registration)                      │
│  🟡  Email: NOT VERIFIED                                         │
│      [Verify Email] → POST /api/verification/email/send          │
│      Enter 6-digit code → POST /api/verification/email/confirm   │
│      Bonus: 10 loyalty points                                    │
│                                                                  │
│  ✅  CNIC: Provided at registration                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 19. Notifications & Deep Links

### Push Notifications (`app/_handlers/PushNotificationHandler.tsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│  NOTIFICATION TYPES  (FCM / Expo Notifications)                  │
│                                                                  │
│  NOTIFICATION          ACTION ON TAP                             │
│  ─────────────────────────────────────────────────────────────  │
│  Order confirmed        → Open Order Tracking screen             │
│  Rider assigned         → Open Order Tracking (map view)         │
│  Order delivered        → Open Rate Experience screen            │
│  Ride accepted          → Open Ride Tracker                      │
│  Promo available        → Open specific store/category           │
│  Flash deal started     → Open Flash Deals section               │
│  Wallet credited        → Open Wallet tab                        │
│  Referral bonus         → Open Wallet (show transaction)         │
└─────────────────────────────────────────────────────────────────┘
```

### Deep Link Handler (`app/_handlers/DeepLinkHandler.tsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│  DEEP LINK SCHEME:  ajkmart://                                   │
│                                                                  │
│  ajkmart://order/:id         → Order Tracking screen             │
│  ajkmart://store/:id         → Mart/Food store page              │
│  ajkmart://ride/:id          → Ride Tracker                      │
│  ajkmart://wallet            → Wallet tab                        │
│  ajkmart://promo/:code       → Cart with promo pre-applied       │
│  ajkmart://referral/:code    → Register with referral attached   │
│                                                                  │
│  Universal Links (HTTPS):  https://ajkmart.pk/...               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 20. Feature Gates & Maintenance

### ServiceGuard.tsx

```
┌─────────────────────────────────────────────────────────────────┐
│  Customer taps a service on Home grid                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  ServiceGuard checks PlatformConfigContext:                      │
│                                                                  │
│  feature_mart     disabled → "Mart is temporarily unavailable"   │
│  feature_food     disabled → "Food delivery coming soon"         │
│  feature_rides    disabled → "Rides not available in your area"  │
│  feature_pharmacy disabled → "Pharmacy service unavailable"      │
│  feature_parcel   disabled → "Parcel service unavailable"        │
│  feature_van      disabled → "Van service unavailable"           │
│                                                                  │
│  ALL ENABLED → navigate to service screen                        │
└─────────────────────────────────────────────────────────────────┘
```

### Maintenance Mode

```
┌─────────────────────────────────────────────────────────────────┐
│  IF appStatus === "maintenance"                                   │
│  → MaintenanceScreen.tsx shown (full screen, cannot bypass)      │
│  → Shows maintenance message + estimated restoration time        │
│  → Retry button: re-fetches platform-config every 60s            │
│  → When status changes to "active" → app resumes automatically   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 21. Socket Events Reference

```
┌──────────────────────┬───────────────┬────────────────────────┬────────────────────────────┐
│  Event Name          │  Direction    │  Payload               │  Action                     │
├──────────────────────┼───────────────┼────────────────────────┼────────────────────────────┤
│  connect             │  OUT          │  { token: JWT }         │  Join customer room         │
├──────────────────────┼───────────────┼────────────────────────┼────────────────────────────┤
│  order:ack           │  IN           │  { orderId }            │  "Order received" toast     │
│  order:confirmed     │  IN           │  { orderId, eta }       │  Update stepper + ETA       │
│  order:status        │  IN           │  { orderId, status }    │  Advance status stepper     │
│  order:cancelled     │  IN           │  { orderId, reason }    │  Show cancellation screen   │
├──────────────────────┼───────────────┼────────────────────────┼────────────────────────────┤
│  rider:location      │  IN           │  { riderId, lat, lng }  │  Move rider pin on map      │
│                      │               │                        │  with smooth interpolation  │
├──────────────────────┼───────────────┼────────────────────────┼────────────────────────────┤
│  ride:accepted       │  IN           │  { riderId, riderInfo } │  Show rider card            │
│  ride:arrived        │  IN           │  { rideId }             │  Show OTP for rider         │
│  ride:in_transit     │  IN           │  { rideId }             │  Switch to live map mode    │
│  ride:completed      │  IN           │  { rideId, fare }       │  Show summary + rate screen │
│  ride:counter        │  IN           │  { rideId, amount }     │  Show negotiation modal     │
├──────────────────────┼───────────────┼────────────────────────┼────────────────────────────┤
│  wallet:update       │  IN           │  { balance, txType }    │  Update balance display     │
│  wallet:balance      │  IN           │  { balance }            │  Sync across all tabs       │
├──────────────────────┼───────────────┼────────────────────────┼────────────────────────────┤
│  notification:new    │  IN           │  { title, body, action }│  In-app notification bell  │
│  disconnect          │  AUTO         │  —                      │  Auto-reconnect + fallback  │
│                      │               │                        │  to HTTP polling             │
└──────────────────────┴───────────────┴────────────────────────┴────────────────────────────┘
```

---

## 22. Backend API Routes Reference

```
┌──────────┬────────────────────────────────────────┬──────────────────────────────┬───────────┐
│  Method  │  Route                                  │  Purpose                     │  Auth     │
├──────────┼────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  POST    │  /api/auth/send-otp                      │  Send phone OTP              │  NO       │
│  POST    │  /api/auth/verify-otp                    │  Verify phone OTP            │  NO       │
│  POST    │  /api/auth/register                      │  Register customer           │  NO       │
│  POST    │  /api/auth/login                         │  Login (all methods)         │  NO       │
│  POST    │  /api/auth/refresh                        │  Refresh token               │  COOKIE   │
│  POST    │  /api/auth/magic-link                    │  Request magic link          │  NO       │
├──────────┼────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  GET     │  /api/users/profile                      │  Get own profile             │  YES      │
│  PUT     │  /api/users/profile                      │  Update profile              │  YES      │
│  GET     │  /api/users/addresses                    │  List saved addresses         │  YES      │
│  POST    │  /api/users/addresses                    │  Add new address             │  YES      │
│  PATCH   │  /api/users/addresses/:id                │  Edit address                │  YES      │
│  DELETE  │  /api/users/addresses/:id                │  Delete address              │  YES      │
├──────────┼────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  GET     │  /api/platform-config                    │  Feature flags + config      │  NO       │
│  GET     │  /api/public/zones                       │  Cities/areas dropdown       │  NO       │
│  GET     │  /api/search                             │  Universal search            │  NO       │
│  GET     │  /api/search/trending                    │  Trending search terms       │  NO       │
├──────────┼────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  GET     │  /api/mart/stores                        │  Nearby mart stores          │  NO       │
│  GET     │  /api/mart/stores/:id                    │  Store detail + products     │  NO       │
│  GET     │  /api/food/restaurants                   │  Nearby restaurants          │  NO       │
│  GET     │  /api/food/restaurants/:id               │  Restaurant menu             │  NO       │
│  GET     │  /api/pharmacy/stores                    │  Nearby pharmacies           │  NO       │
│  POST    │  /api/pharmacy/prescription              │  Upload prescription         │  YES      │
├──────────┼────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  POST    │  /api/orders/validate-cart              │  Pre-checkout validation     │  YES      │
│  GET     │  /api/orders/validate-promo             │  Validate promo code         │  YES      │
│  POST    │  /api/orders                             │  Place order                 │  YES      │
│  GET     │  /api/orders                             │  List customer orders        │  YES      │
│  GET     │  /api/orders/:id                         │  Order detail                │  YES      │
│  GET     │  /api/orders/:id/track                   │  HTTP fallback tracking      │  YES      │
│  POST    │  /api/orders/:id/cancel                  │  Cancel order                │  YES      │
│  POST    │  /api/orders/:id/rate                    │  Rate order + rider          │  YES      │
├──────────┼────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  POST    │  /api/rides                              │  Book a ride                 │  YES      │
│  GET     │  /api/rides/:id                          │  Ride status                 │  YES      │
│  POST    │  /api/rides/:id/counter-response         │  Accept/decline counter fare │  YES      │
│  POST    │  /api/rides/:id/cancel                   │  Cancel ride                 │  YES      │
│  POST    │  /api/rides/:id/rate                     │  Rate rider                  │  YES      │
│  POST    │  /api/parcel                             │  Book parcel delivery        │  YES      │
│  POST    │  /api/school-van/subscribe               │  Subscribe to van route      │  YES      │
│  POST    │  /api/van/book                           │  Book van seat               │  YES      │
├──────────┼────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  GET     │  /api/wallet                             │  Balance + transactions      │  YES      │
│  POST    │  /api/wallet/topup                       │  Submit top-up proof         │  YES      │
│  POST    │  /api/wallet/transfer                    │  Transfer to another user    │  YES      │
│  POST    │  /api/payments                           │  Init JazzCash/EasyPaisa     │  YES      │
│  GET     │  /api/payments/:id/status                │  Poll payment status         │  YES      │
├──────────┼────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  POST    │  /api/loyalty/redeem                     │  Redeem points for credit    │  YES      │
│  GET     │  /api/loyalty/history                    │  Points earn/redeem log      │  YES      │
│  POST    │  /api/verification/email/send            │  Send email OTP              │  YES      │
│  POST    │  /api/verification/email/confirm         │  Confirm email OTP           │  YES      │
└──────────┴────────────────────────────────────────┴──────────────────────────────┴───────────┘
```

---

## 23. Theme Style Guide

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
│  Framework            │  Expo Router (React Native│  PRESERVED │
│                       │  + Web)                   │            │
│  Bottom Nav           │  4 tabs — icon + label    │  PRESERVED │
├───────────────────────┼──────────────────────────┼────────────┤
│  Key Components       │  DO NOT REDESIGN          │            │
│  BannerCarousel.tsx   │  Home banners             │  ✅        │
│  FlashDeals.tsx       │  Flash deal section       │  ✅        │
│  ServiceGrid.tsx      │  Service launcher grid    │  ✅        │
│  RideBookingForm.tsx  │  Ride booking UI          │  ✅        │
│  RideTracker.tsx      │  Live ride tracking       │  ✅        │
│  BottomSheet.tsx      │  Shared bottom sheet      │  ✅        │
│  SmartRefresh.tsx     │  Pull-to-refresh          │  ✅        │
│  SkeletonBlock.tsx    │  Loading skeleton         │  ✅        │
│  CartSwitchModal      │  Multi-store cart warning │  ✅        │
│  AuthGuard.tsx        │  Route protection         │  ✅        │
│  ServiceGuard.tsx     │  Feature flag gate        │  ✅        │
│  MaintenanceScreen    │  Maintenance overlay      │  ✅        │
└───────────────────────┴──────────────────────────┴────────────┘
```

---

*End of AJKMART Customer App – Complete Logic Flow Document*
