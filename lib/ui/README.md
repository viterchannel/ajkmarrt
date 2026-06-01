# @workspace/ui

Shared UI component library for AJKMart web apps — brand assets, reusable components, hooks, and design tokens built with React 19 and Tailwind CSS 4.

## What It Exports

### Components
- `AjkmartLogo` — SVG brand logo component with size/colour props

### Design Tokens
- `SERVICE_COLORS` — per-service colour map (mart, food, rides, pharmacy, parcel, van, school)
- `ServiceColorEntry`, `ServiceId` types

### Hooks
- `useIsMobile()` — responsive breakpoint hook (returns `true` below 768 px)

## Usage

```typescript
import { AjkmartLogo, SERVICE_COLORS, useIsMobile } from "@workspace/ui";

// Logo:
<AjkmartLogo className="h-8 w-auto" />

// Service colours:
const color = SERVICE_COLORS["food"].primary; // "#FF6B35"

// Responsive hook:
const isMobile = useIsMobile();
```

## Adding New Components

Place new components under `src/components/`, export them from `src/index.ts`, and use Tailwind CSS 4 classes. The package is consumed by `admin`, `vendor-app`, and `rider-app`.
