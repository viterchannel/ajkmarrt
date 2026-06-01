# @workspace/logger

Shared frontend logger for all AJKMart web, mobile, and shared library packages. Provides namespaced, coloured console output in development and production-safe error forwarding.

## What It Exports

- `createLogger(namespace: string)` — returns a `{ debug, warn, error }` logger scoped to a namespace
- `registerErrorHandler(handler)` — wires the error reporting pipeline (call once per app entry point)

## Usage

```typescript
import { createLogger, registerErrorHandler } from "@workspace/logger";

// Create a logger for your module:
const log = createLogger("[OrderService]");

log.debug("data loaded", data);  // dev only — no-op in prod
log.warn("slow response", ms);   // dev only — no-op in prod
log.error("request failed", err); // always fires; forwarded to error handler in prod
```

## Wiring (call once in each app entry point)

```typescript
import { registerErrorHandler } from "@workspace/logger";
import { reportError } from "./lib/error-reporter";

registerErrorHandler(reportError);
```

## Behaviour

- **Dev**: all levels print to console with a coloured `[Namespace]` prefix
- **Prod**: `debug` and `warn` are no-ops; `error` forwards to the registered error handler
