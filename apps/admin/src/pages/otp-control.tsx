import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  usePlatformSettings,
  useUpdatePlatformSettings,
} from "@/hooks/use-admin";
import { useToast } from "@/hooks/use-toast";
import { adminFetch } from "@/lib/adminFetcher";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import {
  Activity,
  AlertTriangle,
  CheckCheck,
  ChevronRight,
  Clock,
  Gauge,
  GripVertical,
  Info,
  ListChecks,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldCheck,
  ShieldOff,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useCallback, useEffect, useState, type ElementType, type ReactNode } from "react";

interface ApiError {
  status?: number;
  message?: string;
}

function isApiError(value: unknown): value is ApiError {
  return typeof value === "object" && value != null && ("status" in value || "message" in value);
}

function errorMessage(value: unknown, fallback = "Something went wrong"): string {
  if (isApiError(value) && typeof value.message === "string" && value.message.length > 0) {
    return value.message;
  }
  if (value instanceof Error) return value.message;
  return fallback;
}

async function api(method: string, path: string, body?: unknown) {
  return adminFetch(path, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type OTPStatus = {
  isGloballyDisabled: boolean;
  disabledUntil: string | null;
  activeBypassCount: number;
};

type OtpAuditEvent =
  | "admin_otp_bypass_set"
  | "admin_otp_bypass_cancel"
  | "admin_otp_generate"
  | "admin_otp_global_disable"
  | "admin_otp_global_restore"
  | "admin_clear_otp_attempts"
  | "login_otp_bypass"
  | "login_global_otp_bypass"
  | "otp_send_bypassed"
  | "otp_send_global_bypassed"
  | "otp_sent"
  | "otp_verified"
  | "otp_verified_new_user"
  | "otp_failed"
  | "otp_reuse_attempt"
  | "otp_expired"
  | "otp_rate_limit_exceeded";

type AuditCategory = "fail" | "bypass" | "admin";

type AuditRow = {
  id: string;
  event: OtpAuditEvent;
  createdAt: string;
  ip: string;
  userId?: string | null;
  phone?: string | null;
  name?: string | null;
  channel?: string | null;
  result?: string | null;
};

/* ── Design primitives ───────────────────────────────────────────────────── */

function ProCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`border-border overflow-hidden rounded-2xl border bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({
  icon: Icon,
  label,
  sub,
  color,
  gradient,
}: {
  icon: ElementType;
  label: string;
  sub?: string;
  color: string;
  gradient: string;
}) {
  return (
    <div className={`border-border/60 border-b px-5 py-4 ${gradient}`}>
      <div className="flex items-center gap-2.5">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color} bg-white/60 backdrop-blur-sm`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-display text-sm leading-none font-bold text-gray-900">{label}</h3>
          {sub && <p className="mt-0.5 text-[11px] text-gray-500">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

/* ── OTP Channel Priority ──────────────────────────────────────────────────── */

type OtpChannel = "sms" | "whatsapp" | "email";

const CHANNEL_META: Record<
  OtpChannel,
  { label: string; desc: string; Icon: ElementType; dot: string; ring: string; badge: string }
> = {
  sms: {
    label: "SMS",
    desc: "Standard text message via your SMS provider",
    Icon: MessageSquare,
    dot: "bg-blue-500",
    ring: "border-blue-200 bg-blue-50",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
  },
  whatsapp: {
    label: "WhatsApp",
    desc: "WhatsApp Business API message",
    Icon: MessageCircle,
    dot: "bg-green-500",
    ring: "border-green-200 bg-green-50",
    badge: "bg-green-100 text-green-700 border-green-200",
  },
  email: {
    label: "Email",
    desc: "Email delivery — slowest but most reliable fallback",
    Icon: Mail,
    dot: "bg-orange-500",
    ring: "border-orange-200 bg-orange-50",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
  },
};

function OtpChannelsSection() {
  const { toast } = useToast();
  const [channels, setChannels] = useState<OtpChannel[]>(["whatsapp", "sms", "email"]);
  const [saved, setSaved] = useState<OtpChannel[]>(["whatsapp", "sms", "email"]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const d = await api("GET", "/otp/channels");
        if (d?.channels) {
          const ch = (d.channels as string[]).filter((c): c is OtpChannel =>
            ["sms", "whatsapp", "email"].includes(c)
          );
          setChannels(ch);
          setSaved(ch);
        }
      } catch (error) {
        console.debug("[OtpControl] OTP channels fetch failed, keeping defaults:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isDirty = channels.join(",") !== saved.join(",");

  function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const next = [...channels];
    const [moved] = next.splice(result.source.index, 1);
    if (!moved) return;
    next.splice(result.destination.index, 0, moved);
    setChannels(next);
  }

  async function save() {
    setSaving(true);
    try {
      const d = await api("PATCH", "/otp/channels", { channels });
      if (d?.channels) {
        const ch = (d.channels as string[]).filter((c): c is OtpChannel =>
          ["sms", "whatsapp", "email"].includes(c)
        );
        setChannels(ch);
        setSaved(ch);
      } else {
        setSaved(channels);
      }
      toast({ title: "Channel order saved", description: `Priority: ${channels.join(" → ")}` });
    } catch (e: unknown) {
      toast({
        title: "Failed to save",
        description: errorMessage(e, "Could not update channel priority."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function revert() {
    setChannels([...saved]);
  }

  return (
    <ProCard>
      <div className="border-border/60 border-b bg-gradient-to-r from-sky-50/80 to-slate-50 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/60 text-sky-600 backdrop-blur-sm">
            <ListChecks className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-sm leading-none font-bold text-gray-900">
              OTP Channel Priority
            </h3>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Drag to reorder. First channel is tried first; others are automatic fallbacks.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading channels…
          </div>
        ) : (
          <>
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="otp-channels">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                    {channels.map((ch, idx) => {
                      const meta = CHANNEL_META[ch];
                      const isFirst = idx === 0;
                      return (
                        <Draggable key={ch} draggableId={ch} index={idx}>
                          {(prov, snapshot) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-shadow ${
                                snapshot.isDragging
                                  ? "border-sky-200 bg-sky-50/60 shadow-lg ring-2 ring-sky-300"
                                  : `${meta.ring} hover:shadow-sm`
                              }`}
                            >
                              <div
                                {...prov.dragHandleProps}
                                className="shrink-0 cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing"
                                title="Drag to reorder"
                              >
                                <GripVertical className="h-5 w-5" />
                              </div>

                              <div
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                                  isFirst ? "bg-sky-600 text-white" : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                {idx + 1}
                              </div>

                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${meta.ring}`}
                              >
                                <meta.Icon className={`h-4 w-4 ${isFirst ? "opacity-100" : "opacity-60"}`} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-900">
                                    {meta.label}
                                  </span>
                                  <span
                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.badge}`}
                                  >
                                    {isFirst ? "Primary" : `Fallback ${idx + 1}`}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[11px] text-gray-400">{meta.desc}</p>
                              </div>

                              <div
                                className={`h-2 w-2 shrink-0 rounded-full ${meta.dot} ${
                                  isFirst ? "opacity-100" : "opacity-30"
                                }`}
                              />
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-1 text-[11px]">
              <span className="font-medium text-gray-600">Delivery order:</span>
              {channels.map((ch, idx) => (
                <span key={ch} className="flex items-center gap-1">
                  <span className={`rounded-md border px-1.5 py-0.5 font-semibold ${CHANNEL_META[ch].badge}`}>
                    {CHANNEL_META[ch].label}
                  </span>
                  {idx < channels.length - 1 && <ChevronRight className="h-3 w-3 text-gray-300" />}
                </span>
              ))}
            </div>

            {isDirty && (
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={revert}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  Revert
                </button>
                <button
                  onClick={() => void save()}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCheck className="h-3 w-3" />
                  )}
                  Save Order
                </button>
              </div>
            )}
            {!isDirty && (
              <p className="text-muted-foreground mt-3 text-right text-[11px]">
                Saved order: <span className="font-medium">{saved.join(" → ")}</span>
              </p>
            )}
          </>
        )}
      </div>
    </ProCard>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */

const eventLabel: Partial<Record<OtpAuditEvent, string>> = {
  admin_otp_bypass_set: "Bypass granted",
  admin_otp_bypass_cancel: "Bypass revoked",
  admin_otp_generate: "OTP generated",
  admin_otp_global_disable: "OTP suspended",
  admin_otp_global_restore: "Suspension lifted",
  admin_clear_otp_attempts: "Rate-limit cleared",
  login_otp_bypass: "Per-user bypass used",
  login_global_otp_bypass: "Global bypass used",
  otp_send_bypassed: "OTP send bypassed",
  otp_send_global_bypassed: "OTP send (global bypass)",
  otp_failed: "OTP failed",
  otp_reuse_attempt: "Reuse attempt",
  otp_expired: "OTP expired",
  otp_rate_limit_exceeded: "Rate limit exceeded",
};

const eventColors: Partial<Record<OtpAuditEvent, string>> = {
  admin_otp_bypass_set: "bg-blue-500",
  admin_otp_bypass_cancel: "bg-gray-400",
  admin_otp_generate: "bg-purple-500",
  admin_otp_global_disable: "bg-orange-500",
  admin_otp_global_restore: "bg-green-500",
  admin_clear_otp_attempts: "bg-teal-500",
  login_otp_bypass: "bg-blue-400",
  login_global_otp_bypass: "bg-orange-400",
  otp_send_bypassed: "bg-purple-400",
  otp_send_global_bypassed: "bg-purple-300",
  otp_failed: "bg-red-400",
  otp_reuse_attempt: "bg-red-500",
  otp_expired: "bg-amber-400",
  otp_rate_limit_exceeded: "bg-rose-500",
};

const eventBadgeColors: Partial<Record<OtpAuditEvent, string>> = {
  admin_otp_bypass_set: "bg-blue-50 text-blue-700 border-blue-200",
  admin_otp_bypass_cancel: "bg-gray-50 text-gray-600 border-gray-200",
  admin_otp_generate: "bg-purple-50 text-purple-700 border-purple-200",
  admin_otp_global_disable: "bg-orange-50 text-orange-700 border-orange-200",
  admin_otp_global_restore: "bg-green-50 text-green-700 border-green-200",
  admin_clear_otp_attempts: "bg-teal-50 text-teal-700 border-teal-200",
  login_otp_bypass: "bg-blue-50 text-blue-600 border-blue-200",
  login_global_otp_bypass: "bg-orange-50 text-orange-600 border-orange-200",
  otp_send_bypassed: "bg-purple-50 text-purple-600 border-purple-200",
  otp_send_global_bypassed: "bg-purple-50 text-purple-500 border-purple-200",
  otp_failed: "bg-red-50 text-red-600 border-red-200",
  otp_reuse_attempt: "bg-red-50 text-red-700 border-red-200",
  otp_expired: "bg-amber-50 text-amber-600 border-amber-200",
  otp_rate_limit_exceeded: "bg-rose-50 text-rose-700 border-rose-200",
};

const AUDIT_TABS: { key: AuditCategory; label: string }[] = [
  { key: "fail", label: "Failures & Suspicious" },
  { key: "bypass", label: "Bypass Events" },
  { key: "admin", label: "Admin Actions" },
];

export default function OtpControl() {
  const { toast } = useToast();

  const [status, setStatus] = useState<OTPStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [togglePending, setTogglePending] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);

  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditCategory, setAuditCategory] = useState<AuditCategory>("fail");
  const [auditSearch, setAuditSearch] = useState("");

  const { data: settingsData } = usePlatformSettings();
  const updateSettings = useUpdatePlatformSettings();
  const getSetting = useCallback(
    (key: string, fallback: string) =>
      (settingsData?.settings ?? []).find((s: { key: string; value: string }) => s.key === key)
        ?.value ?? fallback,
    [settingsData?.settings]
  );
  const [rlPhone, setRlPhone] = useState("");
  const [rlIp, setRlIp] = useState("");
  const [rlWindow, setRlWindow] = useState("");
  const [rlSaving, setRlSaving] = useState(false);

  useEffect(() => {
    if (settingsData?.settings?.length > 0) {
      setRlPhone(getSetting("security_otp_max_per_phone", "5"));
      setRlIp(getSetting("security_otp_max_per_ip", "20"));
      setRlWindow(getSetting("security_otp_window_min", "60"));
    }
  }, [settingsData, getSetting]);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const d = await api("GET", "/otp/status");
      if (d) setStatus(d as OTPStatus);
    } catch (_err) {
      toast({ title: "Failed to load OTP status", variant: "destructive" });
    } finally {
      setStatusLoading(false);
    }
  }, [toast]);

  const loadAudit = useCallback(
    async (category: AuditCategory = "fail") => {
      setAuditLoading(true);
      setAuditCategory(category);
      try {
        const params = new URLSearchParams({ page: "1", limit: "100" });
        params.set("category", category);
        const d = await api("GET", `/otp/audit?${params.toString()}`);
        if (d?.entries) {
          setAuditRows(d.entries as AuditRow[]);
        }
      } catch (err) {
        toast({
          title: "Failed to load audit log",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setAuditLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    void loadStatus();
    void loadAudit("fail");
  }, [loadStatus, loadAudit]);

  const handleEnableSuspend = () => {
    setSuspendReason("");
    setShowSuspendConfirm(true);
  };

  const confirmSuspend = async () => {
    if (!suspendReason.trim()) return;
    setTogglePending(true);
    try {
      await api("POST", "/otp/disable", { reason: suspendReason.trim() });
      toast({
        title: "OTP Suspended",
        description: "OTP verification is now OFF. Users can log in without OTP code.",
        variant: "destructive",
      });
      void loadStatus();
      void loadAudit(auditCategory);
      setShowSuspendConfirm(false);
      setSuspendReason("");
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: errorMessage(e, "Failed to suspend OTP."),
        variant: "destructive",
      });
    } finally {
      setTogglePending(false);
    }
  };

  const restoreOtp = async () => {
    setTogglePending(true);
    try {
      await api("DELETE", "/otp/disable");
      toast({ title: "OTP Restored", description: "OTP verification is active again." });
      void loadStatus();
      void loadAudit(auditCategory);
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: errorMessage(e, "Failed to restore OTP."),
        variant: "destructive",
      });
    } finally {
      setTogglePending(false);
    }
  };

  const saveRateLimits = async () => {
    const phone = parseInt(rlPhone, 10);
    const ip = parseInt(rlIp, 10);
    const win = parseInt(rlWindow, 10);
    if (isNaN(phone) || phone < 1 || isNaN(ip) || ip < 1 || isNaN(win) || win < 1) {
      toast({
        title: "Invalid values",
        description: "All rate limit fields must be positive integers.",
        variant: "destructive",
      });
      return;
    }
    setRlSaving(true);
    try {
      await updateSettings.mutateAsync([
        { key: "security_otp_max_per_phone", value: String(phone) },
        { key: "security_otp_max_per_ip", value: String(ip) },
        { key: "security_otp_window_min", value: String(win) },
      ]);
      toast({ title: "Rate limits saved", description: "OTP rate limiting settings updated." });
    } catch (e: unknown) {
      toast({
        title: "Failed to save",
        description: errorMessage(e, "Could not update rate limit settings."),
        variant: "destructive",
      });
    } finally {
      setRlSaving(false);
    }
  };

  const filteredAuditRows = auditSearch.trim()
    ? auditRows.filter((r) => {
        const q = auditSearch.toLowerCase();
        return (
          (r.name ?? "").toLowerCase().includes(q) ||
          (r.phone ?? "").includes(q) ||
          (r.ip ?? "").includes(q) ||
          (r.userId ?? "").includes(q)
        );
      })
    : auditRows;

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-6">
        <PageHeader
          title="OTP Control Center"
          subtitle="Global OTP toggle, delivery channel priority, rate limits and audit log"
          icon={Shield}
        />

        {/* ── 1. GLOBAL OTP TOGGLE ── */}
        <ProCard>
          <CardHeader
            icon={status?.isGloballyDisabled ? ShieldOff : ShieldCheck}
            label="Global OTP Toggle"
            sub="Enable or disable OTP verification platform-wide"
            color={status?.isGloballyDisabled ? "text-red-600" : "text-green-600"}
            gradient={
              status?.isGloballyDisabled
                ? "bg-gradient-to-r from-red-50/80 to-slate-50"
                : "bg-gradient-to-r from-green-50/80 to-slate-50"
            }
          />
          <div className="p-5 space-y-4">
            {statusLoading && !status ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking OTP status…
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        if (status?.isGloballyDisabled) {
                          void restoreOtp();
                        } else {
                          handleEnableSuspend();
                        }
                      }}
                      disabled={togglePending || statusLoading}
                      className="shrink-0 disabled:opacity-60"
                      aria-label="Toggle OTP"
                    >
                      {status?.isGloballyDisabled ? (
                        <ToggleLeft className="h-10 w-10 text-red-500" />
                      ) : (
                        <ToggleRight className="h-10 w-10 text-green-500" />
                      )}
                    </button>
                    <div>
                      <p className="text-base font-bold text-gray-900">
                        OTP is{" "}
                        <span className={status?.isGloballyDisabled ? "text-red-600" : "text-green-600"}>
                          {status?.isGloballyDisabled ? "SUSPENDED" : "ACTIVE"}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {status?.isGloballyDisabled
                          ? "Users can log in without receiving an OTP code"
                          : "All users must verify OTP on login"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-gray-400 font-medium">Active bypasses</p>
                    <p className="text-lg font-bold text-gray-700">{status?.activeBypassCount ?? 0}</p>
                  </div>
                </div>

                {status?.isGloballyDisabled && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <div>
                      <p className="font-semibold">OTP suspended — registrations are unverified</p>
                      <p className="mt-0.5 text-xs text-red-700">
                        Users are logging in without OTP verification. Toggle OTP back ON when the
                        SMS gateway is restored.
                      </p>
                    </div>
                  </div>
                )}

                {!status?.isGloballyDisabled && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                    <span>
                      Toggle OFF only when the SMS gateway is down. There are no pre-set timers —
                      you must manually turn OTP back ON.
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </ProCard>

        {/* ── Suspend Confirmation ── */}
        {showSuspendConfirm && (
          <ProCard className="border-red-200">
            <div className="bg-gradient-to-r from-red-50/80 to-slate-50 border-b border-red-200 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/60 text-red-600 backdrop-blur-sm">
                  <ShieldOff className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Confirm OTP Suspension</h3>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    OTP will stay OFF until you manually turn it back ON
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <span>
                  <strong>No auto-resume.</strong> OTP will remain suspended until you come back
                  here and toggle it ON. Users will be able to log in without OTP code during this
                  window.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold tracking-wider uppercase text-gray-700">
                  Reason for suspension <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="e.g. SMS gateway outage — Twilio down, users cannot receive OTP codes"
                  className="border-input bg-background h-20 w-full resize-none rounded-xl border px-3 py-2.5 text-sm focus:ring-2 focus:ring-red-300 focus:outline-none"
                />
                <p className="text-[11px] text-gray-400">
                  Reason is written to the audit log and included in the admin alert email.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => {
                    setShowSuspendConfirm(false);
                    setSuspendReason("");
                  }}
                  disabled={togglePending}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 gap-1.5 rounded-xl"
                  onClick={() => void confirmSuspend()}
                  disabled={!suspendReason.trim() || togglePending}
                >
                  {togglePending ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Suspending…</>
                  ) : (
                    <><ShieldOff className="h-3.5 w-3.5" /> Suspend OTP</>
                  )}
                </Button>
              </div>
            </div>
          </ProCard>
        )}

        {/* ── 2. OTP CHANNEL PRIORITY ── */}
        <OtpChannelsSection />

        {/* ── 3. RATE LIMITING ── */}
        <ProCard>
          <CardHeader
            icon={Gauge}
            label="OTP Rate Limiting"
            sub="Max OTP requests per phone/IP before the user is throttled"
            color="text-orange-600"
            gradient="bg-gradient-to-r from-orange-50/80 to-slate-50"
          />
          <div className="space-y-5 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <span className="h-2 w-2 rounded-full bg-orange-400" />
                  Max per phone
                </label>
                <Input
                  type="number"
                  value={rlPhone}
                  onChange={(e) => setRlPhone(e.target.value)}
                  className="h-9 rounded-xl text-sm"
                  min={1}
                  max={100}
                  placeholder="5"
                />
                <p className="text-muted-foreground text-[10px]">OTPs per phone per window</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <span className="h-2 w-2 rounded-full bg-rose-400" />
                  Max per IP
                </label>
                <Input
                  type="number"
                  value={rlIp}
                  onChange={(e) => setRlIp(e.target.value)}
                  className="h-9 rounded-xl text-sm"
                  min={1}
                  max={500}
                  placeholder="20"
                />
                <p className="text-muted-foreground text-[10px]">OTPs per IP per window</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  Window (minutes)
                </label>
                <Input
                  type="number"
                  value={rlWindow}
                  onChange={(e) => setRlWindow(e.target.value)}
                  className="h-9 rounded-xl text-sm"
                  min={1}
                  max={1440}
                  placeholder="60"
                />
                <p className="text-muted-foreground text-[10px]">Rolling window duration</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Button
                size="sm"
                className="gap-1.5 rounded-xl bg-orange-600 text-white hover:bg-orange-700"
                onClick={() => void saveRateLimits()}
                disabled={rlSaving || updateSettings.isPending}
              >
                {rlSaving ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                ) : (
                  "Save Rate Limits"
                )}
              </Button>
              <p className="text-muted-foreground text-xs">
                Changes apply to new OTP requests immediately.
              </p>
            </div>
          </div>
        </ProCard>

        {/* ── 4. OTP AUDIT LOG (filtered) ── */}
        <ProCard>
          <CardHeader
            icon={Activity}
            label="OTP Audit Log"
            sub="Failures, suspicious activity and admin actions — last 100 events"
            color="text-purple-600"
            gradient="bg-gradient-to-r from-purple-50/80 to-slate-50"
          />
          <div className="p-5 space-y-4">
            {/* Tabs */}
            <div className="flex flex-wrap gap-1.5">
              {AUDIT_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => void loadAudit(key)}
                  className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
                    auditCategory === key
                      ? "border-purple-300 bg-purple-100 text-purple-800"
                      : "border-border text-muted-foreground hover:bg-muted/40 bg-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Input
                className="h-9 rounded-xl pl-3 pr-4 text-sm"
                placeholder="Search by name, phone, or IP…"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
              />
            </div>

            {auditLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading audit log…
              </div>
            ) : filteredAuditRows.length === 0 ? (
              <div className="text-muted-foreground bg-muted/10 border-border rounded-xl border border-dashed py-8 text-center text-sm">
                <Clock className="text-muted-foreground/40 mx-auto mb-2 h-8 w-8" />
                {auditSearch ? "No events match your search" : "No events in this category yet"}
              </div>
            ) : (
              <div className="divide-border/50 divide-y overflow-hidden rounded-xl border">
                {filteredAuditRows.map((row) => (
                  <div
                    key={row.id}
                    className="hover:bg-muted/20 flex items-center gap-3 px-3 py-2.5 text-xs transition-colors"
                  >
                    <div
                      className={`h-2 w-2 shrink-0 rounded-full ${eventColors[row.event] ?? "bg-gray-400"}`}
                    />
                    <span className="text-muted-foreground hidden w-36 shrink-0 font-mono sm:block">
                      {fmtDate(row.createdAt)}
                    </span>
                    <span className="text-foreground flex-1 truncate font-semibold">
                      {row.name ?? row.phone ?? row.userId ?? "—"}
                    </span>
                    {row.channel && (
                      <span className="border-border text-muted-foreground hidden shrink-0 rounded border bg-white px-1.5 py-0.5 font-mono text-[10px] sm:block">
                        {row.channel}
                      </span>
                    )}
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${eventBadgeColors[row.event] ?? "bg-muted text-muted-foreground border-border"}`}
                    >
                      {eventLabel[row.event] ?? row.event}
                    </span>
                    {row.result && row.result !== "success" && (
                      <span className="shrink-0 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                        {row.result}
                      </span>
                    )}
                    <span className="text-muted-foreground hidden shrink-0 font-mono md:block">
                      {row.ip}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="border-border/50 flex items-center justify-between border-t pt-3">
              <button
                onClick={() => void loadAudit(auditCategory)}
                disabled={auditLoading}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
              >
                <RefreshCw className={`h-3 w-3 ${auditLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              {filteredAuditRows.length > 0 && (
                <span className="text-[11px] text-gray-400">
                  {filteredAuditRows.length} event{filteredAuditRows.length !== 1 ? "s" : ""}
                  {auditSearch ? " (filtered)" : ""}
                </span>
              )}
            </div>
          </div>
        </ProCard>
      </div>
    </ErrorBoundary>
  );
}
