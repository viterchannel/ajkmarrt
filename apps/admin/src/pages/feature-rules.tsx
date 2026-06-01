import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageHeader } from "@/components/shared";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { fetchAdmin } from "@/lib/adminFetcher";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";

type ApiVerification = "phone_verified" | "email_verified" | "documents_approved";

type FeatureRule = {
  id: number;
  role: "customer" | "rider" | "vendor";
  featureName: string;
  requiredVerifications: ApiVerification[];
  maxDailyLimit: number;
  isActive: boolean;
};

const ROLE_OPTIONS: { value: "customer" | "rider" | "vendor"; label: string }[] = [
  { value: "customer", label: "Customer" },
  { value: "rider", label: "Rider" },
  { value: "vendor", label: "Vendor" },
];

const ROLE_COLORS: Record<string, string> = {
  customer: "bg-blue-100 text-blue-700 border-blue-200",
  rider: "bg-emerald-100 text-emerald-700 border-emerald-200",
  vendor: "bg-orange-100 text-orange-700 border-orange-200",
};

type VerifChip = {
  specKey: string;
  apiValue: ApiVerification | null;
  label: string;
  colorClass: string;
  disabled?: boolean;
};

const VERIF_CHIPS: VerifChip[] = [
  {
    specKey: "email_verified",
    apiValue: "email_verified",
    label: "Email Verified",
    colorClass: "border-sky-200 bg-sky-50 text-sky-700",
  },
  {
    specKey: "phone_verified",
    apiValue: "phone_verified",
    label: "Phone Verified",
    colorClass: "border-green-200 bg-green-50 text-green-700",
  },
  {
    specKey: "documents_approved",
    apiValue: "documents_approved",
    label: "Documents Approved",
    colorClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    specKey: "kyc_approved",
    apiValue: null,
    label: "KYC Approved",
    colorClass: "border-gray-200 bg-gray-50 text-gray-400",
    disabled: true,
  },
];

const API_TO_LABEL: Record<string, string> = {
  email_verified: "Email Verified",
  phone_verified: "Phone Verified",
  documents_approved: "Documents Approved",
  /* Legacy labels for backward compatibility */
  email: "Email Verified",
  phone: "Phone Verified",
  documents: "Documents Approved",
};

const API_TO_COLOR: Record<string, string> = {
  email_verified: "border-sky-200 bg-sky-100 text-sky-700",
  phone_verified: "border-green-200 bg-green-100 text-green-700",
  documents_approved: "border-amber-200 bg-amber-100 text-amber-700",
  /* Legacy colors */
  email: "border-sky-200 bg-sky-100 text-sky-700",
  phone: "border-green-200 bg-green-100 text-green-700",
  documents: "border-amber-200 bg-amber-100 text-amber-700",
};

type FormState = {
  role: "customer" | "rider" | "vendor";
  featureName: string;
  selectedVerifs: ApiVerification[];
  maxDailyLimit: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  role: "customer",
  featureName: "",
  selectedVerifs: [],
  maxDailyLimit: "0",
  isActive: true,
};

function ruleToForm(rule: FeatureRule): FormState {
  return {
    role: rule.role,
    featureName: rule.featureName,
    selectedVerifs: rule.requiredVerifications ?? [],
    maxDailyLimit: String(rule.maxDailyLimit ?? 0),
    isActive: rule.isActive,
  };
}

function FeatureRuleDialog({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial?: FeatureRule | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(initial ? ruleToForm(initial) : EMPTY_FORM);

  const saveMut = useMutation({
    mutationFn: async () => {
      const body = {
        role: form.role,
        featureName: form.featureName.trim(),
        requiredVerifications: form.selectedVerifs,
        maxDailyLimit: form.maxDailyLimit !== "" ? Number(form.maxDailyLimit) : 0,
        isActive: form.isActive,
      };
      if (initial) {
        return fetchAdmin(`/feature-rules/${initial.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      }
      return fetchAdmin("/feature-rules", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast({ title: initial ? "Feature rule updated" : "Feature rule created" });
      onSaved();
      onClose();
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Failed to save", description: msg, variant: "destructive" });
    },
  });

  const toggleVerif = (chip: VerifChip) => {
    if (!chip.apiValue || chip.disabled) return;
    const v = chip.apiValue;
    setForm((f) => ({
      ...f,
      selectedVerifs: f.selectedVerifs.includes(v)
        ? f.selectedVerifs.filter((x) => x !== v)
        : [...f.selectedVerifs, v],
    }));
  };

  const isValid = form.featureName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Feature Rule" : "New Feature Rule"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold tracking-wide text-gray-600 uppercase">
              Role
            </label>
            <Select
              value={form.role}
              onValueChange={(v) => setForm((f) => ({ ...f, role: v as FormState["role"] }))}
            >
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold tracking-wide text-gray-600 uppercase">
              Feature Name
            </label>
            <Input
              placeholder="e.g. wallet.withdraw, ride.book"
              value={form.featureName}
              onChange={(e) => setForm((f) => ({ ...f, featureName: e.target.value }))}
              className="h-10 rounded-xl"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold tracking-wide text-gray-600 uppercase">
              Required Verifications
            </label>
            <div className="flex flex-wrap gap-2">
              {VERIF_CHIPS.map((chip) => {
                const active =
                  !chip.disabled && chip.apiValue !== null && form.selectedVerifs.includes(chip.apiValue);
                return (
                  <button
                    key={chip.specKey}
                    type="button"
                    disabled={chip.disabled}
                    title={chip.disabled ? "Coming soon" : undefined}
                    onClick={() => toggleVerif(chip)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      chip.disabled
                        ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300"
                        : active
                          ? "border-[#1A56DB] bg-[#1A56DB] text-white"
                          : "border-gray-200 bg-gray-50 text-gray-600 hover:border-[#1A56DB]/50"
                    }`}
                  >
                    {chip.label}
                    {chip.disabled && (
                      <span className="ml-1 text-[9px] font-normal opacity-70">soon</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold tracking-wide text-gray-600 uppercase">
              Max Daily Limit
            </label>
            <Input
              type="number"
              min="0"
              step="1"
              placeholder="0 = unlimited"
              value={form.maxDailyLimit}
              onChange={(e) => setForm((f) => ({ ...f, maxDailyLimit: e.target.value }))}
              className="h-10 rounded-xl"
            />
            <p className="mt-1 text-xs text-gray-400">Set to 0 for no daily limit.</p>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-700">Active</p>
              <p className="text-xs text-gray-400">Rule is enforced when active</p>
            </div>
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={() => saveMut.mutate()}
            disabled={!isValid || saveMut.isPending}
            className="rounded-xl bg-[#1A56DB] hover:bg-[#1A56DB]/90"
          >
            {saveMut.isPending ? "Saving…" : initial ? "Save Changes" : "Create Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmDialog({
  rule,
  onClose,
  onDeleted,
}: {
  rule: FeatureRule;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const deleteMut = useMutation({
    mutationFn: () => fetchAdmin(`/feature-rules/${rule.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Rule deleted" });
      onDeleted();
      onClose();
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Feature Rule</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">
          Are you sure you want to delete the rule for{" "}
          <span className="font-semibold">{rule.featureName}</span> ({rule.role})? This action
          cannot be undone.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={() => deleteMut.mutate()}
            disabled={deleteMut.isPending}
            variant="destructive"
            className="rounded-xl"
          >
            {deleteMut.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function FeatureRulesPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRule, setEditRule] = useState<FeatureRule | null>(null);
  const [deleteRule, setDeleteRule] = useState<FeatureRule | null>(null);

  const { data, isLoading } = useQuery<{ rules: FeatureRule[] }>({
    queryKey: ["admin-feature-rules"],
    queryFn: () => fetchAdmin("/feature-rules"),
    staleTime: 30_000,
  });

  const toggleActiveMut = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      fetchAdmin(`/feature-rules/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-feature-rules"] }),
  });

  const rules: FeatureRule[] = data?.rules ?? [];
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["admin-feature-rules"] });

  const columns: DataTableColumn<FeatureRule>[] = [
    {
      header: "Role",
      accessor: (row) => (
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${ROLE_COLORS[row.role] ?? "bg-gray-100 text-gray-700"}`}
        >
          {row.role}
        </span>
      ),
    },
    {
      header: "Feature Name",
      accessor: (row) => (
        <span className="font-mono text-sm font-medium text-gray-800">{row.featureName}</span>
      ),
    },
    {
      header: "Required Verifications",
      accessor: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.requiredVerifications?.length > 0 ? (
            row.requiredVerifications.map((v) => (
              <span
                key={v}
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${API_TO_COLOR[v] ?? "bg-gray-100 text-gray-600"}`}
              >
                {API_TO_LABEL[v] ?? v}
              </span>
            ))
          ) : (
            <span className="text-xs italic text-gray-400">None</span>
          )}
        </div>
      ),
    },
    {
      header: "Max Daily Limit",
      accessor: (row) => (
        <span className="text-sm text-gray-700">
          {row.maxDailyLimit === 0 ? (
            <span className="text-xs italic text-gray-400">Unlimited</span>
          ) : (
            row.maxDailyLimit
          )}
        </span>
      ),
    },
    {
      header: "Active",
      accessor: (row) => (
        <Switch
          checked={row.isActive}
          onCheckedChange={(v) => toggleActiveMut.mutate({ id: row.id, isActive: v })}
        />
      ),
    },
    {
      header: "Actions",
      className: "text-right",
      accessor: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            title="Edit"
            onClick={() => {
              setEditRule(row);
              setDialogOpen(true);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-[#1A56DB]/30 hover:bg-blue-50 hover:text-[#1A56DB]"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            title="Delete"
            onClick={() => setDeleteRule(row)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-6">
        {dialogOpen && (
          <FeatureRuleDialog
            open
            onClose={() => {
              setDialogOpen(false);
              setEditRule(null);
            }}
            initial={editRule}
            onSaved={invalidate}
          />
        )}
        {deleteRule && (
          <DeleteConfirmDialog
            rule={deleteRule}
            onClose={() => setDeleteRule(null)}
            onDeleted={invalidate}
          />
        )}

        <PageHeader
          icon={ShieldCheck}
          title="Feature Rules"
          subtitle="Control which verifications are required before users can access platform features"
          iconBgClass="bg-blue-100"
          iconColorClass="text-[#1A56DB]"
          actions={
            <Button
              onClick={() => {
                setEditRule(null);
                setDialogOpen(true);
              }}
              className="gap-2 rounded-xl bg-[#1A56DB] hover:bg-[#1A56DB]/90"
            >
              <Plus className="h-4 w-4" /> Add Rule
            </Button>
          }
        />

        <DataTable
          columns={columns}
          data={rules}
          isLoading={isLoading}
          emptyMessage="No feature rules yet. Add one to get started."
        />
      </div>
    </ErrorBoundary>
  );
}
