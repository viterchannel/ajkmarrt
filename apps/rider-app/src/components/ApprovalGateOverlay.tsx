import { CheckCircle, Lock, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { tDual } from "@workspace/i18n";
import { api } from "../lib/api";
import { useAuth } from "../lib/rider-auth";
import { useSocket } from "../lib/socket";
import { parseRiderApprovalUpdatePayload } from "../lib/socketEvents";
import { usePlatformConfig } from "../lib/useConfig";
import { useLanguage } from "../lib/useLanguage";

const POLL_INTERVAL_MS = 30_000;

export function ApprovalGateOverlay() {
  const { user, logout, retryConnection } = useAuth();
  const { config } = usePlatformConfig();
  const { language } = useLanguage();
  const T = useCallback((key: Parameters<typeof tDual>[0]) => tDual(key, language), [language]);
  const qc = useQueryClient();
  const { socket, connected } = useSocket();
  const supportPhone = (config.content as { supportPhone?: string } | undefined)?.supportPhone;

  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [socketUpdate, setSocketUpdate] = useState<{ status: "approved" | "rejected"; reason?: string | null } | null>(null);
  const retryConnectionRef = useRef(retryConnection);
  retryConnectionRef.current = retryConnection;

  if (!user || (user.approvalStatus !== "pending" && user.approvalStatus !== "pending_review")) return null;

  qc.clear();

  const submittedAt = user.createdAt ? new Date(user.createdAt as string) : null;
  const submittedLabel = submittedAt
    ? (() => {
        const diffMs = Date.now() - submittedAt.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 2) return "Submitted just now";
        if (diffMin < 60) return `Submitted ${diffMin} minutes ago`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `Submitted ${diffHr} hour${diffHr > 1 ? "s" : ""} ago`;
        return `Submitted on ${submittedAt.toLocaleDateString("en-PK", { day: "numeric", month: "short" })}`;
      })()
    : null;

  return (
    <ApprovalGateOverlayInner
      T={T}
      user={user}
      submittedLabel={submittedLabel}
      supportPhone={supportPhone}
      socket={socket}
      connected={connected}
      lastChecked={lastChecked}
      setLastChecked={setLastChecked}
      socketUpdate={socketUpdate}
      setSocketUpdate={setSocketUpdate}
      retryConnectionRef={retryConnectionRef}
      logout={logout}
    />
  );
}

function ApprovalGateOverlayInner({
  T,
  user,
  submittedLabel,
  supportPhone,
  socket,
  connected,
  lastChecked,
  setLastChecked,
  socketUpdate,
  setSocketUpdate,
  retryConnectionRef,
  logout,
}: {
  T: (key: Parameters<typeof tDual>[0]) => string;
  user: { name?: string; approvalStatus?: string };
  submittedLabel: string | null;
  supportPhone: string | undefined;
  socket: import("socket.io-client").Socket | null;
  connected: boolean;
  lastChecked: Date | null;
  setLastChecked: (d: Date | null) => void;
  socketUpdate: { status: "approved" | "rejected"; reason?: string | null } | null;
  setSocketUpdate: (v: { status: "approved" | "rejected"; reason?: string | null } | null) => void;
  retryConnectionRef: React.MutableRefObject<() => void>;
  logout: (path?: string) => void;
}) {
  useEffect(() => {
    if (!socket) return;
    const onApprovalUpdate = (raw: unknown) => {
      const payload = parseRiderApprovalUpdatePayload(raw);
      if (!payload) return;
      setSocketUpdate({ status: payload.status, reason: payload.reason });
      if (payload.status === "approved" || payload.status === "rejected") {
        setTimeout(() => {
          retryConnectionRef.current();
        }, 1200);
      }
    };
    socket.on("rider:approval_update", onApprovalUpdate);
    return () => {
      socket.off("rider:approval_update", onApprovalUpdate);
    };
  }, [socket, setSocketUpdate, retryConnectionRef]);

  useEffect(() => {
    const poll = async () => {
      try {
        await api.getMe();
        setLastChecked(new Date());
        retryConnectionRef.current();
      } catch (err: unknown) {
        setLastChecked(new Date());
        const code = (err as Record<string, unknown>)?.code as string | undefined;
        if (code === "APPROVAL_REJECTED") {
          retryConnectionRef.current();
        }
      }
    };
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [setLastChecked, retryConnectionRef]);

  const lastCheckedLabel = lastChecked
    ? (() => {
        const diffSec = Math.floor((Date.now() - lastChecked.getTime()) / 1000);
        if (diffSec < 60) return `${diffSec}s ago`;
        return `${Math.floor(diffSec / 60)}m ago`;
      })()
    : null;

  const steps = [
    {
      num: 1,
      label: T("regSubmitted"),
      sub: T("regSubmittedSub"),
      done: true,
      locked: false,
      pulse: false,
    },
    {
      num: 2,
      label: T("docsUnderReview"),
      sub: T("docsUnderReviewSub"),
      done: false,
      locked: false,
      pulse: !socketUpdate,
    },
    {
      num: 3,
      label: T("goOnlineAcceptRides"),
      sub: T("unlocksAfterApproval"),
      done: false,
      locked: true,
      pulse: false,
    },
    {
      num: 4,
      label: T("withdrawEarnings"),
      sub: T("unlocksAfterApprovalBank"),
      done: false,
      locked: true,
      pulse: false,
    },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50 p-5">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-card-dark shadow-xl">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 px-6 pt-8 pb-6 text-white">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-warning/30 bg-warning/15">
            <span className="text-3xl">
              {socketUpdate?.status === "approved" ? "✅" : socketUpdate?.status === "rejected" ? "❌" : "⏳"}
            </span>
          </div>
          <h2 className="mb-1 text-xl font-extrabold">{T("applicationSubmitted")}</h2>
          <p className="text-sm text-[#B0B0B0]">
            {T("welcome")}, <span className="font-semibold text-white">{user.name || T("riderFallback")}</span>
          </p>
          {submittedLabel && <p className="mt-1 text-xs text-[#B0B0B0]">{submittedLabel}</p>}

          <div className="mt-3 flex items-center gap-2">
            <span className={`flex h-2 w-2 rounded-full ${connected ? "bg-success animate-pulse" : "bg-[#B0B0B0]"}`} />
            <span className="text-xs text-[#B0B0B0]">
              {connected ? "Live — watching for approval" : "Offline — checking periodically"}
            </span>
            {!connected && lastCheckedLabel && (
              <span className="ml-auto text-xs text-[#B0B0B0]">
                {lastCheckedLabel}
              </span>
            )}
          </div>
        </div>

        {socketUpdate && (
          <div
            className={`mx-4 mt-4 rounded-2xl p-3 text-sm font-semibold ${
              socketUpdate.status === "approved"
                ? "border border-success/30 bg-success/10 text-success"
                : "border border-error/30 bg-error/10 text-error"
            }`}
          >
            {socketUpdate.status === "approved"
              ? "🎉 Your application was approved! Redirecting…"
              : `❌ Application not approved. ${socketUpdate.reason ?? ""}`}
          </div>
        )}

        <div className="space-y-3 px-6 py-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold tracking-wider text-[#B0B0B0] uppercase">
              {T("applicationProgress")}
            </p>
            {connected ? (
              <span className="flex items-center gap-1 text-[10px] text-success">
                <Wifi size={10} />
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-[#B0B0B0]">
                <WifiOff size={10} />
                {lastCheckedLabel ? `Checked ${lastCheckedLabel}` : "Polling…"}
              </span>
            )}
          </div>
          {steps.map((item) => (
            <div
              key={item.num}
              className={`flex items-start gap-3 rounded-2xl p-3 ${
                item.done
                  ? "border border-success/20 bg-success/10"
                  : item.locked
                    ? "border border-white/10 bg-border-dark"
                    : "border border-warning/20 bg-warning/10"
              }`}
            >
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${
                  item.done
                    ? "bg-success text-white"
                    : item.locked
                      ? "bg-border-dark text-[#B0B0B0]"
                      : "bg-warning text-white"
                }`}
              >
                {item.done ? <CheckCircle size={14} /> : item.locked ? <Lock size={14} /> : item.num}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-bold ${
                    item.done
                      ? "text-success"
                      : item.locked
                        ? "text-[#B0B0B0]"
                        : "text-warning"
                  }`}
                >
                  {item.label}
                </p>
                <p
                  className={`mt-0.5 text-xs ${
                    item.done
                      ? "text-success"
                      : item.locked
                        ? "text-[#B0B0B0]"
                        : "text-warning"
                  } ${item.pulse ? "animate-pulse" : ""}`}
                >
                  {item.sub}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 px-6 pb-6">
          {supportPhone && (
            <a
              href={`tel:${supportPhone}`}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-success py-3 text-sm font-semibold text-white transition-colors hover:bg-success/90"
            >
              📞 {T("contactSupport")}
            </a>
          )}
          <button
            onClick={async () => {
              try {
                logout();
              } finally {
                window.location.reload();
              }
            }}
            className="w-full rounded-2xl bg-border-dark py-3 text-sm font-semibold text-[#B0B0B0] transition-colors hover:bg-[#3A3A3A]"
          >
            {T("signOutLabel")}
          </button>
        </div>
      </div>
    </div>
  );
}
