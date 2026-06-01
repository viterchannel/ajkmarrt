/**
 * rider-aliases.ts — Canonical top-level reference paths for rider operations.
 *
 * These are additive aliases that delegate to the canonical rider router
 * (mounted at /riders) by rewriting req.url before passing the request through.
 * All auth (riderAuth), feature gates, and rate limiting run inside the rider
 * router exactly as they do for the /riders/* paths — no duplication of logic.
 *
 * Alias map:
 *   GET   /orders/requests        → /riders/requests
 *   POST  /orders/:id/accept      → /riders/orders/:id/accept
 *   POST  /rides/:id/accept       → /riders/rides/:id/accept
 *   POST  /rides/:id/counter      → /riders/rides/:id/counter
 *   GET   /wallet                 → /riders/wallet/transactions (rider branch)
 *   POST  /wallet/deposit         → /riders/wallet/deposit
 *   POST  /withdraw               → /riders/wallet/withdraw
 *   POST  /wallet/cod-remittance  → /riders/cod/remit
 *   GET   /earnings               → /riders/earnings
 *   GET   /history                → /riders/history
 *   PATCH /status                 → /riders/status (online/offline toggle)
 */
import type { NextFunction, Request, Response } from "express";
import { Router, type IRouter } from "express";
import riderRouter from "./rider/index.js";

const router: IRouter = Router();

/**
 * Rewrites req.url to targetPath (preserving any query string from the
 * original URL), then delegates to riderRouter.  The rider router's own
 * riderAuth middleware runs first, so all auth + role checks are preserved.
 */
function delegateToRider(targetPath: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    req.url = `${targetPath}${qs}`;
    riderRouter(req, res, next);
  };
}

/* GET /orders/requests — rider request feed (orders + rides awaiting acceptance) */
router.get("/orders/requests", delegateToRider("/requests"));

/* POST /orders/:id/accept — rider accepts a delivery order */
router.post("/orders/:id/accept", (req: Request, res: Response, next: NextFunction): void => {
  req.url = `/orders/${req.params.id}/accept`;
  riderRouter(req, res, next);
});

/* POST /rides/:id/accept — rider accepts a ride (checkFeatureAccess runs inside rider router) */
router.post("/rides/:id/accept", (req: Request, res: Response, next: NextFunction): void => {
  req.url = `/rides/${req.params.id}/accept`;
  riderRouter(req, res, next);
});

/* POST /rides/:id/counter — rider submits a counter-bid on a ride */
router.post("/rides/:id/counter", (req: Request, res: Response, next: NextFunction): void => {
  req.url = `/rides/${req.params.id}/counter`;
  riderRouter(req, res, next);
});

/* GET /wallet — rider wallet transactions (full history, legacy non-paginated) */
router.get("/wallet", delegateToRider("/wallet/transactions?legacy=1"));

/* POST /wallet/deposit — rider wallet deposit submission */
router.post("/wallet/deposit", delegateToRider("/wallet/deposit"));

/* POST /withdraw — rider wallet withdrawal (checkFeatureAccess("withdraw_money") runs inside) */
router.post("/withdraw", delegateToRider("/wallet/withdraw"));

/* POST /wallet/cod-remittance — rider COD remittance submission */
router.post("/wallet/cod-remittance", delegateToRider("/cod/remit"));

/* GET /earnings — rider earnings breakdown */
router.get("/earnings", delegateToRider("/earnings"));

/* GET /history — rider delivery + ride history */
router.get("/history", (req: Request, res: Response, next: NextFunction): void => {
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  req.url = `/history${qs}`;
  riderRouter(req, res, next);
});

/* POST /orders/:id/pickup-confirm — delivery pickup confirmation (spec-compliant top-level alias) */
router.post("/orders/:id/pickup-confirm", (req: Request, res: Response, next: NextFunction): void => {
  req.url = `/orders/${req.params.id}/pickup-confirm`;
  riderRouter(req, res, next);
});

/* PATCH /riders/status — toggle rider online/offline (spec-compliant top-level alias) */
router.patch("/status", delegateToRider("/status"));

export default router;
