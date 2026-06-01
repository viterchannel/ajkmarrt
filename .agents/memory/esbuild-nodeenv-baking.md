---
name: esbuild NODE_ENV baking — Cloud Run build container issue
description: Why build.mjs must always bake "development" not read process.env.NODE_ENV at build time.
---

## Rule
`apps/api-server/scripts/build.mjs` must hardcode `"development"` in the esbuild `define` block:

```js
define: {
  "process.env.NODE_ENV": JSON.stringify("development"),
},
```

Never use `JSON.stringify(process.env.NODE_ENV ?? "production")`.

**Why:** Replit Cloud Run autoscale injects `NODE_ENV=production` into the build container. The build step runs inside that container, so `process.env.NODE_ENV` is `"production"` when esbuild executes. This causes esbuild to bake `"production"` into every `process.env.NODE_ENV` (dot-notation) occurrence in the bundle. At runtime, all the startup secret guards (`security.ts`, `admin-jwt.ts`, `admin-csrf.ts`, `admin-shared.ts`) see the baked `"production"` value, find `JWT_SECRET` missing (it's not injected into Cloud Run from `[userenv.production]`), and call `process.exit(1)` before the health check can respond.

**How to apply:** Any time `build.mjs` is touched or regenerated, keep the hardcoded `"development"` string. Runtime code that needs to detect production should use bracket notation `process.env["NODE_ENV"]` which reads the actual runtime value (not baked by esbuild).

## Related facts
- `[userenv.production]` in `.replit` is NOT injected into Cloud Run containers — only Replit-managed secrets (DATABASE_URL etc.) and Cloud Run's own `NODE_ENV=production` reach the container.
- All secret-guard `process.exit(1)` calls in the codebase use dot notation, so fixing the baking is sufficient.
- `redis.ts` `isProduction` uses bracket notation (reads runtime "production") but only exits on malformed `REDIS_URL`, not missing — safe.
