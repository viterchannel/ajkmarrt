import { tDual, type TranslationKey } from "@workspace/i18n";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Globe,
  Laptop,
  LogOut,
  Loader2,
  Monitor,
  Shield,
  Smartphone,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { apiFetch } from "../lib/api";
import { useLanguage } from "../lib/useLanguage";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface ActiveSession {
  id: string;
  deviceName: string | null;
  browser: string | null;
  os: string | null;
  ip: string | null;
  location: string | null;
  lastActiveAt: string;
  createdAt: string;
}

interface LoginEntry {
  id: string;
  ip: string | null;
  deviceName: string | null;
  browser: string | null;
  os: string | null;
  location: string | null;
  success: boolean;
  method: string | null;
  createdAt: string;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function methodLabel(method: string | null): string {
  const map: Record<string, string> = {
    password: "Password",
    phone_password: "Phone + Password",
    email_password: "Email + Password",
    otp: "OTP",
    magic_link: "Magic Link",
    google: "Google",
    facebook: "Facebook",
    biometric: "Biometric",
    refresh: "Token Refresh",
  };
  return method ? (map[method] ?? method) : "Password";
}

function deviceLabel(s: ActiveSession | LoginEntry): string {
  return s.deviceName ?? s.browser ?? s.os ?? "Unknown device";
}

function DeviceIcon({ os }: { os: string | null }) {
  const lower = (os ?? "").toLowerCase();
  if (/android|ios|iphone|ipad|mobile/.test(lower))
    return <Smartphone size={15} className="text-[#B0B0B0]" />;
  if (/windows|mac|linux/.test(lower))
    return <Monitor size={15} className="text-[#B0B0B0]" />;
  if (/web|browser/.test(lower))
    return <Laptop size={15} className="text-[#B0B0B0]" />;
  return <Globe size={15} className="text-[#B0B0B0]" />;
}

/* ── Skeletons ──────────────────────────────────────────────────────────── */

function SessionSkeleton() {
  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <div className="mt-0.5 h-9 w-9 flex-shrink-0 animate-pulse rounded-xl bg-border-dark" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-32 animate-pulse rounded bg-border-dark" />
        <div className="h-3 w-48 animate-pulse rounded bg-border-dark" />
        <div className="h-3 w-20 animate-pulse rounded bg-border-dark" />
      </div>
      <div className="h-8 w-16 animate-pulse rounded-xl bg-border-dark" />
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <div className="mt-0.5 h-8 w-8 flex-shrink-0 animate-pulse rounded-xl bg-border-dark" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-36 animate-pulse rounded bg-border-dark" />
        <div className="h-3 w-52 animate-pulse rounded bg-border-dark" />
        <div className="h-3 w-24 animate-pulse rounded bg-border-dark" />
      </div>
      <div className="h-5 w-14 animate-pulse rounded-full bg-border-dark" />
    </div>
  );
}

/* ── Toast ──────────────────────────────────────────────────────────────── */

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div className="pointer-events-none fixed top-0 right-0 left-0 z-50 flex justify-center"
      style={{ paddingTop: "calc(env(safe-area-inset-top,0px) + 12px)", padding: "0 16px" }}>
      <div
        className={`pointer-events-auto w-full max-w-sm rounded-2xl px-5 py-3 text-center text-sm font-semibold text-white shadow-2xl ${
          type === "error" ? "bg-error" : "bg-brand"
        }`}
      >
        {message}
      </div>
    </div>
  );
}

/* ── Active Sessions section ────────────────────────────────────────────── */

interface SessionRowProps {
  session: ActiveSession;
  isFirst: boolean;
  onRevoke: (id: string) => Promise<void>;
  revoking: boolean;
}

function SessionRow({ session, isFirst, onRevoke, revoking }: SessionRowProps) {
  const [confirming, setConfirming] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startConfirm = () => {
    setConfirming(true);
    /* Auto-cancel the confirmation after 5 seconds if rider changes mind */
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => setConfirming(false), 5000);
  };

  const cancelConfirm = () => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirming(false);
  };

  const handleRevoke = async () => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirming(false);
    await onRevoke(session.id);
  };

  return (
    <div>
      {!isFirst && <div className="mx-5 border-t border-white/5" />}
      <div className="flex items-start gap-3 px-5 py-4">
        {/* Device icon bubble */}
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-card-dark">
          <DeviceIcon os={session.os} />
        </div>

        {/* Details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold text-white">
              {deviceLabel(session)}
            </span>
          </div>
          {(session.os || session.browser) && (
            <p className="mt-0.5 truncate text-xs text-[#B0B0B0]">
              {[session.os, session.browser].filter(Boolean).join(" · ")}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {session.ip && (
              <span className="font-mono text-[11px] text-[#B0B0B0]">{session.ip}</span>
            )}
            {session.location && (
              <span className="text-[11px] text-[#B0B0B0]">{session.location}</span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-[#B0B0B0]" title={formatDateTime(session.lastActiveAt)}>
            Active {relativeTime(session.lastActiveAt)}
          </p>
        </div>

        {/* Revoke controls */}
        <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
          {confirming ? (
            <>
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="flex h-8 items-center gap-1 rounded-xl bg-error px-3 text-[11px] font-bold text-white transition-colors hover:bg-error disabled:opacity-60"
              >
                {revoking ? <Loader2 size={11} className="animate-spin" /> : <LogOut size={11} />}
                Revoke
              </button>
              <button
                onClick={cancelConfirm}
                className="text-[10px] font-semibold text-[#B0B0B0] hover:text-[#B0B0B0]"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={startConfirm}
              disabled={revoking}
              className="flex h-8 items-center gap-1 rounded-xl border border-white/10 px-3 text-[11px] font-bold text-[#B0B0B0] transition-colors hover:border-error/30 hover:bg-error/10 hover:text-error disabled:opacity-40"
            >
              <LogOut size={11} />
              Sign out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */

export default function LoginHistory() {
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language); // eslint-disable-line react-hooks/exhaustive-deps

  /* Sessions state */
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState("");

  /* History state */
  const [entries, setEntries] = useState<LoginEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");

  /* Revoke state */
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeAllLoading, setRevokeAllLoading] = useState(false);
  const [revokeAllConfirm, setRevokeAllConfirm] = useState(false);
  const revokeAllTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Toast */
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  /* Fetch both in parallel on mount */
  useEffect(() => {
    let cancelled = false;

    /* Fetch both endpoints in parallel and handle errors separately */
    Promise.all([
      apiFetch<{ sessions: ActiveSession[] }>("/auth/sessions")
        .then((data) => ({ ok: true as const, sessions: data?.sessions ?? [], error: null }))
        .catch((err: unknown) => ({ ok: false as const, sessions: [], error: err instanceof Error ? err.message : "Failed to load sessions" })),
      apiFetch<{ history: LoginEntry[] }>("/login-history")
        .then((data) => ({ ok: true as const, entries: data?.history ?? [], error: null }))
        .catch((err: unknown) => ({ ok: false as const, entries: [], error: err instanceof Error ? err.message : "Failed to load login history" })),
    ]).then(([sessResult, histResult]) => {
      if (cancelled) return;
      setSessions(sessResult.sessions);
      setEntries(histResult.entries);
      if (sessResult.error) setSessionsError(sessResult.error);
      if (histResult.error) setHistoryError(histResult.error);
      setSessionsLoading(false);
      setHistoryLoading(false);
    }).catch((err: unknown) => {
      /* Catch-all for unexpected errors (e.g., Promise.all internal failure) */
      if (cancelled) return;
      const msg = err instanceof Error ? err.message : "Unexpected error";
      setSessionsError(msg);
      setHistoryError(msg);
      setSessionsLoading(false);
      setHistoryLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  /* Revoke a single session */
  const handleRevoke = useCallback(async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      await apiFetch("/auth/sessions/revoke", {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      showToast("Device signed out successfully");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to revoke session", "error");
    } finally {
      setRevokingId(null);
    }
  }, [showToast]);

  /* Revoke all other sessions */
  const startRevokeAll = () => {
    setRevokeAllConfirm(true);
    if (revokeAllTimerRef.current) clearTimeout(revokeAllTimerRef.current);
    revokeAllTimerRef.current = setTimeout(() => setRevokeAllConfirm(false), 5000);
  };

  const cancelRevokeAll = () => {
    if (revokeAllTimerRef.current) clearTimeout(revokeAllTimerRef.current);
    setRevokeAllConfirm(false);
  };

  const handleRevokeAll = async () => {
    if (revokeAllTimerRef.current) clearTimeout(revokeAllTimerRef.current);
    setRevokeAllConfirm(false);
    setRevokeAllLoading(true);
    try {
      const res = await apiFetch<{ revokedCount: number }>("/auth/sessions/revoke", {
        method: "POST",
        body: JSON.stringify({ revokeAllExceptCurrent: true }),
      });
      /* Keep only the current session (the one we're still logged in as).
         Since we don't know which one is current from this list, re-fetch. */
      const refreshed = await apiFetch<{ sessions: ActiveSession[] }>("/auth/sessions");
      setSessions(refreshed?.sessions ?? []);
      const count = res?.revokedCount ?? 0;
      showToast(count === 0 ? "No other sessions to sign out" : `${count} other device${count === 1 ? "" : "s"} signed out`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to sign out other devices", "error");
    } finally {
      setRevokeAllLoading(false);
    }
  };

  const otherSessionCount = sessions.length - 1; /* subtract current */

  return (
    <div className="min-h-screen bg-page-bg">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-b-[2rem] bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 px-5 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
      >
        <div className="absolute top-[-30%] right-[-15%] h-64 w-64 rounded-full bg-card-dark/[0.02]" />
        <div className="absolute bottom-[-20%] left-[-10%] h-48 w-48 rounded-full bg-success/[0.04]" />
        <div className="relative z-10 mb-2 flex items-center gap-3">
          <Link href="/settings/security" className="text-white/60 transition-colors hover:text-white">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Login History</h1>
            <p className="mt-0.5 text-xs text-white/50">Manage active devices & view sign-in events</p>
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      <div className="mx-auto mt-4 max-w-md space-y-4 px-4 pb-12">

        {/* ── ACTIVE SESSIONS ─────────────────────────────────────── */}
        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs font-bold uppercase tracking-wider text-[#B0B0B0]">
              Active Sessions
            </p>
            {/* "Sign out all other devices" — only shown when there are others */}
            {!sessionsLoading && sessions.length > 1 && (
              revokeAllConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#B0B0B0]">Sign out all others?</span>
                  <button
                    onClick={handleRevokeAll}
                    disabled={revokeAllLoading}
                    className="flex items-center gap-1 rounded-lg bg-error px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-error disabled:opacity-60"
                  >
                    {revokeAllLoading ? <Loader2 size={10} className="animate-spin" /> : <LogOut size={10} />}
                    Yes, sign out
                  </button>
                  <button onClick={cancelRevokeAll} className="text-[10px] text-[#B0B0B0] hover:text-[#B0B0B0]">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={startRevokeAll}
                  disabled={revokeAllLoading}
                  className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-[#B0B0B0] transition-colors hover:border-error/30 hover:bg-error/10 hover:text-error disabled:opacity-40"
                >
                  <LogOut size={10} />
                  Sign out all others
                </button>
              )
            )}
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-card-dark shadow-sm">
            {/* Loading */}
            {sessionsLoading && (
              <>
                <SessionSkeleton />
                <div className="mx-5 border-t border-white/5" />
                <SessionSkeleton />
              </>
            )}

            {/* Error */}
            {!sessionsLoading && sessionsError && (
              <div className="flex items-start gap-3 px-5 py-4">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-error" />
                <p className="text-xs text-error">{sessionsError}</p>
              </div>
            )}

            {/* Empty */}
            {!sessionsLoading && !sessionsError && sessions.length === 0 && (
              <div className="px-5 py-6 text-center">
                <p className="text-sm text-[#B0B0B0]">No active sessions found</p>
              </div>
            )}

            {/* Sessions list */}
            {!sessionsLoading && !sessionsError && sessions.map((session, i) => (
              <SessionRow
                key={session.id}
                session={session}
                isFirst={i === 0}
                revoking={revokingId === session.id}
                onRevoke={handleRevoke}
              />
            ))}
          </div>

          {/* Security tip */}
          {!sessionsLoading && !sessionsError && sessions.length > 0 && (
            <div className="mt-2 flex items-start gap-2 rounded-2xl border border-warning/20 bg-warning/10 px-4 py-3">
              <Shield size={13} className="mt-0.5 flex-shrink-0 text-warning" />
              <p className="text-[11px] leading-relaxed text-warning">
                Don't recognise a device? Tap <strong>Sign out</strong> to revoke it immediately, then change your password.
              </p>
            </div>
          )}
        </div>

        {/* ── SIGN-IN EVENT LOG ────────────────────────────────────── */}
        <div>
          <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-[#B0B0B0]">
            Sign-in Events
          </p>

          {/* Loading */}
          {historyLoading && (
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-card-dark shadow-sm">
              {[0, 1, 2, 3].map((i) => (
                <div key={i}>
                  {i > 0 && <div className="mx-5 border-t border-white/5" />}
                  <HistorySkeleton />
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {!historyLoading && historyError && (
            <div className="flex items-start gap-3 rounded-3xl border border-error/20 bg-error/10 px-5 py-4">
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-error" />
              <div>
                <p className="text-sm font-semibold text-error">Could not load history</p>
                <p className="mt-0.5 text-xs text-error">{historyError}</p>
              </div>
            </div>
          )}

          {/* Empty */}
          {!historyLoading && !historyError && entries.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-card-dark px-6 py-10 text-center shadow-sm">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-card-dark">
                <Globe size={20} className="text-[#B0B0B0]" />
              </div>
              <p className="font-semibold text-[#B0B0B0]">No sign-in events yet</p>
              <p className="mt-1 text-xs text-[#B0B0B0]">Your login events will appear here.</p>
            </div>
          )}

          {/* Event log */}
          {!historyLoading && !historyError && entries.length > 0 && (
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-card-dark shadow-sm">
              {entries.map((entry, i) => (
                <div key={entry.id}>
                  {i > 0 && <div className="mx-5 border-t border-white/5" />}
                  <div className="flex items-start gap-3 px-5 py-4">

                    {/* Status icon */}
                    <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${entry.success ? "bg-success/10" : "bg-error/10"}`}>
                      {entry.success
                        ? <CheckCircle2 size={15} className="text-success" />
                        : <XCircle size={15} className="text-error" />}
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <DeviceIcon os={entry.os} />
                        <span className="truncate text-[13px] font-semibold text-white">
                          {deviceLabel(entry)}
                        </span>
                      </div>
                      {(entry.os || entry.browser) && (
                        <p className="mt-0.5 truncate text-xs text-[#B0B0B0]">
                          {[entry.os, entry.browser].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {entry.ip && (
                          <span className="font-mono text-[11px] text-[#B0B0B0]">{entry.ip}</span>
                        )}
                        {entry.location && (
                          <span className="text-[11px] text-[#B0B0B0]">{entry.location}</span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="rounded-full bg-border-dark px-2 py-0.5 text-[10px] font-bold text-[#B0B0B0]">
                          {methodLabel(entry.method)}
                        </span>
                        <span className="text-[11px] text-[#B0B0B0]" title={formatDateTime(entry.createdAt)}>
                          {relativeTime(entry.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Success / failed badge */}
                    <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${entry.success ? "bg-success/15 text-success" : "bg-error/15 text-error"}`}>
                      {entry.success ? "Success" : "Failed"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!historyLoading && !historyError && entries.length > 0 && (
            <p className="mt-2 px-1 text-center text-[11px] text-[#B0B0B0]">
              Last 20 events · records older than 90 days are automatically removed
            </p>
          )}
        </div>
      </div>

      {/* ── Toast ─────────────────────────────────────────────────── */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
