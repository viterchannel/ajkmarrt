import { tDual } from "@workspace/i18n";
import { formatCurrency as _sharedFc } from "@workspace/api-zod";
import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { useLanguage } from "../../lib/useLanguage";

function fc(n: string | number | null | undefined, symbol = "Rs.") {
  return _sharedFc(n != null ? String(n) : (n as null | undefined), symbol);
}

type WalletTx = {
  id: string;
  type: string;
  amount: number | string;
  createdAt: string;
};

interface EarningsBarChartProps {
  transactions: WalletTx[];
  currency: string;
  title?: string;
}

export default function EarningsBarChart({ transactions, currency, title }: EarningsBarChartProps) {
  const { language } = useLanguage();
  const T = (key: Parameters<typeof tDual>[0]) => tDual(key, language);
  const [tooltip, setTooltip] = useState<{ idx: number; amount: number; date: string } | null>(null);

  const days = useMemo(() => {
    const result: { label: string; amount: number; date: string; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const earned = transactions
        .filter(
          (t) =>
            t.type === "credit" &&
            new Date(t.createdAt) >= d &&
            new Date(t.createdAt) < next
        )
        .reduce((s, t) => s + Number(t.amount), 0);
      result.push({
        label: i === 0 ? T("today") : d.toLocaleDateString("en-PK", { weekday: "short" }),
        amount: earned,
        date: d.toLocaleDateString("en-PK", { day: "numeric", month: "short" }),
        isToday: i === 0,
      });
    }
    return result;
  }, [transactions]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxVal = Math.max(...days.map((d) => d.amount), 1);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-card-dark p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 size={15} className="text-[#B0B0B0]" />
        <p className="text-sm font-bold text-white">{title ?? "7-Day Earnings"}</p>
      </div>

      {tooltip && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-brand/20 bg-brand/10 px-3 py-2">
          <span className="text-xs font-semibold text-brand">{days[tooltip.idx]?.date}</span>
          <span className="text-sm font-extrabold text-brand">{fc(tooltip.amount, currency)}</span>
        </div>
      )}

      <div className="flex h-20 items-end gap-2">
        {days.map((d, i) => (
          <button
            key={i}
            type="button"
            className="flex flex-1 flex-col items-center gap-1.5 cursor-pointer"
            onClick={() => setTooltip(tooltip?.idx === i ? null : { idx: i, amount: d.amount, date: d.date })}
          >
            <div className="flex w-full items-end justify-center" style={{ height: 56 }}>
              <div
                className={`w-full max-w-[24px] rounded-t-lg transition-all duration-500 ${
                  d.isToday ? "bg-brand" : tooltip?.idx === i ? "bg-white/40" : "bg-white/20"
                }`}
                style={{
                  height: Math.max((d.amount / maxVal) * 56, d.amount > 0 ? 4 : 2),
                }}
              />
            </div>
            <p
              className={`text-[9px] font-semibold ${
                d.isToday ? "text-brand" : "text-[#B0B0B0]"
              }`}
            >
              {d.label}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
