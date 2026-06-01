import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PullToRefresh } from "@/components/PullToRefresh";
import { PageHeader, StatCard, StatCardSkeleton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useBulkRiderApproval, usePendingRiders, useRiderApproval } from "@/hooks/use-admin";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  Phone,
  RefreshCw,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { useCallback, useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface PendingRider {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  cnic: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  approvalStatus: string;
  approvalNote: string | null;
  createdAt: string;
  vehicleType: string | null;
  vehiclePlate: string | null;
  drivingLicense: string | null;
  vehiclePhoto: string | null;
  regDocUrl: string | null;
  documents: string | null;
}

/** Validates that a URL uses http or https — rejects javascript: and data: URLs. */
function safeDocUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const { protocol } = new URL(url);
    if (protocol === "https:" || protocol === "http:") return url;
  } catch {
    // malformed URL — treat as absent
  }
  return null;
}

function DocumentLink({
  label,
  url,
}: {
  label: string;
  url: string | null | undefined;
}) {
  const safe = safeDocUrl(url);
  if (!safe)
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-400">
        <FileText className="h-3.5 w-3.5" />
        <span>{label}</span>
        <span className="ml-auto italic">{url && !safe ? "Invalid URL" : "Not uploaded"}</span>
      </div>
    );
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700 hover:bg-blue-100 transition-colors"
    >
      <FileText className="h-3.5 w-3.5" />
      <span>{label}</span>
      <ExternalLink className="ml-auto h-3 w-3" />
    </a>
  );
}

function RiderDocumentsModal({
  rider,
  onClose,
  onApprove,
  onReject,
  isPending,
}: {
  rider: PendingRider;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
}) {
  let parsedDocs: Record<string, string> = {};
  if (rider.documents) {
    try {
      parsedDocs = JSON.parse(rider.documents) as Record<string, string>;
    } catch {
      parsedDocs = {};
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[95vw] max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-blue-600" />
            {rider.name || "Unnamed Rider"} — Documents
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          {/* Personal Info */}
          <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Personal Information
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div>
                <span className="font-semibold text-muted-foreground">Phone: </span>
                {rider.phone || "—"}
              </div>
              <div>
                <span className="font-semibold text-muted-foreground">Email: </span>
                {rider.email || "—"}
              </div>
              <div>
                <span className="font-semibold text-muted-foreground">CNIC: </span>
                {rider.cnic || "—"}
              </div>
              <div>
                <span className="font-semibold text-muted-foreground">City: </span>
                {rider.city || "—"}
              </div>
              <div className="col-span-2">
                <span className="font-semibold text-muted-foreground">Address: </span>
                {rider.address || "—"}
              </div>
            </div>
          </div>

          {/* Vehicle Info */}
          <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Vehicle Information
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div>
                <span className="font-semibold text-muted-foreground">Type: </span>
                {rider.vehicleType || "—"}
              </div>
              <div>
                <span className="font-semibold text-muted-foreground">Plate: </span>
                {rider.vehiclePlate || "—"}
              </div>
              <div className="col-span-2">
                <span className="font-semibold text-muted-foreground">License No: </span>
                {rider.drivingLicense || "—"}
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Uploaded Documents
            </p>
            <div className="space-y-1.5">
              <DocumentLink label="CNIC Front" url={parsedDocs["cnic_front"]} />
              <DocumentLink label="CNIC Back" url={parsedDocs["cnic_back"]} />
              <DocumentLink label="Driving License" url={parsedDocs["license"]} />
              <DocumentLink label="Vehicle Photo" url={rider.vehiclePhoto || parsedDocs["vehicle_photo"]} />
              <DocumentLink label="Registration Document" url={rider.regDocUrl || parsedDocs["reg_doc"]} />
            </div>
          </div>

          {/* Applied on */}
          <p className="text-center text-xs text-muted-foreground">
            Applied {formatDate(rider.createdAt)}
          </p>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={onClose}
              disabled={isPending}
            >
              Close
            </Button>
            <Button
              variant="outline"
              onClick={onReject}
              disabled={isPending}
              className="flex-1 gap-1.5 rounded-xl border-red-200 text-red-700 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4" /> Reject
            </Button>
            <Button
              onClick={onApprove}
              disabled={isPending}
              className="flex-1 gap-1.5 rounded-xl bg-green-600 text-white hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4" /> Approve
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RejectReasonDialog({
  rider,
  onClose,
  onConfirm,
  isPending,
}: {
  rider: PendingRider;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState("");

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[95vw] max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Reject Rider Application</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-3">
          <p className="text-sm text-muted-foreground">
            You are rejecting the application for{" "}
            <span className="font-semibold text-foreground">{rider.name || rider.phone}</span>.
            Please provide a reason that will be sent to the rider.
          </p>
          <Input
            placeholder="Reason for rejection (required)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            className="h-11 rounded-xl border-red-200"
          />
          <p className="text-right text-xs text-muted-foreground">{reason.length}/500</p>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => onConfirm(reason)}
              disabled={isPending || !reason.trim()}
              className="flex-1 rounded-xl bg-red-600 text-white hover:bg-red-700"
            >
              {isPending ? "Rejecting..." : "Confirm Reject"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PendingRiders() {
  const { data, isLoading, refetch, isFetching } = usePendingRiders();
  const approvalMutation = useRiderApproval();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [docModal, setDocModal] = useState<PendingRider | null>(null);
  const [rejectModal, setRejectModal] = useState<PendingRider | null>(null);
  const [approveConfirm, setApproveConfirm] = useState<PendingRider | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const bulkMutation = useBulkRiderApproval();

  const riders: PendingRider[] = (data as any)?.riders || [];

  const handleApprove = useCallback(
    (rider: PendingRider) => {
      approvalMutation.mutate(
        { id: rider.id, status: "approved" },
        {
          onSuccess: () => {
            toast({ title: "Rider approved", description: `${rider.name || rider.phone} can now accept rides.` });
            setDocModal(null);
            setApproveConfirm(null);
          },
          onError: (e: any) =>
            toast({ title: "Approval failed", description: e.message, variant: "destructive" }),
        }
      );
    },
    [approvalMutation, toast]
  );

  const handleReject = useCallback(
    (rider: PendingRider, reason: string) => {
      approvalMutation.mutate(
        { id: rider.id, status: "rejected", reason },
        {
          onSuccess: () => {
            toast({ title: "Rider rejected", description: `${rider.name || rider.phone} has been notified.` });
            setRejectModal(null);
            setDocModal(null);
          },
          onError: (e: any) =>
            toast({ title: "Rejection failed", description: e.message, variant: "destructive" }),
        }
      );
    },
    [approvalMutation, toast]
  );

  const allSelected = riders.length > 0 && riders.every((r) => selectedIds.has(r.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(allSelected ? new Set() : new Set(riders.map((r) => r.id)));
  }, [allSelected, riders]);

  const handleBulkApprove = useCallback(() => {
    const ids = [...selectedIds];
    bulkMutation.mutate(ids, {
      onSuccess: (result: any) => {
        const count: number = result?.data?.approved ?? ids.length;
        const skipped: number = result?.data?.skipped ?? 0;
        toast({
          title: `${count} rider${count !== 1 ? "s" : ""} approved`,
          description:
            skipped > 0
              ? `${skipped} already processed or not found.`
              : "All selected riders approved and notified.",
        });
        setSelectedIds(new Set());
        setBulkConfirm(false);
      },
      onError: (e: any) => {
        setBulkConfirm(false);
        toast({ title: "Bulk approval failed", description: e.message, variant: "destructive" });
      },
    });
  }, [selectedIds, bulkMutation, toast]);

  const handlePullRefresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["admin-pending-riders"] });
  }, [qc]);

  return (
    <ErrorBoundary
      fallback={
        <div className="p-8 text-center text-sm text-red-500">
          Pending Riders page crashed. Please reload.
        </div>
      }
    >
      <PullToRefresh onRefresh={handlePullRefresh} className="space-y-6">
        <PageHeader
          icon={ClipboardList}
          title="Pending Rider Approvals"
          subtitle={
            isLoading
              ? "Loading..."
              : `${riders.length} rider${riders.length !== 1 ? "s" : ""} awaiting review`
          }
          iconBgClass="bg-yellow-100"
          iconColorClass="text-yellow-600"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 gap-2 rounded-xl"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {isLoading ? (
            [1, 2, 3].map((i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard
                icon={AlertTriangle}
                label="Pending Review"
                value={riders.length}
                iconBgClass="bg-yellow-100"
                iconColorClass="text-yellow-600"
              />
              <StatCard
                icon={Bike}
                label="Bikes"
                value={riders.filter((r) => r.vehicleType?.toLowerCase() === "bike").length}
                iconBgClass="bg-blue-100"
                iconColorClass="text-blue-600"
              />
              <StatCard
                icon={CheckCircle2}
                label="Other Vehicles"
                value={riders.filter((r) => r.vehicleType && r.vehicleType.toLowerCase() !== "bike").length}
                iconBgClass="bg-purple-100"
                iconColorClass="text-purple-600"
              />
            </>
          )}
        </div>

        {/* Rider List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-muted h-24 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : riders.length === 0 ? (
          <Card className="border-border/50 rounded-2xl">
            <CardContent className="p-12 text-center">
              <CheckCircle2 className="text-muted-foreground/40 mx-auto mb-3 h-12 w-12" />
              <p className="text-muted-foreground font-semibold">All caught up!</p>
              <p className="text-muted-foreground mt-1 text-sm">
                No rider applications are currently pending review.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Select-all row */}
            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/30 px-4 py-2.5">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all riders"
              />
              <span className="text-sm text-muted-foreground">
                {allSelected ? "Deselect all" : `Select all ${riders.length} rider${riders.length !== 1 ? "s" : ""}`}
              </span>
              {someSelected && (
                <span className="ml-auto text-xs font-semibold text-green-700">
                  {selectedIds.size} selected
                </span>
              )}
            </div>
            {riders.map((rider) => (
              <Card
                key={rider.id}
                className="border-border/50 rounded-2xl shadow-sm transition-shadow hover:shadow-md"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    {/* Avatar + Info */}
                    <Checkbox
                    checked={selectedIds.has(rider.id)}
                    onCheckedChange={() => toggleSelect(rider.id)}
                    aria-label={`Select ${rider.name || rider.phone || "rider"}`}
                    className="shrink-0"
                  />
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-yellow-100 text-lg font-bold text-yellow-700">
                        {rider.name ? rider.name[0]?.toUpperCase() : "R"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-foreground text-sm font-bold">
                            {rider.name || "Unnamed Rider"}
                          </p>
                          <StatusBadge status="pending_approval" label="Pending Approval" size="xs" />
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          {rider.phone && (
                            <a
                              href={`tel:${rider.phone}`}
                              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                            >
                              <Phone className="h-3 w-3" /> {rider.phone}
                            </a>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {rider.vehicleType && (
                            <span className="flex items-center gap-1">
                              <Bike className="h-3 w-3" />
                              {rider.vehicleType}
                              {rider.vehiclePlate ? ` · ${rider.vehiclePlate}` : ""}
                            </span>
                          )}
                          {rider.city && (
                            <span>
                              📍 {rider.city}
                              {rider.area ? `, ${rider.area}` : ""}
                            </span>
                          )}
                          <span>Applied {formatDate(rider.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDocModal(rider)}
                        className="h-9 gap-1.5 rounded-xl border-blue-200 text-xs text-blue-700 hover:bg-blue-50"
                      >
                        <FileText className="h-3.5 w-3.5" /> View Docs
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setApproveConfirm(rider)}
                        disabled={approvalMutation.isPending}
                        className="h-9 gap-1.5 rounded-xl bg-green-600 text-xs text-white hover:bg-green-700"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRejectModal(rider)}
                        disabled={approvalMutation.isPending}
                        className="h-9 gap-1.5 rounded-xl border-red-200 text-xs text-red-700 hover:bg-red-50"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modals */}
        {docModal && (
          <RiderDocumentsModal
            rider={docModal}
            onClose={() => setDocModal(null)}
            onApprove={() => {
              setDocModal(null);
              setApproveConfirm(docModal);
            }}
            onReject={() => {
              const r = docModal;
              setDocModal(null);
              setRejectModal(r);
            }}
            isPending={approvalMutation.isPending}
          />
        )}

        {rejectModal && (
          <RejectReasonDialog
            rider={rejectModal}
            onClose={() => setRejectModal(null)}
            onConfirm={(reason) => handleReject(rejectModal, reason)}
            isPending={approvalMutation.isPending}
          />
        )}

        <ConfirmDialog
          open={!!approveConfirm}
          title={`Approve ${approveConfirm?.name || "this rider"}?`}
          description="The rider will be notified and can immediately start accepting rides."
          confirmLabel="Approve"
          variant="default"
          busy={approvalMutation.isPending}
          onConfirm={() => approveConfirm && handleApprove(approveConfirm)}
          onClose={() => {
            if (!approvalMutation.isPending) setApproveConfirm(null);
          }}
        />

        <ConfirmDialog
          open={bulkConfirm}
          title={`Approve ${selectedIds.size} rider${selectedIds.size !== 1 ? "s" : ""}?`}
          description={`All ${selectedIds.size} selected rider${selectedIds.size !== 1 ? "s" : ""} will be approved and notified immediately.`}
          confirmLabel={bulkMutation.isPending ? "Approving…" : `Approve ${selectedIds.size}`}
          variant="default"
          busy={bulkMutation.isPending}
          onConfirm={handleBulkApprove}
          onClose={() => {
            if (!bulkMutation.isPending) setBulkConfirm(false);
          }}
        />
      </PullToRefresh>

      {/* Sticky bulk-action bar — slides in when any riders are selected */}
      {someSelected && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium">
              {selectedIds.size} rider{selectedIds.size !== 1 ? "s" : ""} selected
            </span>
            <div className="ml-auto flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                className="h-9 rounded-xl"
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() => setBulkConfirm(true)}
                disabled={bulkMutation.isPending}
                className="h-9 gap-2 rounded-xl bg-green-600 text-white hover:bg-green-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                {bulkMutation.isPending
                  ? "Approving…"
                  : `Approve ${selectedIds.size}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}
