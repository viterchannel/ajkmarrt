import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bike, Package, Star } from "lucide-react";
import { Link } from "wouter";
import { tDual, type TranslationKey } from "@workspace/i18n";
import { useLanguage } from "../lib/useLanguage";
import { ErrorState } from "../components/ui/ErrorState";
import { api } from "../lib/api";
import { formatDateTz, usePlatformConfig } from "../lib/useConfig";

interface Review {
  id: string;
  rating: number;
  comment?: string | null;
  customerName?: string | null;
  createdAt: string;
  orderId?: string | null;
  rideId?: string | null;
  orderType?: string | null;
}

interface ReviewsData {
  reviews: Review[];
  avgRating?: number;
  total?: number;
  starBreakdown?: Record<number, number>;
}

function StarDistributionBar({
  starBreakdown,
  total,
}: {
  starBreakdown: Record<number, number>;
  total: number;
}) {
  const barColors: Record<number, string> = {
    5: "bg-success",
    4: "bg-lime-400",
    3: "bg-yellow-400",
    2: "bg-warning",
    1: "bg-error",
  };
  return (
    <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-3.5 backdrop-blur-sm">
      {[5, 4, 3, 2, 1].map((star) => {
        const cnt = starBreakdown[star] ?? 0;
        const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
        return (
          <div key={star} className="flex items-center gap-2 text-[11px]">
            <span className="w-3 flex-shrink-0 text-right font-bold text-muted-foreground">{star}</span>
            <Star size={8} className="flex-shrink-0 fill-amber-400 text-warning" />
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/20">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColors[star]}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-14 flex-shrink-0 text-right tabular-nums text-muted-foreground">
              {cnt} ({pct}%)
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={
            i <= Math.floor(rating)
              ? "fill-amber-400 text-warning"
              : "fill-[#B0B0B0] text-muted-foreground"
          }
        />
      ))}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse space-y-3 rounded-3xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-24 rounded-full bg-muted" />
        <div className="h-3 w-16 rounded-full bg-muted" />
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-3.5 w-3.5 rounded-full bg-muted" />
        ))}
      </div>
      <div className="h-3 w-3/4 rounded-full bg-muted" />
    </div>
  );
}

export default function Reviews() {
  const { config } = usePlatformConfig();
  const tz = config.regional?.timezone ?? "Asia/Karachi";
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);

  const { data, isLoading, isError, refetch } = useQuery<ReviewsData>({
    queryKey: ["rider-my-reviews-full"],
    queryFn: () => api.getMyReviews(),
    staleTime: 60_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
  });

  const reviews: Review[] = data?.reviews ?? [];
  const avgRating: number = data?.avgRating ?? 0;
  const totalReviews: number = data?.total ?? 0;

  function formatDate(d: string) {
    return formatDateTz(d, { day: "numeric", month: "short", year: "numeric" }, tz);
  }

  return (
    <div className="min-h-screen bg-page-bg">
      <div
        className="relative overflow-hidden rounded-b-[2rem] page-header-gradient bg-card px-5 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
      >
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-warning/[0.04]" />
        <div className="absolute bottom-10 -left-16 h-56 w-56 rounded-full bg-muted/20" />
        <div className="relative mb-5 flex items-center gap-3">
          <Link
            href="/profile"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-muted/20 text-foreground/70 transition-colors hover:bg-muted/20"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="mb-0.5 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              {T("customerFeedback")}
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{T("myReviews")}</h1>
          </div>
        </div>

        {!isLoading && !isError && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-center backdrop-blur-sm">
                <p className="text-lg font-extrabold text-foreground">
                  {avgRating > 0 ? `${avgRating.toFixed(1)} / 5.0` : "—"}
                </p>
                <p className="mt-0.5 text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {T("avgRatingLabel")}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-center backdrop-blur-sm">
                <p className="text-lg font-extrabold text-foreground">{totalReviews}</p>
                <p className="mt-0.5 text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {T("totalReviewsLabel")}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-center backdrop-blur-sm">
                <p className="text-lg font-extrabold text-warning">
                  {reviews.filter((r) => r.rating >= 4).length}
                </p>
                <p className="mt-0.5 text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {T("positiveLabel")}
                </p>
              </div>
            </div>
            {data?.starBreakdown && totalReviews > 0 && (
              <StarDistributionBar starBreakdown={data.starBreakdown} total={totalReviews} />
            )}
          </div>
        )}
      </div>

      <div className="space-y-3 px-4 pt-4 pb-8">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : reviews.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-warning/10">
              <Star size={28} className="text-warning" />
            </div>
            <p className="text-base font-bold text-muted-foreground">{T("noReviewsYet")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {T("earnFirstReview")}
            </p>
          </div>
        ) : (
          reviews.map((review) => (
            <div
              key={review.id}
              className="space-y-2.5 rounded-3xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <StarRow rating={review.rating} size={15} />
                  <p className="text-xs font-medium text-muted-foreground">
                    {review.customerName ? review.customerName : T("customerFallback")}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      review.rideId ? "bg-success/10 text-success" : "bg-blue-500/10 text-blue-400"
                    }`}
                  >
                    {review.rideId ? (
                      <>
                        <Bike size={10} /> {T("ride")}
                      </>
                    ) : (
                      <>
                        <Package size={10} /> {review.orderType ?? T("order")}
                      </>
                    )}
                  </span>
                  {(review.orderId || review.rideId) && (
                    <p className="mt-1 max-w-[120px] truncate font-mono text-[10px] text-muted-foreground">
                      #{(review.orderId ?? review.rideId ?? "").slice(-8).toUpperCase()}
                    </p>
                  )}
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{formatDate(review.createdAt)}</p>
                </div>
              </div>

              {review.comment && review.comment.trim() && (
                <div className="rounded-2xl bg-card px-3.5 py-2.5">
                  <p className="text-sm leading-relaxed text-muted-foreground italic">
                    "{review.comment.trim()}"
                  </p>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full ${i <= Math.floor(review.rating) ? "bg-warning" : "bg-muted"}`}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
