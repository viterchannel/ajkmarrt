/**
 * Firebase Crashlytics wrapper for the Rider App.
 *
 * On native Capacitor builds (iOS / Android) this wraps
 * @capacitor-firebase/crashlytics to send native crash reports to Firebase.
 * On web / browser the Sentry helpers are used as the fallback so crash
 * data always reaches at least one destination.
 *
 * Setup:
 *   Native Android — place google-services.json in android/app/ and enable
 *   the com.google.firebase:firebase-crashlytics-gradle plugin in build.gradle.
 *   Native iOS — place GoogleService-Info.plist in ios/App/App/ and add the
 *   Firebase/Crashlytics pod via CocoaPods.
 */

import { Capacitor } from "@capacitor/core";
import { createLogger } from "./logger";
import { captureError, setSentryUser } from "./sentry";

const log = createLogger("[crashlytics]");

let _enabled = false;

/** Call once at app start (after Firebase native SDK is ready). */
export async function initCrashlytics(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { FirebaseCrashlytics } = await import("@capacitor-firebase/crashlytics");
    await FirebaseCrashlytics.setEnabled({ enabled: true });
    _enabled = true;
    log.info("Firebase Crashlytics enabled (native)");
  } catch (err) {
    log.warn("Crashlytics init failed (plugin may not be installed in native project):", err);
  }
}

/**
 * Record a caught or uncaught exception.
 * Always forwards to Sentry; also forwards to Crashlytics on native.
 */
export async function recordException(
  err: unknown,
  context?: Record<string, unknown>
): Promise<void> {
  const error = err instanceof Error ? err : new Error(String(err));
  captureError(error, context);

  if (!_enabled) return;
  try {
    const { FirebaseCrashlytics } = await import("@capacitor-firebase/crashlytics");
    await FirebaseCrashlytics.recordException({
      message: error.message,
    });
  } catch (e) {
    log.warn("Crashlytics.recordException failed:", e);
  }
}

/** Attach the authenticated rider's ID so crash reports are linkable. */
export async function setCrashlyticsUser(userId: string): Promise<void> {
  setSentryUser(userId);
  if (!_enabled) return;
  try {
    const { FirebaseCrashlytics } = await import("@capacitor-firebase/crashlytics");
    await FirebaseCrashlytics.setUserId({ userId });
  } catch (e) {
    log.warn("Crashlytics.setUserId failed:", e);
  }
}

/** Clear the rider identity (on logout). */
export async function clearCrashlyticsUser(): Promise<void> {
  if (!_enabled) return;
  try {
    const { FirebaseCrashlytics } = await import("@capacitor-firebase/crashlytics");
    await FirebaseCrashlytics.setUserId({ userId: "" });
  } catch (e) {
    log.warn("Crashlytics.setUserId clear failed:", e);
  }
}

/** Add a breadcrumb log entry visible in Crashlytics reports. */
export async function crashLog(message: string): Promise<void> {
  if (!_enabled) return;
  try {
    const { FirebaseCrashlytics } = await import("@capacitor-firebase/crashlytics");
    await FirebaseCrashlytics.log({ message });
  } catch {
    /* non-critical */
  }
}
