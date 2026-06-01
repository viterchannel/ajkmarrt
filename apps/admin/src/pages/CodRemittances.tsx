import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageHeader } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LastUpdated } from "@/components/ui/LastUpdated";
import { useToast } from "@/hooks/use-toast";
import { adminFetch } from "@/lib/adminFetcher";
import { formatCurrency } from "@/lib/format";
import { useLanguage } from "@/lib/useLanguage";
import { tDual } from "@workspace/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface Remittance {
  id: string;
  userId: string;
  riderName: string | null;
  riderPhone: string | null;
  amount: number;
  description: string | null;
  reference: string | null;
  status: "pending" | "verified" | "rejected";
  meta: string | null;
  createdAt: string;
}

interface RemittancesResponse {
  data: {
    remittances: Remittance[];
    summary: { pendingAmount: number; verifiedAmount: number; rejectedAmount: number };
    pagination: { page: number; limit: number; total: number; totalPages: number; hasMore: boolean };
  };
}

function useCodRemittances(page: number, status: string, search: string) {
  const params = new URLSearchParams({ page: String(page), limit: "20", status });
  if (search) params.set("search", search);
  return useQuery({
    queryKey: ["admin-cod-remittances", page, status, search],
    queryFn: () =>
      adminFetch(`/cod-remittances?${params.toString()}`) as Promise<RemittancesResponse>,
    staleTime: 15_000,
  });
}

export default function CodRemittances() {
  const { language } = useLanguage();
  const T = useCallback((key: Parameters<typeof tDual>[0]) => tDual(key, language), [language]);
  const { toast } = useToast();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<Remittance | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Remittance | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [verifyNote, setVerifyNote] = useState("");

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(val.trim());
      setPage(1);
    }, 400);
  };

  const { data, isLoading, dataUpdatedAt, refetch } = useCodRemittances(page, statusFilter, search);
  const remittances = data?.data?.remittances ?? [];
  const summary = data?.data?.summary;
  const pagination = data?.data?.pagination;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-cod-remittances"] });

  const verifyMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      adminFetch(`/cod-remittances/${id}/verify`, { method: "PATCH", body: JSON.stringify({ note }) }),
    onSuccess: () => {
      toast({ title: "Remittance verified and wallet credited." });
      setVerifyTarget(null);
      setVerifyNote("");
      invalidate();
    },
    onError: (err) => {
      toast({ title: (err as Error).message ?? "Failed to verify", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminFetch(`/cod-remittances/${id}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      toast({ title: "Remittance rejected." });
      setRejectTarget(null);
      setRejectReason("");
      invalidate();
    },
    onError: (err) => {
      toast({ title: (err as Error).message ?? "Failed to reject", variant: "destructive" });
    },
  });

  const statusColors: Record<string, string> = {
    pending: "bg-warning/15 text-warning border-warning/20",
    verified: "bg-success/15 text-success border-success/20",
    rejected: "bg-error/15 text-error border-error/20",
  };

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-6">
        <PageHeader
          title="COD Remittances"
          subtitle="Review and verify rider cash-on-delivery remittance submissions"
          actions={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw size={14} className="mr-1.5" />
              Refresh
            </Button>
          }
        />

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/15">
                    <Clock size={18} className="text-warning" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pending</p>
                    <p className="text-lg font-bold">{formatCurrency(summary.pendingAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15">
                    <CheckCircle size={18} className="text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Verified</p>
                    <p className="text-lg font-bold">{formatCurrency(summary.verifiedAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-error/15">
                    <XCircle size={18} className="text-error" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Rejected</p>
                    <p className="text-lg font-bold">{formatCurrency(summary.rejectedAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filter row: status tabs + rider search */}
        <div className="flex flex-wrap items-center gap-2">
          {["all", "pending", "verified", "rejected"].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {s}
            </button>
          ))}
          <div className="relative ml-2 flex-1 max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-8 text-xs"
              placeholder="Search rider name or phone…"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <div className="ml-auto">
            {dataUpdatedAt > 0 && <LastUpdated dataUpdatedAt={dataUpdatedAt} />}
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                Loading…
              </div>
            ) : remittances.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                <Banknote size={32} className="opacity-30" />
                <p className="text-sm">No remittances found</p>
              </div>
            ) : (
              <div className="divide-y">
                {remittances.map((r) => (
                  <div key={r.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                      <Banknote size={16} className="text-blue-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {r.riderName ?? "Unknown Rider"}
                        {r.riderPhone && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {r.riderPhone}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {r.description ?? "COD Remittance"} ·{" "}
                        {new Date(r.createdAt).toLocaleString("en-PK", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {r.meta && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Note: {r.meta}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3">
                      <p className="text-sm font-bold">{formatCurrency(r.amount)}</p>
                      <Badge
                        className={`border text-[11px] capitalize ${statusColors[r.status] ?? ""}`}
                        variant="outline"
                      >
                        {r.status}
                      </Badge>
                      {r.status === "pending" && (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 border-success text-success hover:bg-success/10"
                            onClick={() => setVerifyTarget(r)}
                          >
                            <CheckCircle size={12} className="mr-1" />
                            Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 border-destructive text-destructive hover:bg-destructive/10"
                            onClick={() => setRejectTarget(r)}
                          >
                            <XCircle size={12} className="mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={14} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!pagination.hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}

        {/* Verify Dialog */}
        <Dialog open={!!verifyTarget} onOpenChange={(o) => !o && setVerifyTarget(null)}>
          <DialogContent>
            <DialogTitle>Verify Remittance</DialogTitle>
            {verifyTarget && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Mark this remittance as verified and credit{" "}
                  <strong>{formatCurrency(verifyTarget.amount)}</strong> back to{" "}
                  <strong>{verifyTarget.riderName ?? "rider"}</strong>'s wallet.
                </p>
                <div className="space-y-1.5">
                  <Label>Note (optional)</Label>
                  <Input
                    value={verifyNote}
                    onChange={(e) => setVerifyNote(e.target.value)}
                    placeholder="e.g. Cash received at head office"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setVerifyTarget(null)}>
                    Cancel
                  </Button>
                  <Button
                    className="bg-success text-white hover:bg-success/90"
                    disabled={verifyMutation.isPending}
                    onClick={() => verifyMutation.mutate({ id: verifyTarget.id, note: verifyNote })}
                  >
                    {verifyMutation.isPending ? "Processing…" : "Verify & Credit Wallet"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
          <DialogContent>
            <DialogTitle>Reject Remittance</DialogTitle>
            {rejectTarget && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Reject the remittance of{" "}
                  <strong>{formatCurrency(rejectTarget.amount)}</strong> from{" "}
                  <strong>{rejectTarget.riderName ?? "rider"}</strong>. The rider will need to
                  resubmit.
                </p>
                <div className="space-y-1.5">
                  <Label>Rejection Reason *</Label>
                  <Input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. Transaction ID not found"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setRejectTarget(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={rejectMutation.isPending || !rejectReason.trim()}
                    onClick={() =>
                      rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason })
                    }
                  >
                    {rejectMutation.isPending ? "Rejecting…" : "Reject"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
