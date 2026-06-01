import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wraps an async Express route handler so that any thrown error is forwarded
 * to Express's next(err) error-handling pipeline.
 *
 * Express 5 propagates async errors natively, so this wrapper is primarily a
 * safety net for mixed-version scenarios and makes the error-forwarding intent
 * explicit at the call site.
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
