import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { adminFetch, isCsrfFetchError } from "@/lib/adminFetcher";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Info,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

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
  return new Date(iso).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });
}

function fmtRelative(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function isBypassActive(bypassUntil: string | null | undefined): boolean {
  if (!bypassUntil) return false;
  return new Date(bypassUntil).getTime() > Date.now();
}

function ProCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`border-border overflow-hidden rounded-2xl border bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  label,
  sub,
  color,
  gradient,
}: {
  icon: typeof Shield;
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

function AvatarInitial({ name }: { name: string | null }) {
  const initials = (name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-400 to-purple-500 text-xs font-bold text-white shadow-sm">
      {initials}
    </div>
  );
}

type BypassUser = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  bypassUntil: string | null;
};

type UserSearchRow = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  otpBypassUntil: string | null;
};

type AuditRow = {
  id: string;
  event: string;
  createdAt: string;
  ip: string;
  userId?: string | null;
  phone?: string | null;
  name?: string | null;
  channel?: string | null;
  result?: string | null;
};

const auditEventLabel: Record<string, string> = {
  admin_otp_bypass_set: "Bypass granted",
  admin_otp_bypass_cancel: "Bypass revoked",
  admin_otp_generate: "OTP generated",
  admin_otp_global_disable: "OTP suspended",
  admin_otp_global_restore: "Suspension lifted",
  admin_clear_otp_attempts: "Rate-limit cleared",
  login_otp_bypass: "Per-user bypass used",
  login_global_otp_bypass: "Global bypass used",
};

const auditEventBadge: Record<string, string> = {
  admin_otp_bypass_set: "bg-blue-50 text-blue-700 border-blue-200",
  admin_otp_bypass_cancel: "bg-gray-50 text-gray-600 border-gray-200",
  admin_otp_global_disable: "bg-orange-50 text-orange-700 border-orange-200",
  admin_otp_global_restore: "bg-green-50 text-green-700 border-green-200",
  admin_clear_otp_attempts: "bg-teal-50 text-teal-700 border-teal-200",
  login_otp_bypass: "bg-blue-50 text-blue-600 border-blue-200",
  login_global_otp_bypass: "bg-orange-50 text-orange-600 border-orange-200",
  admin_otp_generate: "bg-purple-50 text-purple-700 border-purple-200",
};

const auditEventDot: Record<string, string> = {
  admin_otp_bypass_set: "bg-blue-500",
  admin_otp_bypass_cancel: "bg-gray-400",
  admin_otp_global_disable: "bg-orange-500",
  admin_otp_global_restore: "bg-green-500",
  admin_clear_otp_attempts: "bg-teal-500",
  login_otp_bypass: "bg-blue-400",
  login_global_otp_bypass: "bg-orange-400",
  admin_otp_generate: "bg-purple-500",
};

export default function OtpBypassManagement() {
  const { toast } = useToast();

  /* ── Active bypasses ── */
  const [bypasses, setBypasses] = useState<BypassUser[]>([]);
  const [bypassesLoading, setBypassesLoading] = useState(false);
  const [revokingFor, setRevokingFor] = useState<Set<string>>(new Set());

  /* ── Add bypass dialog ── */
  const [addOpen, setAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchRow | null>(null);
  const [bypassMinutes, setBypassMinutes] = useState("60");
  const [bypassReason, setBypassReason] = useState("");
  const [addPending, setAddPending] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);

  /* ── Audit log ── */
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const loadBypasses = useCallback(async () => {
    setBypassesLoading(true);
    try {
      const d = await api("GET", "/otp/bypasses");
      if (d?.bypasses) {
        setBypasses(d.bypasses as BypassUser[]);
      }
    } catch (e) {
      toast({ title: "Failed to load active bypasses", variant: "destructive" });
    } finally {
      setBypassesLoading(false);
    }
  }, [toast]);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const d = await api("GET", "/otp/audit?category=bypass&page=1&limit=50");
      if (d?.entries) {
        setAuditRows(d.entries as AuditRow[]);
      }
    } catch (e) {
      toast({ title: "Failed to load bypass audit log", variant: "destructive" });
    } finally {
      setAuditLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadBypasses();
    void loadAudit();
  }, [loadBypasses, loadAudit]);

  const revokeBypass = async (userId: string, userName: string | null) => {
    setRevokingFor((prev) => new Set(prev).add(userId));
    try {
      await api("DELETE", `/users/${userId}/otp/bypass`);
      toast({ title: "Bypass Revoked", description: `OTP bypass removed for ${userName ?? "user"}.` });
      void loadBypasses();
      void loadAudit();
    } catch (e) {
      if (isCsrfFetchError(e)) return;
      toast({
        title: "Failed to revoke bypass",
        description: errorMessage(e, "Could not remove bypass."),
        variant: "destructive",
      });
    } finally {
      setRevokingFor((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  /* ── Search users for add dialog ── */
  const searchUsers = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchAbortRef.current?.abort();
    const ctrl = new AbortController();
    searchAbortRef.current = ctrl;
    setSearching(true);
    try {
      const d = await adminFetch(`/users/search?q=${encodeURIComponent(q)}&limit=10`, {
        signal: ctrl.signal,
      });
      if (ctrl.signal.aborted) return;
      setSearchResults(
        (d?.users ?? []).map((u: UserSearchRow) => ({
          id: u.id,
          name: u.name,
          phone: u.phone,
          email: u.email ?? null,
          otpBypassUntil: u.otpBypassUntil ?? null,
        }))
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    } finally {
      if (searchAbortRef.current === ctrl) {
        searchAbortRef.current = null;
        setSearching(false);
      }
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchQuery.trim().length >= 2) void searchUsers(searchQuery);
      else setSearchResults([]);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery, searchUsers]);

  useEffect(
    () => () => {
      searchAbortRef.current?.abort();
    },
    []
  );

  const addBypass = async () => {
    if (!selectedUser) return;
    const mins = parseInt(bypassMinutes, 10);
    if (isNaN(mins) || mins < 1 || mins > 525600) {
      toast({ title: "Invalid duration", description: "Minutes must be between 1 and 525600.", variant: "destructive" });
      return;
    }
    if (!bypassReason.trim()) {
      toast({ title: "Reason required", description: "Please provide a reason for the bypass.", variant: "destructive" });
      return;
    }
    setAddPending(true);
    try {
      await api("POST", `/users/${selectedUser.id}/otp/bypass`, {
        minutes: mins,
        reason: bypassReason.trim(),
      });
      toast({
        title: "Bypass Granted",
        description: `OTP bypass active for ${selectedUser.name ?? selectedUser.phone ?? "user"} for ${mins} minute(s).`,
      });
      setAddOpen(false);
      setSelectedUser(null);
      setSearchQuery("");
      setSearchResults([]);
      setBypassMinutes("60");
      setBypassReason("");
      void loadBypasses();
      void loadAudit();
    } catch (e) {
      if (isCsrfFetchError(e)) return;
      if (isApiError(e) && e.status === 409) {
        toast({ title: "Bypass already active", description: errorMessage(e, "User already has an active OTP bypass."), variant: "destructive" });
        return;
      }
      toast({
        title: "Failed to grant bypass",
        description: errorMessage(e, "Could not grant bypass."),
        variant: "destructive",
      });
    } finally {
      setAddPending(false);
    }
  };

  const resetAddDialog = () => {
    setSelectedUser(null);
    setSearchQuery("");
    setSearchResults([]);
    setBypassMinutes("60");
    setBypassReason("");
  };

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-6">
        <PageHeader
          title="OTP Bypass Management"
          subtitle="Manage per-user OTP bypasses and view bypass audit history"
          icon={KeyRound}
        />

        {/* ── Active Bypasses ── */}
        <ProCard>
          <div className="border-border/60 border-b bg-gradient-to-r from-blue-50/80 to-slate-50 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/60 text-blue-600 backdrop-blur-sm">
                  <UserCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Active OTP Bypasses</h3>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    Users currently skipping OTP verification
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {bypasses.length > 0 && (
                  <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                    {bypasses.length} active
                  </span>
                )}
                <Button
                  size="sm"
                  className="h-8 gap-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => {
                    resetAddDialog();
                    setAddOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Bypass
                </Button>
              </div>
            </div>
          </div>

          <div className="p-5">
            {bypassesLoading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading active bypasses…
              </div>
            ) : bypasses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-green-200 bg-green-50/40 py-10 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-300" />
                <p className="text-sm font-medium text-green-700">No active bypasses</p>
                <p className="mt-0.5 text-[11px] text-green-600">
                  All users are required to verify OTP on login
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {bypasses.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/40 px-4 py-3"
                  >
                    <AvatarInitial name={user.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">
                          {user.name ?? "Unnamed"}
                        </p>
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                          <UserCheck className="h-2.5 w-2.5" /> Bypass Active
                        </span>
                      </div>
                      <p className="font-mono text-xs text-gray-500 mt-0.5">
                        {user.phone ?? user.email ?? "—"}
                      </p>
                      {user.bypassUntil && isBypassActive(user.bypassUntil) && (
                        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-blue-700">
                          <Clock className="h-3 w-3" />
                          Expires in {fmtRelative(user.bypassUntil)} — {fmtDate(user.bypassUntil)}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => void revokeBypass(user.id, user.name)}
                      disabled={revokingFor.has(user.id)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
                    >
                      {revokingFor.has(user.id) ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 border-t border-gray-100 pt-3">
              <button
                onClick={() => void loadBypasses()}
                disabled={bypassesLoading}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-gray-600"
              >
                <RefreshCw className={`h-3 w-3 ${bypassesLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </ProCard>

        {/* ── Bypass Audit Log ── */}
        <ProCard>
          <SectionHeader
            icon={Activity}
            label="Bypass Audit Log"
            sub="Last 50 bypass-related admin actions"
            color="text-purple-600"
            gradient="bg-gradient-to-r from-purple-50/80 to-slate-50"
          />
          <div className="p-5">
            {auditLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading audit log…
              </div>
            ) : auditRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/40 py-8 text-center">
                <Clock className="mx-auto mb-2 h-8 w-8 text-gray-200" />
                <p className="text-sm text-gray-400">No bypass events recorded yet</p>
              </div>
            ) : (
              <div className="divide-border/50 divide-y overflow-hidden rounded-xl border">
                {auditRows.map((row) => (
                  <div
                    key={row.id}
                    className="hover:bg-muted/20 flex items-center gap-3 px-3 py-2.5 text-xs transition-colors"
                  >
                    <div
                      className={`h-2 w-2 shrink-0 rounded-full ${auditEventDot[row.event] ?? "bg-gray-400"}`}
                    />
                    <span className="text-muted-foreground hidden w-36 shrink-0 font-mono sm:block">
                      {fmtDate(row.createdAt)}
                    </span>
                    <span className="flex-1 truncate font-semibold text-gray-800">
                      {row.name ?? row.phone ?? row.userId ?? "—"}
                    </span>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${auditEventBadge[row.event] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
                    >
                      {auditEventLabel[row.event] ?? row.event}
                    </span>
                    <span className="text-muted-foreground hidden shrink-0 font-mono md:block">
                      {row.ip}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 border-t border-gray-100 pt-3">
              <button
                onClick={() => void loadAudit()}
                disabled={auditLoading}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-gray-600"
              >
                <RefreshCw className={`h-3 w-3 ${auditLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </ProCard>
      </div>

      {/* ── Add Bypass Dialog ── */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          if (!open) resetAddDialog();
          setAddOpen(open);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <UserCheck className="h-5 w-5 text-blue-600" />
              Grant OTP Bypass
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2 space-y-4">
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <span>
                This bypass allows the user to log in <strong>without receiving an OTP</strong>.
                Requires a reason. Fully audited.
              </span>
            </div>

            {/* User search */}
            {!selectedUser ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Select User
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  {searching && (
                    <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
                  )}
                  <Input
                    className="h-10 rounded-xl pl-10 pr-10 text-sm"
                    placeholder="Search by name, phone, or email…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                </div>

                {searchResults.length > 0 && (
                  <div className="max-h-52 overflow-y-auto rounded-xl border">
                    {searchResults.map((user) => {
                      const active = isBypassActive(user.otpBypassUntil);
                      return (
                        <button
                          key={user.id}
                          onClick={() => {
                            setSelectedUser(user);
                            setSearchQuery("");
                            setSearchResults([]);
                          }}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-b last:border-0"
                        >
                          <AvatarInitial name={user.name} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-sm font-semibold">{user.name ?? "Unnamed"}</p>
                              {active && (
                                <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                                  Bypass Active
                                </span>
                              )}
                            </div>
                            <p className="font-mono text-xs text-gray-400">{user.phone ?? user.email ?? "—"}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                  <p className="rounded-xl border border-dashed border-gray-200 py-4 text-center text-xs text-gray-400">
                    No users found matching "{searchQuery}"
                  </p>
                )}

                {!searchQuery.trim() && (
                  <p className="text-[11px] text-gray-400">
                    <Info className="mr-1 inline h-3 w-3" />
                    Type at least 2 characters to search
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3">
                <div className="flex items-center gap-2.5">
                  <AvatarInitial name={selectedUser.name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{selectedUser.name ?? "Unnamed"}</p>
                    <p className="font-mono text-xs text-gray-500">{selectedUser.phone ?? selectedUser.email ?? "—"}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedUser(null);
                      setSearchQuery("");
                    }}
                    className="shrink-0 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
                  >
                    Change
                  </button>
                </div>
              </div>
            )}

            {/* Duration */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                Duration (minutes)
              </label>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[
                    { label: "15m", val: "15" },
                    { label: "1h", val: "60" },
                    { label: "6h", val: "360" },
                    { label: "24h", val: "1440" },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => setBypassMinutes(opt.val)}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                        bypassMinutes === opt.val
                          ? "border-blue-300 bg-blue-100 text-blue-700"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  value={bypassMinutes}
                  onChange={(e) => setBypassMinutes(e.target.value)}
                  className="h-8 w-20 rounded-lg text-sm"
                  min={1}
                  placeholder="min"
                />
              </div>
              {bypassMinutes && !isNaN(parseInt(bypassMinutes, 10)) && (
                <p className="text-[11px] text-gray-400">
                  <CalendarDays className="mr-1 inline h-3 w-3" />
                  Bypass until{" "}
                  {new Date(Date.now() + parseInt(bypassMinutes, 10) * 60000).toLocaleString("en-PK", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              )}
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={bypassReason}
                onChange={(e) => setBypassReason(e.target.value)}
                placeholder="e.g. User on support call — not receiving SMS on +92301…"
                className="border-input bg-background h-20 w-full resize-none rounded-xl border px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none"
              />
              <p className="text-[11px] text-gray-400">Written to the audit log.</p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => {
                  setAddOpen(false);
                  resetAddDialog();
                }}
                disabled={addPending}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 gap-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => void addBypass()}
                disabled={!selectedUser || !bypassReason.trim() || addPending}
              >
                {addPending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Granting…</>
                ) : (
                  <><UserCheck className="h-3.5 w-3.5" /> Grant Bypass</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ErrorBoundary>
  );
}
