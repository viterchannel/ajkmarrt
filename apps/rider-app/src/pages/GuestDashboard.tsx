import { Bike, MapPin, TrendingUp, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { tDual, type TranslationKey } from "@workspace/i18n";
import { useLanguage } from "../lib/useLanguage";

interface PublicBanner {
  id: string;
  title: string;
  subtitle?: string | null;
  gradient1?: string | null;
  gradient2?: string | null;
  icon?: string | null;
}

interface ZoneInfo {
  id: string;
  name: string;
}

export function GuestDashboard() {
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  const [banners, setBanners] = useState<PublicBanner[]>([]);
  const [zones, setZones] = useState<ZoneInfo[]>([]);

  useEffect(() => {
    const abortCtrl = new AbortController();
    const { signal } = abortCtrl;

    fetch("/api/banners?placement=home&service=rider", { signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (signal.aborted) return;
        if (Array.isArray(data?.data?.banners)) setBanners(data.data.banners.slice(0, 3));
        else if (Array.isArray(data?.banners)) setBanners(data.banners.slice(0, 3));
      })
      .catch(() => {});

    fetch("/api/locations/active-cities?service=rides", { signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { data?: { zones?: unknown[] }; zones?: unknown[] } | null) => {
        if (signal.aborted) return;
        const list = data?.data?.zones ?? data?.zones ?? [];
        if (Array.isArray(list)) setZones(list as ZoneInfo[]);
      })
      .catch(() => {});

    return () => abortCtrl.abort();
  }, []);

  const zoneCount = zones.length || null;

  return (
    <div className="flex min-h-screen flex-col bg-[#141414] text-foreground">
      {/* Sign-up banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-center">
        <p className="text-sm font-bold text-foreground">
          {T("signUpToStartEarning")}
          {zoneCount
            ? ` — ${zoneCount} ${zoneCount === 1 ? T("activeDeliveryZone") : T("activeDeliveryZones")} ${T("inAJK")}`
            : ` — ${T("regJoinThousandsRiders")}`}!
        </p>
        <div className="mt-2 flex justify-center gap-3">
          <button
            onClick={() => navigate("/register")}
            className="rounded-xl bg-white px-4 py-1.5 text-xs font-black text-emerald-700 transition-colors active:bg-emerald-50"
          >
            {T("joinNow")}
          </button>
          <button
            onClick={() => navigate("/login")}
            className="rounded-xl border border-border px-4 py-1.5 text-xs font-bold text-foreground transition-colors active:bg-muted/50"
          >
            {T("login")}
          </button>
        </div>
      </div>

      {/* Preview content */}
      <div className="flex-1 space-y-4 p-4">
        <h2 className="text-lg font-extrabold">{T("riderDashboardPreview")}</h2>

        {/* Live zone data strip */}
        {zoneCount ? (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3">
            <MapPin size={16} className="flex-shrink-0 text-emerald-400" />
            <p className="text-xs font-semibold text-emerald-200">
              <span className="font-black text-foreground">{zoneCount}</span>{" "}
              {zoneCount === 1 ? T("activeDeliveryZone") : T("activeDeliveryZones")} {T("inAJK")} — {T("regRidersNeededArea")}
            </p>
          </div>
        ) : null}

        {/* Live public banners feed */}
        {banners.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black tracking-wider text-muted-foreground uppercase">
              {T("currentPromotions")}
            </p>
            {banners.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{
                  background:
                    b.gradient1 && b.gradient2
                      ? `linear-gradient(135deg, ${b.gradient1}, ${b.gradient2})`
                      : "linear-gradient(135deg, #1a4b3a, #0d3c28)",
                }}
              >
                {b.icon && (
                  <span className="text-xl flex-shrink-0">{b.icon}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{b.title}</p>
                  {b.subtitle && (
                    <p className="text-[10px] text-foreground/80 truncate">{b.subtitle}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Earnings snapshot — blurred/locked */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Wallet size={16} className="text-success" />
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {T("todayEarnings")}
            </p>
          </div>
          <p className="text-3xl font-black text-foreground blur-sm select-none">₨ 2,400</p>
          <p className="mt-1 text-xs text-muted-foreground blur-sm select-none">12 {T("deliveriesCompleted")}</p>
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-[2px]">
            <button
              onClick={() => navigate("/register")}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-foreground shadow-lg active:bg-emerald-700"
            >
              🔒 {T("joinToUnlock")}
            </button>
          </div>
        </div>

        {/* Stats row — blurred/locked */}
        <div className="grid grid-cols-2 gap-3">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 text-center">
            <TrendingUp size={20} className="mx-auto mb-1 text-blue-400" />
            <p className="text-xl font-black text-foreground blur-sm select-none">₨ 42,800</p>
            <p className="text-[10px] font-bold text-muted-foreground">{T("thisMonth")}</p>
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-[2px]">
              <span className="text-lg">🔒</span>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 text-center">
            <Bike size={20} className="mx-auto mb-1 text-warning" />
            <p className="text-xl font-black text-foreground blur-sm select-none">284</p>
            <p className="text-[10px] font-bold text-muted-foreground">{T("totalDeliveries")}</p>
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-[2px]">
              <span className="text-lg">🔒</span>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 text-xs font-black tracking-wider text-muted-foreground uppercase">
            {T("howItWorks")}
          </p>
          <div className="space-y-3">
            {[
              { step: "1", textKey: "guestStep1" as TranslationKey },
              { step: "2", textKey: "guestStep2" as TranslationKey },
              { step: "3", textKey: "guestStep3" as TranslationKey },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-xs font-black text-foreground">
                  {item.step}
                </div>
                <p className="text-xs text-muted-foreground">{T(item.textKey)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => navigate("/register")}
          className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-4 text-sm font-black text-foreground shadow-lg shadow-emerald-900/40 active:opacity-90"
        >
          {T("joinAsFree")}
        </button>
        <button
          onClick={() => navigate("/")}
          className="w-full rounded-2xl bg-muted py-3 text-sm font-semibold text-muted-foreground active:bg-[#2A2A2A]"
        >
          {T("backToHome")}
        </button>
      </div>
    </div>
  );
}

export default GuestDashboard;
