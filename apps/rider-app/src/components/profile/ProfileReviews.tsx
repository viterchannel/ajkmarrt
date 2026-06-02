import { useQuery } from "@tanstack/react-query";
import { formatCurrency as _sharedFcP } from "@workspace/api-zod";
import { tDual, type Language, type TranslationKey } from "@workspace/i18n";
import { Star } from "lucide-react";
import { api } from "../../lib/api";

const _fc = (n: string | number | null | undefined, currencySymbol = "Rs.") =>
  _sharedFcP(n != null ? String(n) : (n as null | undefined), currencySymbol);

interface ProfileReviewsProps {
  language: Language;
  currency: string;
}

export function ProfileReviews({ language, currency: _currency }: ProfileReviewsProps) {
  const T = (key: TranslationKey) => tDual(key, language);

  const { data: reviewsData } = useQuery({
    queryKey: ["rider-my-reviews"],
    queryFn: () => api.getMyReviews(),
    staleTime: 60000,
  });

  return (
    <div className="animate-[slideUp_0.7s_ease-out] overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-yellow-50">
            <Star size={16} className="text-yellow-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">{T("customerReviews")}</p>
            <p className="text-[11px] text-muted-foreground">
              {reviewsData?.total
                ? `${reviewsData.total} ${T("reviews")} · ${reviewsData.avgRating?.toFixed(1)} avg`
                : T("noReviewsYet")}
            </p>
          </div>
        </div>
        {(reviewsData?.avgRating ?? 0) > 0 && (
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={12}
                className={
                  s <= Math.round(reviewsData.avgRating || 0)
                    ? "fill-yellow-400 text-yellow-400"
                    : "fill-[#B0B0B0] text-muted-foreground"
                }
              />
            ))}
          </div>
        )}
      </div>

      {(reviewsData?.total ?? 0) > 0 && (
        <div className="space-y-1.5 border-b border-border/30 px-5 py-3">
          {[5, 4, 3, 2, 1].map((star) => {
            const cnt = (reviewsData?.starBreakdown?.[star] ?? 0) as number;
            const pct = reviewsData?.total ? Math.round((cnt / reviewsData.total) * 100) : 0;
            const barColors: Record<number, string> = {
              5: "bg-success",
              4: "bg-lime-400",
              3: "bg-yellow-400",
              2: "bg-warning",
              1: "bg-error",
            };
            return (
              <div key={star} className="flex items-center gap-2 text-[11px]">
                <span className="w-2.5 text-right font-bold text-muted-foreground">{star}</span>
                <Star size={9} className="flex-shrink-0 fill-amber-400 text-warning" />
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColors[star]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-5 text-right text-muted-foreground tabular-nums">{cnt}</span>
              </div>
            );
          })}
        </div>
      )}

      {(reviewsData?.reviews?.length ?? 0) === 0 ? (
        <div className="px-5 py-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-50">
            <Star size={22} className="text-yellow-400" />
          </div>
          <p className="text-sm font-bold text-muted-foreground">{T("noReviewsYet")}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{T("completeMoreRidesFeedback")}</p>
        </div>
      ) : (
        <div className="max-h-96 divide-y divide-border overflow-y-auto">
          {(reviewsData?.reviews ?? []).map((r: any) => (
            <div key={r.id} className="px-5 py-3.5">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-yellow-100 to-orange-100 text-[11px] font-bold text-warning">
                    {(r.customerName || "C")[0].toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {r.customerName || T("customerFallback")}
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={10}
                      className={
                        s <= r.rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "fill-[#B0B0B0] text-muted-foreground"
                      }
                    />
                  ))}
                </div>
              </div>
              {r.comment && (
                <p className="pl-9 text-xs leading-relaxed text-muted-foreground italic">"{r.comment}"</p>
              )}
              <p className="mt-1 pl-9 text-[10px] text-muted-foreground">
                {new Date(r.createdAt).toLocaleDateString("en-PK", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
