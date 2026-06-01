# @workspace/service-constants

Platform-wide constants shared across all AJKMart apps and the API server — service identifiers, city lists, and other canonical reference data.

## What It Exports

- `ServiceKey` — union type: `"mart" | "food" | "rides" | "pharmacy" | "parcel" | "van" | "school"`
- `PAKISTAN_CITIES` — readonly array of canonical Pakistani city names (AJK cities first, then major cities)

## Usage

```typescript
import { ServiceKey, PAKISTAN_CITIES } from "@workspace/service-constants";

// Type-safe service routing:
function getServiceRoute(key: ServiceKey): string { /* ... */ }

// Populate a city dropdown:
const cities = PAKISTAN_CITIES; // ["Muzaffarabad", "Mirpur", ...]
```

## Why This Package

Single source of truth — import from here instead of hardcoding service keys or city lists in each app. Changing a city name or adding a new service only requires updating this package.
