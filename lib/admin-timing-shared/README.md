# @workspace/admin-timing-shared

Typed timing-overrides registry factory shared across all AJKMart apps. Lets the admin panel push timing config (poll intervals, staleness thresholds, etc.) at runtime without a redeploy.

## What It Exports

- `createTimingRegistry<T>(defaults: T)` — creates a typed registry with `apply`, `reset`, and `get` methods

## Usage

```typescript
import { createTimingRegistry } from "@workspace/admin-timing-shared";

interface RiderTimingConfig {
  stalenessMs: number;
  pollMs: number;
}

const DEFAULTS: RiderTimingConfig = { stalenessMs: 5_000, pollMs: 30_000 };

export const riderTiming = createTimingRegistry<RiderTimingConfig>(DEFAULTS);

// Apply admin overrides at runtime:
riderTiming.apply({ pollMs: 10_000 });

// Read current values:
const { pollMs } = riderTiming.get();

// Reset to defaults:
riderTiming.reset();
```

Each app keeps its own typed config; this package only owns the apply/reset/get plumbing so override semantics stay identical across apps.
