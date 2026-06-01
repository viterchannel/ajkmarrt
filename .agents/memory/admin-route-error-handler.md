---
name: Admin route error handler pattern
description: How to add consistent JSON error responses to admin Express routers without wrapping every handler.
---

Express 5 auto-propagates thrown errors from async route handlers to the nearest `next(err)` handler. The correct pattern for admin routers is to add a single 4-argument error middleware at the **end** of the router file (before `export default router`), not to wrap each handler with an `asyncHandler` HOF.

```typescript
router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err: err.message }, "[admin/rides] unhandled route error");
  res.status(500).json({ success: false, error: "Internal server error" });
});
```

**Why:** Wrapping 30+ routes individually is error-prone and noisy. A single end-of-router handler covers all routes and matches the `{ success: false, error: "..." }` shape used by the global error handler in `app.ts`.

**How to apply:** Add after the last `router.METHOD(...)` call but before `export default router` in any admin route file that has bare `async (req, res)` handlers with no try/catch. Remember to import `type NextFunction, type Request, type Response` alongside `Router` from express.

The `asyncHandler` utility lives at `apps/api-server/src/lib/async-handler.ts` if individual wrapping is ever needed.
