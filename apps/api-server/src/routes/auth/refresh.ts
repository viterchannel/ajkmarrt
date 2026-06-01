import { Router, type IRouter } from "express";
import { z } from "zod";
import { logger } from "../../lib/logger.js";
import { sendSuccess } from "../../lib/response.js";
import { validateBody as sharedValidateBody } from "../../middleware/validate.js";
import {
  blacklistJti,
  getClientIp,
  hashRefreshToken,
  revokeRefreshToken,
  verifyUserJwt,
  writeAuthAuditLog,
} from "../../middleware/security.js";
import { handleRefreshToken } from "./auth-common.js";
import {
  clearRiderRefreshCookie,
  clearVendorRefreshCookie,
  refreshTokenSchema,
  RIDER_REFRESH_COOKIE,
  VENDOR_REFRESH_COOKIE,
} from "./helpers.js";

const router: IRouter = Router();

router.post("/refresh", sharedValidateBody(refreshTokenSchema), handleRefreshToken);
router.post("/refresh-token", sharedValidateBody(refreshTokenSchema), handleRefreshToken);

/* ─────────────────────────────────────────────────────────────────────────────
   POST /auth/logout
   Revokes the caller's refresh token so it cannot be used to obtain new access
   tokens.  Also blacklists the current access token JTI so it is rejected
   immediately instead of waiting for its natural TTL expiry.

   Token sources (checked in order):
     1. refreshToken field in the JSON body (preferred — explicit)
     2. ajkmart_rider_refresh HttpOnly cookie
     3. ajkmart_vendor_refresh HttpOnly cookie

   Always responds 200 so that a missing / already-expired token does not break
   the client-side logout flow (local state is always cleared regardless).
───────────────────────────────────────────────────────────────────────────── */

const LogoutSchema = z
  .object({ refreshToken: z.string().optional() })
  .strip();

router.post("/logout", sharedValidateBody(LogoutSchema), async (req, res) => {
  try {
    const ip = getClientIp(req);

    const authHeader = req.headers["authorization"] as string | undefined;
    const rawAccessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const jwtPayload = rawAccessToken ? verifyUserJwt(rawAccessToken) : null;

    const cookieRider = (req.cookies as Record<string, string> | undefined)?.[RIDER_REFRESH_COOKIE];
    const cookieVendor = (req.cookies as Record<string, string> | undefined)?.[VENDOR_REFRESH_COOKIE];
    const rawRefreshToken: string | undefined =
      (req.body?.refreshToken as string | undefined) || cookieRider || cookieVendor;

    if (rawRefreshToken) {
      const tokenHash = hashRefreshToken(rawRefreshToken);
      await revokeRefreshToken(tokenHash, "USER_LOGOUT");
    }

    if (jwtPayload?.jti && jwtPayload?.exp) {
      await blacklistJti(jwtPayload.jti, jwtPayload.exp).catch(() => undefined);
    }

    clearRiderRefreshCookie(res);
    clearVendorRefreshCookie(res);

    if (jwtPayload?.userId) {
      void writeAuthAuditLog("logout", {
        userId: jwtPayload.userId,
        ip,
        userAgent: req.headers["user-agent"] ?? undefined,
      });
    }

    sendSuccess(res, undefined, "Logged out successfully");
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err) },
      "[auth/logout] unhandled error"
    );
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
