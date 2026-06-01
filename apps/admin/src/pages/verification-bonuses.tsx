import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageHeader } from "@/components/shared";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { fetchAdmin } from "@/lib/adminFetcher";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

type BonusType = "coins" | "cash";

type VerificationBonus = {
  id: number;
  verificationType: "email_verified" | "phone_verified" | "documents_approved";
  bonusAmount: number | string;
  bonusType: BonusType;
  isActive: boolean;
};

const FIXED_TYPES: {
  key: "email_verified" | "phone_verified" | "documents_approved";
  label: string;
  desc: string;
  colorClass: string;
}[] = [
  {
    key: "email_verified",
    label: "Email Verified",
    desc: "Bonus awarded when user verifies their email address",
    colorClass: "bg-sky-100 text-sky-700 border-sky-200",
  },
  {
    key: "phone_verified",
    label: "Phone Verified",
    desc: "Bonus awarded when user verifies their phone number via OTP",
    colorClass: "bg-green-100 text-green-700 border-green-200",
  },
  {
    key: "documents_approved",
    label: "Documents Approved",
    desc: "Bonus awarded when admin approves user documents",
    colorClass: "bg-amber-100 text-amber-700 border-amber-200",
  },
];

function BonusRow({
  bonus,
  meta,
  onUpdated,
}: {
  bonus: VerificationBonus | undefined;
  meta: (typeof FIXED_TYPES)[number];
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(bonus ? String(bonus.bonusAmount) : "0");
  const [bonusType, setBonusType] = useState<BonusType>(bonus?.bonusType ?? "coins");
  const [isActive, setIsActive] = useState(bonus?.isActive ?? false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!bonus) return;
    setAmount(String(bonus.bonusAmount));
    setBonusType(bonus.bonusType);
    setIsActive(bonus.isActive);
    setDirty(false);
  }, [bonus?.bonusAmount, bonus?.bonusType, bonus?.isActive]);

  const saveMut = useMutation({
    mutationFn: () => {
      if (!bonus) throw new Error("No bonus record to update");
      return fetchAdmin(`/verification-bonuses/${bonus.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          bonusAmount: Number(amount) || 0,
          bonusType,
          isActive,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Bonus updated" });
      setDirty(false);
      onUpdated();
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Failed to save", description: msg, variant: "destructive" });
    },
  });

  const markDirty = () => setDirty(true);
  const notLoaded = !bonus;

  return (
    <div className="grid grid-cols-12 items-center gap-4 border-b border-gray-50 px-5 py-4 last:border-b-0">
      <div className="col-span-4">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.colorClass}`}
          >
            {meta.label}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-400">{meta.desc}</p>
      </div>

      <div className="col-span-3">
        <label className="mb-1 block text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
          Bonus Amount
        </label>
        <div className="relative">
          <span className="absolute top-1/2 left-3 -translate-y-1/2 text-xs font-semibold text-gray-400">
            {bonusType === "cash" ? "Rs." : "🪙"}
          </span>
          <input
            type="number"
            min="0"
            step="1"
            value={amount}
            disabled={notLoaded}
            onChange={(e) => {
              setAmount(e.target.value);
              markDirty();
            }}
            className="h-9 w-full rounded-xl border border-gray-200 pl-8 pr-3 text-sm font-semibold text-gray-800 focus:border-[#1A56DB] focus:ring-2 focus:ring-[#1A56DB]/20 focus:outline-none disabled:opacity-40"
          />
        </div>
      </div>

      <div className="col-span-3">
        <label className="mb-1 block text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
          Bonus Type
        </label>
        <select
          value={bonusType}
          disabled={notLoaded}
          onChange={(e) => {
            setBonusType(e.target.value as BonusType);
            markDirty();
          }}
          className="h-9 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-800 focus:border-[#1A56DB] focus:ring-2 focus:ring-[#1A56DB]/20 focus:outline-none disabled:opacity-40"
        >
          <option value="coins">Coins</option>
          <option value="cash">Wallet Cash</option>
        </select>
      </div>

      <div className="col-span-1 flex flex-col items-center gap-1">
        <label className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
          Active
        </label>
        <Switch
          checked={isActive}
          disabled={notLoaded}
          onCheckedChange={(v) => {
            setIsActive(v);
            markDirty();
          }}
        />
      </div>

      <div className="col-span-1 flex items-center justify-end">
        {notLoaded ? (
          <span className="text-xs italic text-gray-300">—</span>
        ) : (
          dirty && (
            <button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              className="flex h-8 items-center gap-1.5 rounded-xl bg-[#1A56DB] px-3 text-xs font-semibold text-white transition hover:bg-[#1A56DB]/90 disabled:opacity-60"
            >
              {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </button>
          )
        )}
      </div>
    </div>
  );
}

export default function VerificationBonusesPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<VerificationBonus[]>({
    queryKey: ["admin-verification-bonuses"],
    queryFn: async () => {
      const res = await fetchAdmin("/verification-bonuses");
      return (res?.bonuses ?? res?.data ?? res) as VerificationBonus[];
    },
    staleTime: 30_000,
  });

  const bonusMap = new Map<string, VerificationBonus>(
    Array.isArray(data) ? data.map((b) => [b.verificationType, b]) : []
  );

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["admin-verification-bonuses"] });

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-6">
        <PageHeader
          icon={Gift}
          title="Verification Bonuses"
          subtitle="Configure bonus rewards granted when users complete verification steps"
          iconBgClass="bg-amber-100"
          iconColorClass="text-amber-600"
        />

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="grid grid-cols-12 gap-4 border-b border-gray-100 bg-gray-50 px-5 py-3">
            <div className="col-span-4 text-xs font-semibold tracking-wider text-gray-400 uppercase">
              Verification Type
            </div>
            <div className="col-span-3 text-xs font-semibold tracking-wider text-gray-400 uppercase">
              Bonus Amount
            </div>
            <div className="col-span-3 text-xs font-semibold tracking-wider text-gray-400 uppercase">
              Bonus Type
            </div>
            <div className="col-span-1 text-center text-xs font-semibold tracking-wider text-gray-400 uppercase">
              Active
            </div>
            <div className="col-span-1" />
          </div>

          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#1A56DB]" />
            </div>
          ) : (
            FIXED_TYPES.map((meta) => (
              <BonusRow
                key={meta.key}
                meta={meta}
                bonus={bonusMap.get(meta.key)}
                onUpdated={invalidate}
              />
            ))
          )}
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
          <p className="mb-1 font-semibold">How bonuses work</p>
          <p className="text-xs text-blue-600">
            Each row is a fixed verification milestone. When a user reaches that milestone, the
            system automatically credits the configured bonus to their account. Use{" "}
            <strong>Coins</strong> for loyalty points or <strong>Wallet Cash</strong> for real
            money. Inactive bonuses are skipped at payout time.
          </p>
        </div>
      </div>
    </ErrorBoundary>
  );
}
