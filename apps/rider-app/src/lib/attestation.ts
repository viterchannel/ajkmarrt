/**
 * Device attestation for native Capacitor builds.
 *
 * Android — Play Integrity API via @capacitor-community/play-integrity
 * iOS     — App Attest API via a Capacitor plugin (stubbed; wire up when the
 *           native plugin is available in the Xcode project)
 *
 * On web / browser builds this module is a no-op so dev flows are unaffected.
 *
 * Usage: call runAttestation() once on app start (from App.tsx after auth is
 * ready). The server validates the token and embeds a short-lived claim in the
 * session. The client stores the resulting session-attestation token and
 * includes it in the X-Attest-Token header on sensitive requests.
 */

import { createLogger } from "@/lib/logger";
import { Capacitor } from "@capacitor/core";

const log = createLogger("[attestation]");

const ATTEST_TOKEN_KEY = "ajkmart_rider_attest_token";
const ATTEST_EXPIRY_KEY = "ajkmart_rider_attest_expiry";

/* Short-lived in-memory cache for the attestation token */
let _inMemoryAttestToken = "";
let _inMemoryAttestExpiry = 0;

async function prefSet(key: string, value: string): Promise<void> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key, value });
  } catch {
    /* non-critical */
  }
}

async function prefGet(key: string): Promise<string> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key });
    return value ?? "";
  } catch {
    return "";
  }
}

/** Store the server-issued attestation token and its expiry (Unix ms). */
export async function storeAttestToken(token: string, expiresAt: number): Promise<void> {
  _inMemoryAttestToken = token;
  _inMemoryAttestExpiry = expiresAt;
  await prefSet(ATTEST_TOKEN_KEY, token);
  await prefSet(ATTEST_EXPIRY_KEY, String(expiresAt));
}

/** Return the cached attestation token if still valid, else empty string. */
export async function getAttestToken(): Promise<string> {
  if (_inMemoryAttestToken && _inMemoryAttestExpiry > Date.now()) {
    return _inMemoryAttestToken;
  }
  const stored = await prefGet(ATTEST_TOKEN_KEY);
  const expiryStr = await prefGet(ATTEST_EXPIRY_KEY);
  const expiry = parseInt(expiryStr, 10);
  if (stored && Number.isFinite(expiry) && expiry > Date.now()) {
    _inMemoryAttestToken = stored;
    _inMemoryAttestExpiry = expiry;
    return stored;
  }
  return "";
}

/** Invalidate the cached attestation token. */
export async function clearAttestToken(): Promise<void> {
  _inMemoryAttestToken = "";
  _inMemoryAttestExpiry = 0;
  await prefSet(ATTEST_TOKEN_KEY, "");
  await prefSet(ATTEST_EXPIRY_KEY, "");
}

/**
 * Generate a device attestation token using the platform-appropriate API,
 * then exchange it with the server's /riders/attest endpoint.
 *
 * Returns true if attestation succeeded (or was skipped on web).
 */
export async function runAttestation(apiBase: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    log.debug("[attestation] skipped — not a native platform");
    return true;
  }

  const platform = Capacitor.getPlatform();
  let deviceToken: string | null = null;

  if (platform === "android") {
    deviceToken = await getPlayIntegrityToken();
  } else if (platform === "ios") {
    deviceToken = await getAppAttestToken();
  }

  if (!deviceToken) {
    log.warn("[attestation] could not obtain device attestation token — skipping");
    return false;
  }

  return exchangeWithServer(apiBase, platform, deviceToken);
}

/**
 * Obtain a Play Integrity token on Android.
 * Dynamically imports @capacitor-community/play-integrity so the web bundle
 * is unaffected when the native plugin is absent.
 */
async function getPlayIntegrityToken(): Promise<string | null> {
  try {
    const { PlayIntegrity } = await import("@capacitor-community/play-integrity");
    const nonce = generateNonce();
    const result = await PlayIntegrity.requestIntegrityToken({ nonce });
    return result?.token ?? null;
  } catch (err) {
    log.warn("[attestation] Play Integrity token error:", err);
    return null;
  }
}

/**
 * Obtain an App Attest key assertion on iOS.
 * Stubbed until the native Capacitor App Attest plugin is wired into the
 * Xcode project. Returns null so attestation degrades gracefully.
 */
async function getAppAttestToken(): Promise<string | null> {
  try {
    const { AppAttest } = await import("@capacitor-community/app-attest");
    const keyId = await AppAttest.generateKey();
    const challenge = generateNonce();
    const result = await AppAttest.attestKey({ keyId, challenge });
    return result?.attestation ?? null;
  } catch (err) {
    /* Plugin not yet available — degrade gracefully */
    log.warn("[attestation] App Attest token error (plugin may not be installed):", err);
    return null;
  }
}

/**
 * Exchange the device token with the server and store the resulting
 * session-attestation claim.
 */
async function exchangeWithServer(
  apiBase: string,
  platform: string,
  deviceToken: string
): Promise<boolean> {
  try {
    const resp = await fetch(`${apiBase}/riders/attest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ platform, token: deviceToken }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!resp.ok) {
      log.warn(`[attestation] server rejected attestation: HTTP ${resp.status}`);
      return false;
    }

    const json = (await resp.json()) as {
      success: boolean;
      data?: { attestToken?: string; expiresAt?: number };
    };

    if (json.success && json.data?.attestToken) {
      const expiresAt = json.data.expiresAt ?? Date.now() + 24 * 60 * 60 * 1000;
      await storeAttestToken(json.data.attestToken, expiresAt);
      log.info("[attestation] session attestation token stored");
      return true;
    }

    log.warn("[attestation] server response missing attestToken");
    return false;
  } catch (err) {
    log.warn("[attestation] exchange with server failed:", err);
    return false;
  }
}

function generateNonce(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}
