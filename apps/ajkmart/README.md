# @workspace/ajkmart

Expo 52 / React Native customer super-app — e-commerce, food delivery, ride-hailing, pharmacy, parcel, and inter-city transport in a single mobile app targeting Android and iOS.

## Features

- Service hub: Mart, Food, Rides, Pharmacy, Parcel, Van, School
- Expo Router file-based navigation
- OTP + Google OAuth login
- Real-time order tracking
- Push notifications via Firebase FCM
- Offline-first cart with optimistic updates

## Local Dev (Expo Go / web)

```bash
# From monorepo root:
pnpm --filter @workspace/ajkmart run dev

# Requires: REPLIT_DEV_DOMAIN, REPL_ID env vars (auto-set in Replit)
```

## Android Build

```bash
pnpm --filter @workspace/ajkmart run build
# Produces APK via EAS Build (configure eas.json for your project)
```

## Required Environment Variables

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_DOMAIN` | Public domain for API calls |
| `EXPO_PUBLIC_REPL_ID` | Replit REPL ID (auto-set in Replit) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Optional — enables push notifications |

## Port

Expo dev server uses the `PORT` env var (default 8081 in standalone mode).
