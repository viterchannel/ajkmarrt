# @workspace/api-zod

Auto-generated Zod schemas and TypeScript types for the AJKMart API. Single source of truth for request/response shapes shared between the API server and all frontend clients.

## What It Exports

- Generated API client types (from `src/generated/`)
- Zod validation schemas for all API request/response bodies
- `validate(schema, data)` — throws a typed `ZodError` on invalid input
- Utility types and helpers (`src/utils.ts`)

## Usage

```typescript
import { CreateOrderRequest, validate } from "@workspace/api-zod";

// Type-check a request body:
const order = validate(CreateOrderRequest, req.body);

// Import generated types directly:
import type { CartItem, FareEstimate } from "@workspace/api-zod";
```

## Code Generation

Types are generated from the OpenAPI spec in `@workspace/api-spec`. Re-generate after API changes:

```bash
pnpm --filter @workspace/api-zod run generate
```
