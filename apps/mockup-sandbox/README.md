# @workspace/mockup-sandbox

Vite-powered UI component sandbox for AJKMart — isolated environment for rapidly prototyping and previewing UI components and screens without running the full app stack.

## Features

- Hot-reload component previews
- Uses the same `@workspace/ui` and Tailwind CSS 4 setup as production apps
- Accessible at `/__mockup` path via the API server reverse proxy

## Local Dev

```bash
# From monorepo root:
pnpm --filter @workspace/mockup-sandbox run dev

# Runs on port 8081 by default
```

Access at: `/__mockup` (proxied through the API server) or directly at `http://localhost:8081`

## Required Environment Variables

None — this is a purely client-side development tool.

## Port

`8081` (internal) — proxied to `/__mockup` in development.
