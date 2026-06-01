# AJKMART Admin Panel – Complete Logic Flow (Visual)

> **Theme:** Dark mode with yellow/gold accents (PRESERVED — do NOT change)
> **Purpose:** Complete visual reference for every admin panel flow
> **Last Updated:** 2026-05-28

---

## Table of Contents

1. [App Launch & Auth Check](#1-app-launch--auth-check)
2. [Role-Based Access Control (RBAC)](#2-role-based-access-control-rbac)
3. [Dashboard Overview](#3-dashboard-overview)
4. [Vendor Approval & Management](#4-vendor-approval--management)
5. [Rider Approval & Oversight](#5-rider-approval--oversight)
6. [KYC Review Workflow](#6-kyc-review-workflow)
7. [Order Oversight & Fulfillment](#7-order-oversight--fulfillment)
8. [Rides & Fleet Management](#8-rides--fleet-management)
9. [User Management](#9-user-management)
10. [Finance — Transactions, Withdrawals & Deposits](#10-finance--transactions-withdrawals--deposits)
11. [Catalog — Products, Categories & Reviews](#11-catalog--products-categories--reviews)
12. [Marketing — Promotions, Flash Deals & Banners](#12-marketing--promotions-flash-deals--banners)
13. [Communications — Broadcast, SMS & Support Chat](#13-communications--broadcast-sms--support-chat)
14. [Analytics](#14-analytics)
15. [Security — Audit Logs, Roles & SOS Alerts](#15-security--audit-logs-roles--sos-alerts)
16. [Health & System Monitoring](#16-health--system-monitoring)
17. [Platform Configuration & Launch Control](#17-platform-configuration--launch-control)
18. [Socket Events Reference](#18-socket-events-reference)
19. [Backend API Routes Reference](#19-backend-api-routes-reference)
20. [Theme Style Guide](#20-theme-style-guide)

---

## 1. App Launch & Auth Check

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN PANEL LAUNCH                            │
│               React SPA — /admin base path                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│       Check sessionStorage / cookie for admin access_token       │
└─────────────────────────────────────────────────────────────────┘
                 │                             │
           TOKEN FOUND                   NO TOKEN
                 │                             │
                 ▼                             ▼
┌──────────────────────────┐     ┌──────────────────────────────┐
│  adminFetch validates     │     │     Admin Login Screen        │
│  JWT — extracts perms     │     │  • Email + Password           │
│  claim and super flag     │     │  • 2FA (if enabled)           │
└──────────────────────────┘     └──────────────────────────────┘
          │           │                        │
       VALID        INVALID                    ▼
          │           │           POST /api/admin/auth/login
          │           ▼                        │
          │    Clear token               ┌─────┴──────┐
          │    → Login Screen         SUCCESS       FAIL
          │                               │            │
          │                               ▼            ▼
          │                     Store token       "Invalid credentials"
          │                     Extract perms     or "2FA required"
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ProtectedRoute check                          │
│   • Does admin's perms claim include required permission?        │
│   • super flag = true → bypass all permission checks            │
│   • No permission → redirect to /403 Forbidden                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DASHBOARD (/dashboard)                       │
│   • Fetch platform KPIs                                          │
│   • Connect Socket.IO for real-time events                       │
│   • Load navConfig filtered by admin's permissions               │
└─────────────────────────────────────────────────────────────────┘
```

### Token Refresh Flow

```
┌─────────────────────────────────────────────────────────────────┐
│   adminFetch receives 401                                        │
│   → POST /api/admin/auth/refresh  (cookie)                       │
│       ├─ SUCCESS → retry original request                        │
│       └─ FAIL    → clear session → redirect to /admin/login      │
│                                                                  │
│   adminFetch receives 403                                        │
│   → Display "You don't have permission for this action"          │
│   → Log to audit trail                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Role-Based Access Control (RBAC)

### Permission Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   JWT Token Structure                            │
│   {                                                              │
│     sub: "admin_id",                                             │
│     role: "operations_manager",                                  │
│     perms: ["orders.view", "orders.edit", "riders.view"],        │
│     super: false                                                 │
│   }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Role → Permission Matrix

```
┌─────────────────────────────┬───────────────────────────────────────────────────────────────┐
│  Role                       │  Key Permissions                                               │
├─────────────────────────────┼───────────────────────────────────────────────────────────────┤
│  Super Admin                │  ALL  (super flag = true, bypasses all checks)                 │
├─────────────────────────────┼───────────────────────────────────────────────────────────────┤
│  Operations Manager         │  orders.view, orders.edit, fleet.rides.view,                   │
│                             │  riders.view, vendors.view                                     │
├─────────────────────────────┼───────────────────────────────────────────────────────────────┤
│  Finance Manager            │  finance.transactions.view, finance.withdrawals.view,           │
│                             │  finance.deposits.review, finance.kyc.view                     │
├─────────────────────────────┼───────────────────────────────────────────────────────────────┤
│  Content Manager            │  content.products.view, content.products.edit,                 │
│                             │  promotions.view, promotions.edit                              │
├─────────────────────────────┼───────────────────────────────────────────────────────────────┤
│  Support Agent              │  support.chat.view, support.chat.reply,                        │
│                             │  users.view, orders.view                                       │
├─────────────────────────────┼───────────────────────────────────────────────────────────────┤
│  System Admin               │  system.settings.view, system.settings.edit,                   │
│                             │  system.audit.view, system.roles.manage,                       │
│                             │  system.maintenance                                            │
└─────────────────────────────┴───────────────────────────────────────────────────────────────┘
```

### Permission Check Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Admin navigates to a route or clicks an action button           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              useHasPermission("required.permission")             │
│                                                                  │
│   1. Is super flag true?  → YES → ALLOW immediately              │
│   2. Does perms[] include required string? → YES → ALLOW         │
│   3. Neither → DENY                                              │
│        Route level  → redirect /403                              │
│        Button level → button hidden or disabled                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Dashboard Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    DASHBOARD (/dashboard)                        │
│                   Permission: dashboard.view                     │
├─────────────────────────────────────────────────────────────────┤
│  TOP KPI ROW                                                     │
│  ┌───────────┬──────────────┬─────────────┬───────────────────┐ │
│  │  Orders   │  Active      │  Revenue    │  Riders Online    │ │
│  │  Today    │  Riders      │  Today      │  (Live Counter)   │ │
│  │  🔢 184   │  🟢 42        │  💰 PKR 92K │  🏍 42            │ │
│  └───────────┴──────────────┴─────────────┴───────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  SECOND ROW                                                      │
│  ┌─────────────────┬────────────────┬───────────────────────┐   │
│  │  Pending KYC    │  Pending       │  New Vendors           │   │
│  │  Reviews        │  Withdrawals   │  (awaiting approval)   │   │
│  │  🟡 7            │  💸 3           │  🏪 2                  │   │
│  └─────────────────┴────────────────┴───────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  CHARTS                                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Revenue Trend (7d / 30d / 90d)  [Line Chart]            │   │
│  │  Orders Volume per Day           [Bar Chart]             │   │
│  │  Top Vendors by Revenue          [Horizontal Bar]        │   │
│  │  Rider Activity Heatmap          [Hour × Day grid]       │   │
│  └──────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  LIVE ACTIVITY FEED  (Socket.IO)                                 │
│  • New order placed → badge increments                           │
│  • Rider goes offline → counter decrements                       │
│  • KYC submitted → pending count increments                      │
│  • SOS alert → red banner immediately                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Vendor Approval & Management

```
┌─────────────────────────────────────────────────────────────────┐
│                   VENDORS PAGE (/vendors)                        │
│              Permission: vendors.view / vendors.edit             │
│   GET /api/vendors  (paginated, filterable by status/tier)       │
└─────────────────────────────────────────────────────────────────┘
```

### New Vendor Approval Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Vendor registers → approvalStatus = "pending"                   │
│  Dashboard badge increments                                      │
│  Admin opens Vendors → filter "Pending Approval"                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               VENDOR DETAIL PANEL                                │
│                                                                  │
│   Personal Info:  Name, Phone, Email, CNIC                       │
│   Store Info:     Name, Category, Address, Delivery Radius       │
│   Business Docs:  NTN, Tax Certificate, Business License         │
│   Registration:   Date, IP, Device                               │
└─────────────────────────────────────────────────────────────────┘
                              │
               ┌──────────────┼──────────────┐
            APPROVE        REJECT          REQUEST MORE INFO
               │              │                    │
               ▼              ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌──────────────────────┐
│ POST /api/vendor │ │ POST /api/vendor │ │ POST /api/vendor      │
│ /:id/approve     │ │ /:id/reject      │ │ /:id/request-info     │
│                  │ │ Enter reason     │ │ Specify what's needed │
│ approvalStatus   │ │ approvalStatus   │ │ Vendor notified via   │
│ = "approved"     │ │ = "rejected"     │ │ push/email            │
│ Vendor notified  │ │ Vendor notified  │ └──────────────────────┘
│ via push/email   │ │ with reason      │
└─────────────────┘ └─────────────────┘
```

### Vendor Account Controls

```
┌─────────────────────────────────────────────────────────────────┐
│   STATUS CONTROLS  (require vendors.edit permission)             │
│                                                                  │
│   [✅ Active]  →  Store visible, orders flowing normally         │
│                   PATCH /api/vendors/:id/status { active }       │
│                                                                  │
│   [⏸ Temporarily Block]  →  Store hidden, no new orders          │
│                   PATCH /api/vendors/:id/status { blocked }      │
│                   Requires: reason text                          │
│                                                                  │
│   [🚫 Permanently Ban]  →  Account disabled permanently          │
│                   PATCH /api/vendors/:id/status { banned }       │
│                   Requires: reason + confirmation checkbox       │
│                   All active orders reassigned                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│   COMMISSION OVERRIDE                                            │
│   Default: platformConfig.commissionRate (e.g. 10%)             │
│   Per-vendor: Enter custom %  → PATCH /api/vendors/:id/commission│
│   Useful for premium vendors or promotional deals               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│   VENDOR TIER ASSIGNMENT                                         │
│   ┌───────────┬──────────────────────────────────────────────┐  │
│   │  Bronze   │  Default — basic features                    │  │
│   │  Silver   │  Promoted in feed + analytics access         │  │
│   │  Gold     │  Priority dispatch + dedicated support       │  │
│   └───────────┴──────────────────────────────────────────────┘  │
│   PATCH /api/vendors/:id/tier { tier: "silver" }                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│   PILOT WHITELIST / BLACKLIST                                    │
│   Controls which delivery service zones vendor can access        │
│   POST /api/vendors/:id/pilot-access { zones: [...] }            │
└─────────────────────────────────────────────────────────────────┘
```

### Vendor Invitation System

```
┌─────────────────────────────────────────────────────────────────┐
│  [+ Invite Vendor] button                                        │
│  Enter: phone OR email                                           │
│  POST /api/vendors/invite  { contact, type }                     │
│  System sends SMS/email with registration link                   │
│  Vendor registers → auto-linked to invitation record             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Rider Approval & Oversight

```
┌─────────────────────────────────────────────────────────────────┐
│                   RIDERS PAGE (/riders)                          │
│              Permission: riders.view / riders.edit               │
│   GET /api/riders  (paginated, filterable by status/online)      │
└─────────────────────────────────────────────────────────────────┘
```

### Rider Status Controls

```
┌─────────────────────────────────────────────────────────────────┐
│   RIDER DETAIL PANEL                                             │
│   Name, Phone, CNIC, Vehicle Type, Plate, License                │
│   AJK-ID, Zone, Rating, Rides Completed                          │
│   Performance: Cancels | Ignores | Avg Rating  (auto-counters)   │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼───────────────────────┐
        │                     │                       │
        ▼                     ▼                       ▼
┌──────────────┐   ┌───────────────────┐   ┌──────────────────────┐
│  APPROVE     │   │  RESTRICT         │   │  SUSPEND / BAN        │
│              │   │                   │   │                       │
│ approvalStatus   │ PATCH /api/riders  │   │ PATCH /api/riders     │
│ = "approved" │   │ /:id/restrict     │   │ /:id/suspend          │
│              │   │ { restricted:true}│   │ { banned: true,       │
│ Rider can    │   │                   │   │   reason: "..." }     │
│ accept all   │   │ Rider excluded    │   │ All rides cancelled    │
│ order types  │   │ from high-value   │   │ Rider notified         │
└──────────────┘   │ orders            │   └──────────────────────┘
                   └───────────────────┘
```

### Remote Online Control (Super Admin Only)

```
┌─────────────────────────────────────────────────────────────────┐
│  Super Admin can force a rider ONLINE or OFFLINE remotely        │
│                                                                  │
│  [Force Online]  → emit admin:force_online { riderId }           │
│  [Force Offline] → emit admin:force_offline { riderId }          │
│                                                                  │
│  Use case: rider's app crashed but GPS still pinging             │
└─────────────────────────────────────────────────────────────────┘
```

### Penalty System

```
┌─────────────────────────────────────────────────────────────────┐
│  Admin clicks [Apply Penalty] on rider profile                   │
│                                                                  │
│  PENALTY FORM:                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Type:     Late Delivery / Customer Complaint /            │  │
│  │            Cancellation / Misconduct / Other               │  │
│  │  Amount:   PKR ___  (deducted from wallet)                 │  │
│  │  Reason:   ___________________________________             │  │
│  │  Reference: Order # (optional)                             │  │
│  └───────────────────────────────────────────────────────────┘  │
│  POST /api/riders/penalty                                        │
│  { riderId, type, amount, reason, orderId? }                     │
│                                                                  │
│  → Amount deducted from rider wallet                             │
│  → Penalty logged in audit trail                                 │
│  → Rider notified via push notification                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. KYC Review Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    KYC PAGE (/kyc)                               │
│              Permission: finance.kyc.view                        │
│   GET /api/kyc/admin  (filter: pending / approved / rejected)    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│   KYC QUEUE  (sorted by submission date, oldest first)           │
│   ┌───────────────────────────────────────────────────────────┐ │
│   │  🟡 Ali Hassan    •  Rider   •  Submitted 2h ago           │ │
│   │  🟡 Khan Mart     •  Vendor  •  Submitted 5h ago           │ │
│   │  🟡 Sara Pharmacy •  Vendor  •  Submitted 1d ago           │ │
│   └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                   Admin opens a KYC record
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     KYC REVIEW PANEL                             │
│                                                                  │
│   DOCUMENT VIEWER  (integrated image lightbox)                   │
│   ┌─────────────────────┬─────────────────────────────────────┐ │
│   │  CNIC Front         │  CNIC Back                          │ │
│   │  [Zoom] [Rotate]    │  [Zoom] [Rotate]                    │ │
│   └─────────────────────┴─────────────────────────────────────┘ │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  Driving License / Business License                      │   │
│   │  [Zoom] [Rotate]  [Side-by-side compare]                 │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   APPLICANT INFO  (cross-check panel)                            │
│   Name on docs vs. registered name                               │
│   CNIC number on doc vs. entered CNIC                            │
│   Date of birth  •  Expiry dates                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
               ┌──────────────┴──────────────┐
           APPROVE                        REJECT
               │                              │
               ▼                              ▼
┌──────────────────────────┐  ┌───────────────────────────────────┐
│  Optional: Add note       │  │  REJECTION WORKFLOW (3 steps)     │
│  POST /api/kyc/admin/:id  │  │                                   │
│  /approve                 │  │  STEP 1 — Tag failing documents:  │
│  { notes: "..." }         │  │  ☑ cnic_front   ☑ cnic_back      │
│                           │  │  ☑ license      ☑ selfie         │
│  kycStatus = "approved"   │  │                                   │
│  documentsApproved = true │  │  STEP 2 — Quick reason selection: │
│  User notified:           │  │  (suggestions based on tags)      │
│  push + SMS + email       │  │  • "Image is blurry"              │
└──────────────────────────┘  │  • "Corners cut off"               │
                              │  • "Name does not match"           │
                              │  • "Document expired"              │
                              │  • Write custom reason             │
                              │                                    │
                              │  STEP 3 — Composite message:       │
                              │  Auto-generated from above         │
                              │  Edit if needed → [Send Rejection] │
                              │                                    │
                              │  POST /api/kyc/admin/:id/reject    │
                              │  { tags, reason, message }         │
                              │                                    │
                              │  kycStatus = "rejected"            │
                              │  Notification: push + SMS + email  │
                              │  Vendor/rider sees reason in app   │
                              └───────────────────────────────────┘

KYC Status Lifecycle:
┌──────────┐    submit     ┌──────────┐   admin    ┌──────────────┐
│   none   │  ──────────▶  │ pending  │  ────────▶  │  approved    │
└──────────┘               └──────────┘             └──────────────┘
                                 │        reject          │
                                 ▼      ──────────▶  ┌──────────────┐
                           resubmit ◀──              │  rejected    │
                           allowed                   └──────────────┘
```

---

## 7. Order Oversight & Fulfillment

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORDERS PAGE (/orders)                         │
│              Permission: orders.view / orders.edit               │
│   GET /api/orders/enriched  (real-time, paginated)               │
└─────────────────────────────────────────────────────────────────┘

FILTER BAR:
┌─────────────────────────────────────────────────────────────────┐
│  Status: [All] [Pending] [Confirmed] [Preparing] [Ready]         │
│          [In Transit] [Delivered] [Cancelled]                    │
│  Date Range: ___  to  ___                                        │
│  Vendor: [dropdown]   Rider: [dropdown]   Zone: [dropdown]       │
└─────────────────────────────────────────────────────────────────┘

ORDER CARD (Socket.IO — updates live):
┌─────────────────────────────────────────────────────────────────┐
│  Order #1042  •  AJK Mart  •  2026-05-28 14:33                  │
│  Customer: Ali K.  •  Zone: F-7 Islamabad                        │
│  Items: 3  •  Total: PKR 680  •  Commission: PKR 68              │
│  Status: 🟡 Preparing   Rider: Hassan M. (🏍 ETA 8 min)          │
│                                                                  │
│  [👁 View Details]  [✏ Override Status]  [🔄 Reassign Rider]     │
│  [💸 Issue Refund]  [🖨 Print Label]                             │
└─────────────────────────────────────────────────────────────────┘
```

### Manual Status Override

```
┌─────────────────────────────────────────────────────────────────┐
│  Admin clicks [✏ Override Status]                               │
│                                                                  │
│  Current: Preparing  →  Force to: [dropdown]                     │
│  • confirmed  • preparing  • ready  • in_transit  • delivered    │
│  • cancelled                                                     │
│                                                                  │
│  PATCH /api/orders/:id/status { status, adminNote }             │
│  → Action logged in audit trail with admin name + reason         │
│  → Customer + vendor + rider notified of forced change           │
└─────────────────────────────────────────────────────────────────┘
```

### Refund System

```
┌─────────────────────────────────────────────────────────────────┐
│  Admin clicks [💸 Issue Refund]                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  REFUND FORM                                                     │
│                                                                  │
│  Order Total: PKR 680                                            │
│                                                                  │
│  Type:   ○ Full Refund (PKR 680)                                 │
│          ○ Partial Refund  →  Enter amount: PKR ___              │
│  Reason: _______________________________________________         │
│  Credit to: Customer Wallet  (automatic)                         │
│                                                                  │
│  POST /api/orders/refund                                         │
│  { orderId, type, amount, reason }                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Amount credited to customer wallet                              │
│  Vendor wallet debited by refund amount                          │
│  Transaction logged as type = "refund"                           │
│  Audit trail updated                                             │
└─────────────────────────────────────────────────────────────────┘
```

### Bulk Actions

```
┌─────────────────────────────────────────────────────────────────┐
│  Select multiple orders → Bulk toolbar appears                   │
│                                                                  │
│  [✅ Bulk Mark Delivered]  →  PATCH /api/orders/bulk-status      │
│                               { status: "delivered", ids: [...] }│
│  [🖨 Print Bulk Labels]   →  PDF generation                      │
└─────────────────────────────────────────────────────────────────┘
```

### Manual Rider Assignment

```
┌─────────────────────────────────────────────────────────────────┐
│  Admin clicks [🔄 Reassign Rider]                                │
│  GET /api/riders/available?lat=&lng=  (proximity sorted)         │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🏍 Hassan M.   •  0.8 km away  •  Rating 4.9  •  ● Online │  │
│  │  🏍 Tariq A.    •  1.2 km away  •  Rating 4.7  •  ● Online │  │
│  │  🏍 Bilal K.    •  2.1 km away  •  Rating 4.5  •  ● Online │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Select rider → POST /api/orders/:id/assign-rider { riderId }    │
│  Rider receives push notification + socket event                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Rides & Fleet Management

```
┌─────────────────────────────────────────────────────────────────┐
│               FLEET PAGES                                        │
│   /rides       — Bike/Car ride-hailing oversight                 │
│   /van         — Van/pool service management                     │
│   /parcel      — Parcel delivery tracking                        │
│   /pharmacy    — Pharmacy delivery oversight                     │
│   Permission: fleet.rides.view                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Live Riders Map (`/live-riders-map`)

```
┌─────────────────────────────────────────────────────────────────┐
│                    LIVE RIDERS MAP                               │
│   Permission: fleet.rides.view                                   │
│                                                                  │
│   Real-time Leaflet map showing all online riders                │
│   Socket event: rider:location → pin moves on map                │
│                                                                  │
│   MAP PINS:                                                      │
│   🟢 Green pin  →  Online, no active ride                        │
│   🟡 Yellow pin →  En route to pickup                            │
│   🔴 Red pin    →  Active ride in progress                        │
│                                                                  │
│   Click any pin → Rider info popup:                              │
│   Name, Rating, Vehicle, Current Order, Battery level            │
│   [Force Offline]  [View Profile]  [Assign Order]               │
└─────────────────────────────────────────────────────────────────┘
```

### Ride Oversight (`/rides`)

```
┌─────────────────────────────────────────────────────────────────┐
│  All ride-hailing requests and their status                      │
│  Filters: status / rider / zone / date                           │
│                                                                  │
│  RIDE CARD:                                                      │
│  Ride #R421  •  Bike  •  Hassan M.  →  Customer Ali K.           │
│  Pickup: Blue Area  •  Drop: G-11   •  Fare: PKR 250             │
│  Status: 🟢 In Progress  •  Duration: 14 min                     │
│  [View on Map]  [Force Complete]  [Cancel with Refund]           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. User Management

```
┌─────────────────────────────────────────────────────────────────┐
│                    USERS PAGE (/users)                           │
│              Permission: users.view / users.edit                 │
│   GET /api/users  (paginated, search by name/phone/email)        │
└─────────────────────────────────────────────────────────────────┘

USER DETAIL PANEL:
┌─────────────────────────────────────────────────────────────────┐
│  Name: Ali Khan       Phone: 0300-1234567     AJK-ID: AJK-XYZ   │
│  Email: ali@email.com  Joined: 2025-12-01     Role: customer     │
│                                                                  │
│  TABS:                                                           │
│  [Orders]  [Wallet]  [Reviews]  [Complaints]  [Login History]    │
└─────────────────────────────────────────────────────────────────┘

ACCOUNT CONTROLS:
┌─────────────────────────────────────────────────────────────────┐
│  [✅ Active]  →  Normal account                                  │
│  [⏸ Suspend]  →  Temporary block (enter reason + duration)       │
│                  PATCH /api/users/:id/status { suspended }       │
│  [🚫 Ban]     →  Permanent ban (enter reason + confirmation)     │
│                  PATCH /api/users/:id/status { banned }          │
│  [💰 Adjust Wallet]  →  Manual credit/debit                      │
│                  POST /api/users/:id/wallet-adjust               │
│                  { amount, type: "credit"/"debit", reason }      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Finance — Transactions, Withdrawals & Deposits

### Transactions (`/transactions`)

```
┌─────────────────────────────────────────────────────────────────┐
│              TRANSACTIONS PAGE  (/transactions)                  │
│              Permission: finance.transactions.view               │
│   GET /api/transactions  (paginated, filter by type/date/user)   │
│                                                                  │
│  FILTER: [All] [Order Credits] [Withdrawals] [Refunds]           │
│          [Bonuses] [Penalties] [Deposits] [Adjustments]          │
│                                                                  │
│  TRANSACTION ROW:                                                │
│  2026-05-28 14:33  •  Order #1042  •  Vendor: Ali Mart           │
│  Type: order_credit  •  Amount: +PKR 612  •  Commission: PKR 68  │
│  Balance after: PKR 13,012                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Withdrawal Requests (`/withdrawals`)

```
┌─────────────────────────────────────────────────────────────────┐
│              WITHDRAWALS PAGE  (/withdrawals)                    │
│              Permission: finance.withdrawals.view                │
│   GET /api/withdrawals  (filter: pending / approved / rejected)  │
└─────────────────────────────────────────────────────────────────┘
                              │
                  Admin opens a pending withdrawal
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│   WITHDRAWAL DETAIL                                              │
│   Vendor/Rider: Ali Hassan                                       │
│   Amount: PKR 5,000                                              │
│   Method: JazzCash  →  Account: 0301-1234567                     │
│   Available Balance: PKR 12,400                                  │
│   Requested: 2026-05-28 10:00                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                 ┌────────────┴────────────┐
              APPROVE                   REJECT
                 │                         │
                 ▼                         ▼
  POST /api/withdrawals/:id/approve   POST /api/withdrawals/:id/reject
  Mark as paid + enter                { reason }
  transaction reference               Amount returned to wallet
  Amount deducted from wallet         User notified with reason
  User notified via push/SMS
```

### Deposit Requests (`/deposit-requests`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Vendor/Rider submits bank transfer proof                        │
│  Admin sees deposit request:                                     │
│                                                                  │
│  Vendor: Ali Mart  •  Amount: PKR 10,000  •  Bank: HBL           │
│  Receipt: [View Image]  •  Submitted: 2026-05-28 09:15           │
│                                                                  │
│  [✅ Confirm Deposit]  →  POST /api/deposits/:id/confirm         │
│                           Amount credited to vendor wallet        │
│  [❌ Reject]           →  POST /api/deposits/:id/reject           │
│                           { reason }  →  Vendor notified         │
└─────────────────────────────────────────────────────────────────┘
```

### Loyalty Program (`/loyalty`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Manage customer loyalty points                                  │
│  • View points balance per user                                  │
│  • Manual award / revoke points                                  │
│  • Configure points-per-PKR exchange rate                        │
│  • View redemption history                                       │
│  POST /api/loyalty/adjust { userId, points, reason }             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Catalog — Products, Categories & Reviews

### Products (`/products`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Permission: content.products.view / content.products.edit       │
│  GET /api/products  (all vendors, paginated)                     │
│                                                                  │
│  CONTROLS:                                                       │
│  • Toggle product active/inactive globally                        │
│  • Override vendor price (platform pricing)                      │
│  • Flag product for review                                       │
│  • Delete product (with reason)                                  │
│  PATCH /api/products/:id/status                                  │
│  PATCH /api/products/:id/price-override                          │
└─────────────────────────────────────────────────────────────────┘
```

### Categories (`/categories`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Manage product taxonomy:                                        │
│  Mart → [Beverages, Snacks, Dairy, Household, ...]               │
│  Food → [Biryani, Pizza, Burgers, Desi, ...]                     │
│  Pharmacy → [OTC Medicines, Vitamins, Baby Care, ...]            │
│                                                                  │
│  CRUD on categories:                                             │
│  POST /api/categories   •   PATCH /api/categories/:id            │
│  DELETE /api/categories/:id  (blocks if products exist)          │
└─────────────────────────────────────────────────────────────────┘
```

### Reviews Moderation (`/reviews`)

```
┌─────────────────────────────────────────────────────────────────┐
│  View all customer reviews across all vendors                    │
│  Filter: flagged / low rating / recent                           │
│                                                                  │
│  REVIEW CONTROLS:                                                │
│  [✅ Approve]  →  Review visible on vendor page                  │
│  [🚩 Flag]    →  Vendor warned, review hidden pending review     │
│  [🗑 Delete]  →  Remove (enter reason, logged in audit)          │
│  PATCH /api/reviews/:id/moderate { action, reason }              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Marketing — Promotions, Flash Deals & Banners

```
┌─────────────────────────────────────────────────────────────────┐
│  Permission: promotions.view / promotions.edit                   │
└─────────────────────────────────────────────────────────────────┘
```

### Promotions & Promo Codes (`/promotions`, `/promo-codes`)

```
┌─────────────────────────────────────────────────────────────────┐
│  CREATE PLATFORM-WIDE PROMO CODE                                 │
│  (Admin-created codes apply across all vendors)                  │
│                                                                  │
│  Code: AJKEID30  •  Discount: 30%  •  Min Order: PKR 500         │
│  Max Uses: 500   •  Expiry: 2026-06-15                           │
│  Applies to: [All] / [Specific Category] / [Specific Vendor]     │
│  POST /api/promo-codes                                           │
│                                                                  │
│  VIEW ALL CODES:  Active / Expired / Depleted                    │
│  Metrics per code: Uses / Revenue Generated / Avg Order Value    │
└─────────────────────────────────────────────────────────────────┘
```

### Flash Deals (`/flash-deals`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Time-limited spotlight deals shown at top of customer feed       │
│                                                                  │
│  CREATE FLASH DEAL:                                              │
│  Product: Mineral Water 1.5L  •  Vendor: Ali Mart                │
│  Original Price: PKR 80  →  Deal Price: PKR 55                   │
│  Start: 2026-05-28 18:00  •  End: 2026-05-28 21:00              │
│  Stock Limit: 100 units                                          │
│  POST /api/flash-deals                                           │
└─────────────────────────────────────────────────────────────────┘
```

### Banners & Popups (`/banners`, `/popups`)

```
┌─────────────────────────────────────────────────────────────────┐
│  BANNERS — Homepage/category carousel images                     │
│  Upload image + set link + set display order                     │
│  Toggle active/inactive                                          │
│  POST /api/banners  { image, link, order, active }               │
│                                                                  │
│  POPUPS — Modal shown on customer app open                       │
│  Upload image/text + set frequency (once / daily / every open)   │
│  Set start/end date for campaign                                 │
│  POST /api/popups  { content, frequency, startDate, endDate }    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 13. Communications — Broadcast, SMS & Support Chat

### Broadcast (`/communications`)

```
┌─────────────────────────────────────────────────────────────────┐
│              COMMUNICATIONS  (/communications)                   │
│              Permission: support.broadcast.send                  │
│                                                                  │
│  TABS:  [Broadcast]  [Message Log]  [SMS Gateways]               │
└─────────────────────────────────────────────────────────────────┘

BROADCAST TAB:
┌─────────────────────────────────────────────────────────────────┐
│  Target:   ○ All Users   ○ All Riders   ○ All Vendors            │
│            ○ Specific Zone   ○ Specific Segment                  │
│                                                                  │
│  Channel:  ☑ Push Notification   ☑ In-app   ☑ SMS               │
│                                                                  │
│  Title:    _______________________________________________       │
│  Message:  _______________________________________________       │
│            _______________________________________________       │
│                                                                  │
│  Schedule: ○ Send Now  ○ Schedule for: [datetime picker]         │
│                                                                  │
│  [Preview]  →  [Send Broadcast]                                  │
│  POST /api/communications/broadcast                              │
│  { target, channels, title, message, scheduledAt? }              │
└─────────────────────────────────────────────────────────────────┘

MESSAGE LOG TAB:
  All sent broadcasts with delivery stats (sent / delivered / read)

SMS GATEWAYS TAB:
  Configure active SMS provider (Twilio / local gateway)
  Test gateway  •  View SMS delivery logs
```

### Support Chat (`/support-chat`)

```
┌─────────────────────────────────────────────────────────────────┐
│              SUPPORT CHAT  (/support-chat)                       │
│              Permission: support.chat.view                       │
│                                                                  │
│  THREAD LIST (Socket.IO — new threads appear in real-time)       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🔴 Ali K.   •  Customer  •  "My order hasn't arrived"  5m │  │
│  │  🟡 Hassan M. •  Rider    •  "App crash issue"          1h  │  │
│  │  ⚪ Ali Mart  •  Vendor   •  "Commission dispute"        2h  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  CHAT PANEL:                                                     │
│  Full message history  •  Order context card                     │
│  [Reply]  [Resolve]  [Escalate]  [Attach Order]                  │
│  POST /api/support-chat/reply { threadId, message }              │
│  POST /api/support-chat/resolve { threadId }                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 14. Analytics

```
┌─────────────────────────────────────────────────────────────────┐
│  Permission: finance.transactions.view / system.settings.view    │
└─────────────────────────────────────────────────────────────────┘
```

### Revenue Analytics (`/analytics`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Date Range: [Today] [7d] [30d] [90d] [Custom]                   │
│  Compare to: Previous period toggle                              │
│                                                                  │
│  CHARTS:                                                         │
│  • Gross Revenue vs Net Revenue (line)                           │
│  • Platform Commission earned (bar)                              │
│  • Revenue by category: Mart / Food / Rides / Pharmacy           │
│  • Revenue by zone/city                                          │
│  • Top 10 vendors by revenue                                     │
│  • Top 10 riders by earnings                                     │
│  • Avg order value trend                                         │
│  • Customer LTV distribution                                     │
│                                                                  │
│  GET /api/analytics?from=&to=&breakdown=category                 │
└─────────────────────────────────────────────────────────────────┘
```

### Search Analytics (`/search-analytics`)

```
┌─────────────────────────────────────────────────────────────────┐
│  • Top searched terms (with result counts)                       │
│  • Failed searches (no results returned)                         │
│  • Search → Order conversion rate                                │
│  • Search volume trend                                           │
│                                                                  │
│  Use case: Add products / categories for failed search terms     │
│  GET /api/analytics/search                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Wishlist Insights (`/wishlist-insights`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Products most wishlisted but not yet ordered                    │
│  Indicates demand gaps in inventory                              │
│  GET /api/analytics/wishlist                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 15. Security — Audit Logs, Roles & SOS Alerts

### Audit Logs (`/audit-logs`)

```
┌─────────────────────────────────────────────────────────────────┐
│              Permission: system.audit.view                       │
│   Every admin action is logged automatically                     │
│                                                                  │
│  LOG ENTRY FORMAT:                                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  2026-05-28 14:35  •  Admin: Usman (Super Admin)           │  │
│  │  Action: vendor.approved                                   │  │
│  │  Target: Vendor #V042 (Ali Mart)                           │  │
│  │  IP: 192.168.1.x  •  Session: abc123                       │  │
│  │  Notes: "Documents verified, CNIC matches"                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  FILTER: by admin / by action type / by date / by target         │
│  EXPORT: CSV / PDF                                               │
│  GET /api/audit-logs  (immutable — no delete, no edit)           │
└─────────────────────────────────────────────────────────────────┘
```

### Roles & Permissions (`/roles-permissions`)

```
┌─────────────────────────────────────────────────────────────────┐
│              Permission: system.roles.manage                     │
│                                                                  │
│  ROLE LIST:                                                      │
│  Super Admin  •  Operations Manager  •  Finance Manager          │
│  Content Manager  •  Support Agent  •  System Admin              │
│                                                                  │
│  [+ Create Role]  →  Name + select permissions from full list    │
│  POST /api/roles { name, permissions: [...] }                    │
│                                                                  │
│  ASSIGN ROLE TO ADMIN:                                           │
│  PATCH /api/admins/:id/role { roleId }                           │
│                                                                  │
│  PERMISSION LIST (examples):                                     │
│  dashboard.view  •  orders.view  •  orders.edit                  │
│  vendors.view  •  vendors.edit  •  riders.view  •  riders.edit   │
│  finance.kyc.view  •  finance.transactions.view                  │
│  finance.withdrawals.view  •  finance.deposits.review            │
│  content.products.view  •  content.products.edit                 │
│  promotions.view  •  promotions.edit                             │
│  support.broadcast.send  •  support.chat.view                    │
│  system.settings.view  •  system.settings.edit                   │
│  system.audit.view  •  system.roles.manage                       │
│  system.maintenance                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Consent Log (`/consent-log`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Records when users accepted T&C / Privacy Policy                │
│  Timestamped + IP + version of policy accepted                   │
│  Required for GDPR/PDPA compliance                               │
└─────────────────────────────────────────────────────────────────┘
```

### SOS Alerts (`/sos-alerts`)

```
┌─────────────────────────────────────────────────────────────────┐
│              SOS ALERTS  (/sos-alerts)                           │
│  Real-time — Socket.IO fires red banner on new SOS               │
│                                                                  │
│  SOS CARD:                                                       │
│  🚨 Rider Hassan M.  •  2026-05-28 15:42                         │
│  Location: 33.7215, 73.0433  [View on Map]                       │
│  Order: #1044  •  Customer: Ali K.                               │
│                                                                  │
│  [📞 Call Rider]  [📞 Call Customer]  [Dispatch Support]         │
│  [✅ Mark Resolved]  →  PATCH /api/sos/:id/resolve               │
│                         { notes, resolvedBy }                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 16. Health & System Monitoring

### Health Dashboard (`/health-dashboard`)

```
┌─────────────────────────────────────────────────────────────────┐
│              Permission: system.settings.view                    │
│                                                                  │
│  SERVICE STATUS:                                                 │
│  ┌──────────────────┬──────────────────┬─────────────────────┐  │
│  │  API Server       │  Database         │  Redis Cache        │  │
│  │  ✅ 99.9% uptime  │  ✅ Healthy        │  ✅ Healthy         │  │
│  └──────────────────┴──────────────────┴─────────────────────┘  │
│  ┌──────────────────┬──────────────────┬─────────────────────┐  │
│  │  Socket.IO        │  SMS Gateway      │  Push Service       │  │
│  │  ✅ 42 connected  │  🟡 Degraded       │  ✅ Healthy         │  │
│  └──────────────────┴──────────────────┴─────────────────────┘  │
│                                                                  │
│  PERFORMANCE METRICS:                                            │
│  • API response time (p50 / p95 / p99)                           │
│  • DB query time trend                                           │
│  • Socket connection count over time                             │
│  • Error rate (4xx / 5xx) per minute                             │
│                                                                  │
│  GET /api/health  (polling every 30s)                            │
└─────────────────────────────────────────────────────────────────┘
```

### Error Monitor (`/error-monitor`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Recent 5xx errors grouped by endpoint                           │
│  • Error message + stack trace                                   │
│  • Count per hour / per day                                      │
│  • Affected users / orders                                       │
│  GET /api/error-logs                                             │
└─────────────────────────────────────────────────────────────────┘
```

### Chat Monitor (`/chat-monitor`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Admin can observe all support chat threads in read-only mode    │
│  Filter: open / escalated / high-priority                        │
│  Metrics: avg response time / open ticket count / resolved today │
└─────────────────────────────────────────────────────────────────┘
```

---

## 17. Platform Configuration & Launch Control

### Settings (`/settings`)

```
┌─────────────────────────────────────────────────────────────────┐
│              Permission: system.settings.edit                    │
│                                                                  │
│  GENERAL SETTINGS                                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  App Name          Platform Commission (%)               │    │
│  │  Min Withdrawal    Withdrawal Processing Days            │    │
│  │  Auto-Settle Delay (hours after delivery)               │    │
│  │  Default Currency  Default Language                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  PAYMENT SETTINGS                                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  EasyPaisa Integration   [Enable/Disable + Credentials]  │    │
│  │  JazzCash Integration    [Enable/Disable + Credentials]  │    │
│  │  Bank Transfer           [Enable/Disable + Bank Details] │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  SYSTEM SETTINGS                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  App Status:  ○ Active  ○ Limited  ○ Maintenance         │    │
│  │  Announcement Bar Text (shown when status = "limited")   │    │
│  │  Maintenance Message                                     │    │
│  │  Maintenance End Time                                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  SMS GATEWAYS                                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Primary Gateway: [Twilio / Local / Zong / Jazz]         │    │
│  │  Fallback Gateway: ___                                   │    │
│  │  [Test SMS] → send test to admin phone                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  PATCH /api/platform-config  { key: value, ... }                 │
└─────────────────────────────────────────────────────────────────┘
```

### App Management (`/app-management`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Control which features are enabled per app                      │
│                                                                  │
│  RIDER APP MODULES:                                              │
│  wallet ☑  earnings ☑  history ☑  gpsTracking ☑  chat ☑        │
│  mart ☑  food ☑  rides ☑  van ☑  sos ☑  reviews ☑              │
│                                                                  │
│  VENDOR APP MODULES:                                             │
│  wallet ☑  analytics ☑  promotions ☑  campaigns ☑               │
│  reviews ☑  chat ☑  bulkUpload ☑                                │
│                                                                  │
│  CUSTOMER APP MODULES:                                           │
│  mart ☑  food ☑  rides ☑  pharmacy ☑  parcel ☑                 │
│  loyalty ☑  referral ☑  wishlist ☑                              │
│                                                                  │
│  PATCH /api/platform-config/modules { moduleKey: bool }          │
└─────────────────────────────────────────────────────────────────┘
```

### Auth Methods (`/auth-methods`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Toggle which login methods are active:                          │
│  Phone + OTP  ☑    Email + OTP  ☑    Username + Password  ☑     │
│  Google SSO   ☑    Facebook SSO ☑    Magic Link  ☑              │
│  Biometric    ☑                                                  │
│                                                                  │
│  PATCH /api/platform-config/auth-methods                         │
└─────────────────────────────────────────────────────────────────┘
```

### Launch Control (`/launch-control`)

```
┌─────────────────────────────────────────────────────────────────┐
│              Permission: system.maintenance                      │
│                                                                  │
│  PRE-FLIGHT CHECKLIST  (before going live or after maintenance)  │
│                                                                  │
│  ✅  Database connection                                          │
│  ✅  Redis connection                                             │
│  ✅  SMS gateway test                                             │
│  ✅  Push notification test                                       │
│  ✅  Payment gateway test                                         │
│  ✅  Socket.IO test                                               │
│  🔄  Environment variables check                                  │
│                                                                  │
│  All green → [🚀 Launch / Bring Online]                          │
│              PATCH /api/platform-config { appStatus: "active" }  │
│                                                                  │
│  Any red    → Cannot launch until resolved                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 18. Socket Events Reference

```
┌──────────────────────┬───────────────┬────────────────────────┬───────────────────────────┐
│  Event Name          │  Direction    │  Payload               │  Action                    │
├──────────────────────┼───────────────┼────────────────────────┼───────────────────────────┤
│  connect             │  OUT          │  { adminToken }         │  Join admin room           │
├──────────────────────┼───────────────┼────────────────────────┼───────────────────────────┤
│  order:status        │  IN           │  { orderId, status,     │  Update order card live    │
│                      │               │    vendorId }           │  Badge counts update       │
│  order:new           │  IN           │  { orderId, vendorId }  │  Dashboard badge increment │
├──────────────────────┼───────────────┼────────────────────────┼───────────────────────────┤
│  rider:location      │  IN           │  { riderId, lat, lng }  │  Move pin on live map      │
│  rider:online        │  IN           │  { riderId }            │  Increment online counter  │
│  rider:offline       │  IN           │  { riderId }            │  Decrement online counter  │
├──────────────────────┼───────────────┼────────────────────────┼───────────────────────────┤
│  kyc:submitted       │  IN           │  { userId, type }       │  Increment KYC badge       │
│  kyc:approved        │  OUT          │  { userId }             │  Notify user               │
│  kyc:rejected        │  OUT          │  { userId, reason }     │  Notify user               │
├──────────────────────┼───────────────┼────────────────────────┼───────────────────────────┤
│  sos:alert           │  IN           │  { riderId, lat, lng,   │  Show red banner           │
│                      │               │    orderId }            │  Play alert sound          │
│                      │               │                        │  Increment SOS badge        │
├──────────────────────┼───────────────┼────────────────────────┼───────────────────────────┤
│  admin:force_online  │  OUT          │  { riderId }            │  Force rider online        │
│  admin:force_offline │  OUT          │  { riderId }            │  Force rider offline       │
├──────────────────────┼───────────────┼────────────────────────┼───────────────────────────┤
│  notification:new    │  IN           │  { title, body }        │  Admin notification bell   │
│  disconnect          │  AUTO         │  —                      │  Auto-reconnect            │
└──────────────────────┴───────────────┴────────────────────────┴───────────────────────────┘
```

---

## 19. Backend API Routes Reference

```
┌──────────┬────────────────────────────────────────────┬──────────────────────────────┬───────────┐
│  Method  │  Route                                      │  Purpose                     │  Perm     │
├──────────┼────────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  POST    │  /api/admin/auth/login                       │  Admin login                 │  NO       │
│  POST    │  /api/admin/auth/refresh                     │  Refresh admin token         │  COOKIE   │
│  GET     │  /api/admins                                 │  List admin accounts         │  roles    │
│  POST    │  /api/admins                                 │  Create admin account        │  roles    │
│  PATCH   │  /api/admins/:id/role                        │  Assign role to admin        │  roles    │
│  GET     │  /api/roles                                  │  List all roles              │  roles    │
│  POST    │  /api/roles                                  │  Create role                 │  roles    │
│  PATCH   │  /api/roles/:id                              │  Edit role permissions       │  roles    │
├──────────┼────────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  GET     │  /api/vendors                                │  List all vendors            │  vendors  │
│  POST    │  /api/vendors/invite                         │  Invite vendor               │  vendors  │
│  POST    │  /api/vendors/:id/approve                    │  Approve vendor              │  vendors  │
│  POST    │  /api/vendors/:id/reject                     │  Reject vendor               │  vendors  │
│  PATCH   │  /api/vendors/:id/status                     │  Block/ban vendor            │  vendors  │
│  PATCH   │  /api/vendors/:id/commission                 │  Override commission         │  vendors  │
│  PATCH   │  /api/vendors/:id/tier                       │  Set vendor tier             │  vendors  │
│  POST    │  /api/vendors/:id/pilot-access               │  Set zone access             │  vendors  │
├──────────┼────────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  GET     │  /api/riders                                 │  List all riders             │  riders   │
│  PATCH   │  /api/riders/:id/status                      │  Approve/suspend/ban rider   │  riders   │
│  PATCH   │  /api/riders/:id/restrict                    │  Restrict order types        │  riders   │
│  POST    │  /api/riders/penalty                         │  Apply rider penalty         │  riders   │
│  GET     │  /api/riders/available                       │  Available riders (by GPS)   │  orders   │
├──────────┼────────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  GET     │  /api/kyc/admin                              │  KYC queue                   │  kyc      │
│  POST    │  /api/kyc/admin/:id/approve                  │  Approve KYC                 │  kyc      │
│  POST    │  /api/kyc/admin/:id/reject                   │  Reject KYC (3-step)         │  kyc      │
├──────────┼────────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  GET     │  /api/orders/enriched                        │  Orders with full context    │  orders   │
│  PATCH   │  /api/orders/:id/status                      │  Override order status       │  orders   │
│  PATCH   │  /api/orders/bulk-status                     │  Bulk status update          │  orders   │
│  POST    │  /api/orders/refund                          │  Issue refund                │  orders   │
│  POST    │  /api/orders/:id/assign-rider                │  Manually assign rider       │  orders   │
├──────────┼────────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  GET     │  /api/users                                  │  List all users              │  users    │
│  PATCH   │  /api/users/:id/status                       │  Suspend/ban user            │  users    │
│  POST    │  /api/users/:id/wallet-adjust                │  Manual wallet credit/debit  │  finance  │
├──────────┼────────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  GET     │  /api/transactions                           │  All transactions            │  finance  │
│  GET     │  /api/withdrawals                            │  Withdrawal requests         │  finance  │
│  POST    │  /api/withdrawals/:id/approve                │  Approve withdrawal          │  finance  │
│  POST    │  /api/withdrawals/:id/reject                 │  Reject withdrawal           │  finance  │
│  GET     │  /api/deposits                               │  Deposit requests            │  finance  │
│  POST    │  /api/deposits/:id/confirm                   │  Confirm deposit             │  finance  │
│  POST    │  /api/deposits/:id/reject                    │  Reject deposit              │  finance  │
│  POST    │  /api/loyalty/adjust                         │  Adjust loyalty points       │  finance  │
├──────────┼────────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  GET     │  /api/products                               │  All products (admin view)   │  content  │
│  PATCH   │  /api/products/:id/status                    │  Toggle product active       │  content  │
│  PATCH   │  /api/products/:id/price-override            │  Override price              │  content  │
│  GET/POST│  /api/categories                             │  Category CRUD               │  content  │
│  PATCH   │  /api/reviews/:id/moderate                   │  Moderate review             │  content  │
│  POST    │  /api/promo-codes                            │  Create platform promo       │  promo    │
│  POST    │  /api/flash-deals                            │  Create flash deal           │  promo    │
│  POST    │  /api/banners                                │  Create banner               │  promo    │
│  POST    │  /api/popups                                 │  Create popup                │  promo    │
├──────────┼────────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  POST    │  /api/communications/broadcast               │  Send broadcast message      │  support  │
│  GET     │  /api/support-chat/threads                   │  List support threads        │  support  │
│  POST    │  /api/support-chat/reply                     │  Reply to thread             │  support  │
│  POST    │  /api/support-chat/resolve                   │  Resolve thread              │  support  │
│  POST    │  /api/sos/:id/resolve                        │  Resolve SOS alert           │  system   │
├──────────┼────────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  GET     │  /api/analytics                              │  Revenue analytics           │  finance  │
│  GET     │  /api/analytics/search                       │  Search analytics            │  system   │
│  GET     │  /api/analytics/wishlist                     │  Wishlist insights           │  system   │
│  GET     │  /api/audit-logs                             │  Immutable audit log         │  system   │
│  GET     │  /api/consent-log                            │  User consent records        │  system   │
│  GET     │  /api/health                                 │  System health status        │  system   │
│  GET     │  /api/error-logs                             │  Error monitor               │  system   │
├──────────┼────────────────────────────────────────────┼──────────────────────────────┼───────────┤
│  GET     │  /api/platform-config                        │  Get all config              │  system   │
│  PATCH   │  /api/platform-config                        │  Update config keys          │  system   │
│  PATCH   │  /api/platform-config/modules               │  Toggle feature modules      │  system   │
│  PATCH   │  /api/platform-config/auth-methods          │  Toggle auth methods         │  system   │
└──────────┴────────────────────────────────────────────┴──────────────────────────────┴───────────┘
```

---

## 20. Theme Style Guide

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
│  Error / SOS          │  #F44336  (red)           │  PRESERVED │
│  Font                 │  Inter / system-ui        │  PRESERVED │
│  Border Radius        │  12px cards / 8px inputs  │  PRESERVED │
│  UI Library           │  Shadcn UI + Tailwind CSS │  PRESERVED │
├───────────────────────┼──────────────────────────┼────────────┤
│  Admin Pages          │  DO NOT REDESIGN          │            │
│  /dashboard           │  KPI overview             │  ✅        │
│  /orders              │  Order management         │  ✅        │
│  /rides               │  Fleet oversight          │  ✅        │
│  /vendors             │  Vendor management        │  ✅        │
│  /riders              │  Rider management         │  ✅        │
│  /kyc                 │  KYC review queue         │  ✅        │
│  /users               │  Customer management      │  ✅        │
│  /transactions        │  Finance overview         │  ✅        │
│  /withdrawals         │  Withdrawal approval      │  ✅        │
│  /analytics           │  Revenue analytics        │  ✅        │
│  /audit-logs          │  Immutable action log     │  ✅        │
│  /roles-permissions   │  RBAC management          │  ✅        │
│  /sos-alerts          │  Emergency alerts         │  ✅        │
│  /health-dashboard    │  System health            │  ✅        │
│  /settings            │  Platform config          │  ✅        │
│  /launch-control      │  Pre-flight checklist     │  ✅        │
└───────────────────────┴──────────────────────────┴────────────┘
```

---

*End of AJKMART Admin Panel – Complete Logic Flow Document*
