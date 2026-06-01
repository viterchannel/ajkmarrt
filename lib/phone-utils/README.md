# @workspace/phone-utils

Pure, dependency-free Pakistani mobile phone number utilities. Importable by any package — including the API server — without pulling in React or browser APIs.

## What It Exports

- `canonicalizePhone(raw: string): string` — normalises any Pakistani number format to bare 10-digit `3xxxxxxxxx`
- Additional phone validation and formatting helpers

## Usage

```typescript
import { canonicalizePhone } from "@workspace/phone-utils";

canonicalizePhone("03001234567");   // → "3001234567"
canonicalizePhone("+923001234567"); // → "3001234567"
canonicalizePhone("923001234567");  // → "3001234567"
canonicalizePhone("3001234567");    // → "3001234567"
```

## Accepted Formats

| Input format | Example |
|---|---|
| Local with leading zero | `03001234567` |
| Bare 10-digit | `3001234567` |
| E.164 | `+923001234567` |
| Country code without `+` | `923001234567` |

The same logic is re-exported by `@workspace/auth-utils` for frontend packages.
