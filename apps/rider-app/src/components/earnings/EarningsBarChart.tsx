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
  description?: string | null;
};

interface EarningsBarChartProps {
  transactions: WalletTx[];
  currency: string;
  title?: string;
}

export default function EarningsBarChart({ transactions, currency, title }: EarningsBarChartProps) {
  const { language } = useLanguage();
  const T = (key: Parameters<typeof tDual>[0]) => tDual(key, language);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const days = useMemo(() => {
    const result: { label: string; amount: number; count: number; date: string; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const now = new Date();
      const dUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
      const nextUTC = new Date(dUTC.getTime() + 24 * 60 * 60 * 1000);
      const dayTxs = transactions.filter(
        (t) =>
          t.type === "credit" &&
          new Date(t.createdAt) >= dUTC &&
          new Date(t.createdAt) < nextUTC
      );
      result.push({
        label: i === 0 ? T("today") : dUTC.toLocaleDateString("en-PK", { weekday: "short", timeZone: "UTC" }),
        amount: dayTxs.reduce((s, t) => s + Number(t.amount), 0),
        count: dayTxs.length,
        date: dUTC.toLocaleDateString("en-PK", { day: "numeric", month: "short", timeZone: "UTC" }),
        isToday: i === 0,
      });
    }
    return result;
  }, [transactions]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxVal = Math.max(...days.map((d) => d.amount), 1);
  const active = activeIdx != null ? days[activeIdx] : null;

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 size={15} className="text-muted-foreground" />
        <p className="text-sm font-bold text-foreground">{title ?? "7-Day Earnings"}</p>
      </div>

      {active ? (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-brand/20 bg-brand/10 px-3 py-2">
          <div>
            <p className="text-xs font-semibold text-brand">{active.date}</p>
            <p className="text-[10px] text-brand/60">{active.count} {active.count === 1 ? "delivery" : "deliveries"}</p>
          </div>
          <span className="text-sm font-extrabold text-brand">{fc(active.amount, currency)}</span>
        </div>
      ) : (
        <div className="mb-3 h-[46px]" />
      )}

      <div className="flex h-20 items-end gap-2">
        {days.map((d, i) => (
          <button
            key={i}
            type="button"
            className="flex flex-1 flex-col items-center gap-1.5 cursor-pointer"
            onClick={() => setActiveIdx(activeIdx === i ? null : i)}
          >
            <div className="flex w-full items-end justify-center" style={{ height: 56 }}>
              <div
                className={`w-full max-w-[24px] rounded-t-lg transition-all duration-500 ${
                  d.isToday ? "bg-brand" : activeIdx === i ? "bg-muted/60" : "bg-muted/40"
                }`}
                style={{
                  height: Math.max((d.amount / maxVal) * 56, d.amount > 0 ? 4 : 2),
                }}
              />
            </div>
            <p
              className={`text-[9px] font-semibold ${
                d.isToday ? "text-brand" : "text-muted-foreground"
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
