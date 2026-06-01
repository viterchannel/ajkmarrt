---
name: AJKMart pnpm symlink quirks
description: pnpm install times out in this monorepo; packages must be symlinked manually; Vite alias resolution requires react/react-dom in each frontend app's own node_modules.
---

# AJKMart pnpm Monorepo — Replit Quirks

## The rule
`pnpm install` in `extracted/12345678/` consistently times out (90s+) because of post-install scripts (sharp native builds, etc.). Never rely on it completing in a bash tool call.

**Why:** The monorepo has 2162 packages; native addon compilation (sharp, canvas, etc.) takes too long for the sandbox.

**How to apply:** Use the Python symlink script (`scripts/post-merge.sh` Step 3) to manually link packages from the `.pnpm/` virtual store into `node_modules/`. The post-merge script handles this.

## react/react-dom must be in each frontend app's node_modules
The admin panel's `vite.config.ts` has:
```ts
alias: {
  react: path.resolve(import.meta.dirname, "node_modules/react"),
  "react-dom": path.resolve(import.meta.dirname, "node_modules/react-dom"),
}
```
This means Vite looks for react in `artifacts/admin/node_modules/react`, NOT in the monorepo root.

**Why:** The vite config uses local node_modules aliases for deduplication.

**How to apply:** After any pnpm install, symlink react and react-dom into each app's local node_modules:
- `extracted/12345678/artifacts/admin/node_modules/react -> ../../node_modules/react`
- `extracted/12345678/artifacts/vendor-app/node_modules/react -> ...`
- `extracted/12345678/artifacts/rider-app/node_modules/react -> ...`

The post-merge script (Step 3b) handles this automatically.

## Clear Vite caches after symlink changes
If react symlinks change, the Vite dep optimizer cache at `artifacts/*/node_modules/.vite/` must be cleared, then workflow restarted.
