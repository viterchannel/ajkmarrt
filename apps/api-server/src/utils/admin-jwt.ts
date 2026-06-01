import jwt from "jsonwebtoken";
import { logger } from "../lib/logger.js";

const DEV_PLACEHOLDER = "dev-placeholder-jwt-secret-000000";

function resolveSecret(envVar: string): string {
  const val = process.env[envVar];
  const isProduction = ["production", "staging"].includes(process.env.NODE_ENV ?? "");

  if (!val || val.length < 32) {
    if (isProduction) {
      const msg = !val
        ? `[ADMIN JWT] FATAL: ${envVar} is not set. Minimum 32 characters required.`
        : `[ADMIN JWT] FATAL: ${envVar} too short (${val.length} chars, need ≥32).`;
      logger.fatal(msg);
      process.exit(1);
    }
    logger.warn(
      `[ADMIN JWT] WARNING: ${envVar} is not set or too short. Using unsafe dev fallback — set a strong secret before deploying to production.`
    );
    return DEV_PLACEHOLDER;
  }
  return val;
}

function getAccessSecret(): string {
  return resolveSecret("ADMIN_ACCESS_TOKEN_SECRET");
}

function getRefreshSecret(): string {
  return resolveSecret("ADMIN_REFRESH_TOKEN_SECRET");
}
const JWT_ISSUER = process.env.JWT_ISSUER || "ajkmart-admin";

export interface AccessTokenPayload {
  sub: string; // adminId
  role: string; // 'super' | 'admin' | 'moderator' etc
  name: string;
  /**
   * Compact form of the admin's effective permissions
   * (catalogued ids from @workspace/auth-utils/permissions).
   * Stored in the token so middleware can authorize without a DB hit.
   */
  perms?: string[];
  /** Bumped on role/permission change so old tokens are invalidated. */
  pv?: number;
  /**
   * Legacy "must change password" claim. Tokens are no longer minted
   * with this claim — the optional credentials popup is now SPA-driven
   * via the `defaultCredentials` flag returned alongside auth responses.
   * The field is kept so previously-issued tokens keep verifying without
   * surfacing a parse error.
   */
  mpc?: boolean;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string; // adminId
  sessionId: string;
  iat?: number;
  exp?: number;
}

/**
 * Sign an access token (short-lived, 15 minutes)
 * Used for API calls. Should be stored in memory only on frontend.
 */
export function signAccessToken(
  adminId: string,
  role: string,
  name: string,
  perms: string[] = [],
  pv: number = 0,
  /**
   * Legacy parameter. Tokens are no longer minted with the `mpc` claim;
   * the value is ignored. Kept on the signature so existing call sites
   * keep compiling while we phase the parameter out.
   */
  _mustChangePassword: boolean = false
): string {
  const payload: AccessTokenPayload = { sub: adminId, role, name, perms, pv };
  return jwt.sign(payload, getAccessSecret(), {
    expiresIn: "15m",
    issuer: JWT_ISSUER,
    algorithm: "HS256",
  });
}

/**
 * Sign a refresh token (long-lived, 7 days)
 * Used to issue new access tokens. Stored in HttpOnly cookies.
 */
export function signRefreshToken(adminId: string, sessionId: string): string {
  return jwt.sign({ sub: adminId, sessionId }, getRefreshSecret(), {
    expiresIn: "7d",
    issuer: JWT_ISSUER,
    algorithm: "HS256",
  });
}

/**
 * Verify and decode an access token
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, getAccessSecret(), {
      issuer: JWT_ISSUER,
      algorithms: ["HS256"],
    });
    return payload as AccessTokenPayload;
  } catch (error) {
    throw new Error(`Invalid access token: ${(error as Error).message}`);
  }
}

/**
 * Verify and decode a refresh token
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const payload = jwt.verify(token, getRefreshSecret(), {
      issuer: JWT_ISSUER,
      algorithms: ["HS256"],
    });
    return payload as RefreshTokenPayload;
  } catch (error) {
    throw new Error(`Invalid refresh token: ${(error as Error).message}`);
  }
}

/**
 * Sign a temporary 2FA challenge token (5 minutes)
 * Issued after password verification, required for TOTP submission
 */
export function sign2faChallengeToken(adminId: string): string {
  return jwt.sign({ sub: adminId, type: "2fa-challenge" }, getAccessSecret(), {
    expiresIn: "5m",
    issuer: JWT_ISSUER,
    algorithm: "HS256",
  });
}

/**
 * Verify a 2FA challenge token
 */
export function verify2faChallengeToken(token: string): { sub: string; type: string } {
  try {
    const payload = jwt.verify(token, getAccessSecret(), {
      issuer: JWT_ISSUER,
      algorithms: ["HS256"],
    });
    const decoded = payload as { sub: string; type: string };
    if (decoded.type !== "2fa-challenge") {
      throw new Error("Invalid challenge token type");
    }
    return decoded;
  } catch (error) {
    throw new Error(`Invalid 2FA challenge token: ${(error as Error).message}`);
  }
}
