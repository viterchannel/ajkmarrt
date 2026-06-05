import { lazy, Suspense, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { PullToRefresh } from "../components/PullToRefresh";
import { useHomeData } from "../components/home/useHomeData";
import { HomeHeader } from "../components/home/HomeHeader";
import { HomeRequests } from "../components/home/HomeRequests";
import { ProfileCompletionCard } from "../components/home/ProfileCompletionCard";
import { QuickActions } from "../components/home/QuickActions";
import { SkeletonHome } from "../components/dashboard/SkeletonHome";
import { OfflineConfirmDialog } from "../components/dashboard/OfflineConfirmDialog";
import { ChevronRight } from "lucide-react";
import { Link } from "wouter";

/* ─── Code-split heavy sub-components ───────────────────────────────────── */
const HomeAlertCenter = lazy(() =>
  import("../components/home/HomeAlertCenter").then((m) => ({ default: m.HomeAlertCenter }))
);
const HomeStats = lazy(() =>
  import("../components/home/HomeStats").then((m) => ({ default: m.HomeStats }))
);
const GoalSection = lazy(() =>
  import("../components/home/GoalSection").then((m) => ({ default: m.GoalSection }))
);

/* ─── Fallback skeletons for lazy-loaded sections ────────────────────────── */

function AlertSkeleton() {
  return <div className="h-12 animate-pulse rounded-2xl bg-muted/20" />;
}

function StatsSkeleton() {
  return (
    <div className="space-y-2.5">
      <div className="h-3 w-32 animate-pulse rounded bg-muted/30" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted/20" />
        ))}
      </div>
    </div>
  );
}

function GoalSkeleton() {
  return <div className="h-16 animate-pulse rounded-2xl bg-muted/20" />;
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function Home() {
  const h = useHomeData();

  useEffect(() => {
    try {
      if (sessionStorage.getItem("reg_doc_upload_warning") === "1") {
        sessionStorage.removeItem("reg_doc_upload_warning");
        toast({
          title: "Documents not uploaded",
          description: "Your ID documents couldn't be uploaded during registration. Please upload them from your Profile page to complete KYC verification.",
          variant: "destructive",
          duration: 8000,
        });
      }
    } catch { /* sessionStorage unavailable */ }
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("biometric_save_failed") === "1") {
        sessionStorage.removeItem("biometric_save_failed");
        toast({
          title: "Biometric not saved",
          description: "Could not save biometric login. You can enable it later from Profile › Security Settings.",
          duration: 6000,
        });
      }
    } catch { /* sessionStorage unavailable */ }
  }, []);

  if (h.authLoading) return <SkeletonHome />;

  const hasBankInfo = !!(h.user?.bankName && h.user?.bankAccount);
  const kycStatus = h.user?.kycStatus ?? "none";
  const kycVerified = kycStatus === "verified" || kycStatus === "pending";
  const phoneVerified = !!(h.verifLoaded ? h.verifStatus?.phoneVerified : h.user?.phoneVerified);
  const emailVerified =
    !!h.user?.email &&
    !!(h.verifLoaded ? h.verifStatus?.emailVerified : h.user?.emailVerified);

  const showPhoneBanner = !phoneVerified;
  const showEmailBanner = !!h.user?.email && !emailVerified;
  const showBankBanner = !hasBankInfo;
  const showKycBanner = !!(h.config.wallet?.kycRequired && !kycVerified);

  const activeOrderCount = Math.max(0, Number(h.user?.activeOrderCount ?? 0));
  const unreadNotifications = Math.max(0, Number(h.user?.unreadNotifications ?? 0));
  const maxDeliveries = Math.max(1, Number(h.user?.maxDeliveries ?? h.config.rider?.maxDeliveries ?? 3));

  return (
    <PullToRefresh
      onRefresh={h.handlePullRefresh}
      accentColor="var(--color-brand)"
      className="flex min-h-screen animate-[fadeIn_0.3s_ease-out] flex-col bg-page-bg"
    >
      {/* Screen-reader live region */}
      <div role="status" aria-live="assertive" aria-atomic="true" className="sr-only">
        {h.srAnnouncement}
      </div>

      {/* ── Sticky header ── */}
      <HomeHeader
        user={h.user}
        greeting={h.greeting}
        lastSeenLabel={h.lastSeenLabel}
        currency={h.currency}
        T={h.T}
        effectiveOnline={h.effectiveOnline}
        toggling={h.toggling}
        silenceOn={h.silenceOn}
        onToggleOnline={h.toggleOnline}
        onToggleSilence={h.toggleSilence}
        newFlash={h.newFlash}
        unreadNotifications={unreadNotifications}
      />

      <main className="relative z-10 mx-auto w-full max-w-2xl space-y-3 px-4 pt-4 pb-4">

        {/* Profile completion card */}
        <ProfileCompletionCard
          showPhoneBanner={showPhoneBanner}
          showEmailBanner={showEmailBanner}
          showBankBanner={showBankBanner}
          showKycBanner={showKycBanner}
        />

        {/* Alert center — lazy */}
        <Suspense fallback={<AlertSkeleton />}>
          <HomeAlertCenter
            socketConnected={h.socketConnected}
            effectiveOnline={h.effectiveOnline}
            zoneWarning={h.zoneWarning}
            onDismissZone={() => h.setZoneWarning(null)}
            wakeLockWarning={h.wakeLockWarning}
            onDismissWakeLock={() => h.setWakeLockWarning(false)}
            audioLocked={h.audioLocked}
            onUnlockAudio={h.unlockAudioCtx}
            onRetryConnect={h.onRetryConnect}
            gpsWarning={h.gpsWarning}
            onDismissGps={() => h.setGpsWarning(null)}
            isRestricted={!!h.user?.isRestricted || h.user?.approvalStatus === "rejected"}
            riderNotice={h.riderNotice}
            riderNoticeDismissed={h.riderNoticeDismissed}
            onDismissRiderNotice={h.onDismissRiderNotice}
            cancelStatsData={h.cancelStatsData}
            ignoreStatsData={h.ignoreStatsData}
            currency={h.currency}
            minBalance={h.config.rider?.minBalance ?? 0}
            walletBalance={Number(h.user?.walletBalance) || 0}
            blockingReason={h.blockingReason}
            kycStatus={h.user?.kycStatus}
            vehicleType={h.user?.vehicleType}
            vehiclePhoto={h.user?.vehiclePhoto}
            drivingLicense={h.user?.drivingLicense}
            rejectionReason={h.user?.rejectionReason}
            availableFeatures={h.availableFeatures}
            T={h.T}
          />
        </Suspense>

        {/* Stats — lazy */}
        <Suspense fallback={<StatsSkeleton />}>
          <HomeStats
            todayEarned={h.earningsData?.today?.earnings ?? h.user?.stats?.earningsToday ?? 0}
            todayRides={h.earningsData?.today?.deliveries ?? h.user?.stats?.deliveriesToday ?? 0}
            acceptanceRate={
              h.cancelStatsData?.cancelRate != null
                ? Math.max(0, 100 - h.cancelStatsData.cancelRate)
                : null
            }
            rating={h.user?.stats?.rating ?? null}
            onlineSince={h.onlineSince}
            isOnline={h.effectiveOnline}
            currency={h.currency}
            language={h.language}
            maxDeliveries={maxDeliveries}
            activeOrderCount={activeOrderCount}
          />
        </Suspense>

        {/* Goal ring — lazy */}
        <Suspense fallback={<GoalSkeleton />}>
          <GoalSection
            adminGoal={h.config.rider?.dailyGoal ?? 5000}
            personalGoal={h.earningsData?.dailyGoal ?? h.user?.dailyGoal ?? null}
            todayEarnings={h.earningsData?.today?.earnings ?? h.user?.stats?.earningsToday ?? 0}
            currency={h.currency}
            T={h.T}
            refreshUser={h.refreshUser}
          />
        </Suspense>

        {/* Quick actions */}
        <QuickActions />

        {/* Live requests feed (virtualized) */}
        <HomeRequests
          isOnline={h.effectiveOnline}
          totalRequests={h.totalRequests}
          requestsLoading={h.requestsLoading}
          requestsError={h.requestsError}
          visibleOrders={h.visibleOrders}
          visibleRides={h.visibleRides}
          currency={h.currency}
          config={h.config}
          dismissed={h.dismissed}
          onClearDismissed={h.onClearDismissed}
          onAcceptOrder={h.onAcceptOrder}
          onRejectOrder={h.onRejectOrder}
          onAcceptRide={h.onAcceptRide}
          onCounterRide={h.onCounterRide}
          onRejectOffer={h.onRejectOffer}
          onIgnoreRide={h.onIgnoreRide}
          onDismiss={h.onDismiss}
          isNetworkOffline={h.isNetworkOffline}
          acceptOrderPending={h.acceptOrderPending}
          rejectOrderPending={h.rejectOrderPending}
          acceptRidePending={h.acceptRidePending}
          acceptingRideId={h.acceptingRideId}
          acceptingOrderId={h.acceptingOrderId}
          counterRidePending={h.counterRidePending}
          rejectOfferPending={h.rejectOfferPending}
          ignoreRidePending={h.ignoreRidePending}
          requestsServerTime={h.requestsServerTime}
          userId={h.user?.id || ""}
          isRestricted={!!h.user?.isRestricted || h.user?.approvalStatus === "rejected"}
          onRetry={() => h.handlePullRefresh()}
          T={h.T}
          hasActiveTask={h.hasActiveTask}
          activeData={h.activeData}
          trackerBannerEnabled={h.config.content.trackerBannerEnabled}
          trackerBannerPosition={h.config.content.trackerBannerPosition}
          newFlash={h.newFlash}
          onGoOnline={h.toggleOnline}
          toggling={h.toggling}
        />
      </main>

      {/* Active task floating button */}
      {h.hasActiveTask && !h.config.content.trackerBannerEnabled && (
        <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] left-1/2 z-30 w-full max-w-sm -translate-x-1/2 px-4 sm:max-w-[480px] md:max-w-[600px]">
          <Link
            href="/active"
            className="pointer-events-auto flex animate-[slideUp_0.3s_ease-out] items-center gap-3 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-3.5 shadow-lg shadow-green-400/30 transition-transform active:scale-[0.98]"
            aria-label="Go to active task"
          >
            <div className="h-2.5 w-2.5 flex-shrink-0 animate-pulse rounded-full bg-white shadow-sm shadow-white/60" />
            <p className="flex-1 truncate text-sm font-extrabold text-white">
              {h.T("youHaveActiveTask")}
            </p>
            <ChevronRight size={15} className="flex-shrink-0 text-white/80" />
          </Link>
        </div>
      )}

      {/* Offline confirmation dialog */}
      {h.showOfflineConfirm && (
        <OfflineConfirmDialog
          totalRequests={h.totalRequests}
          onStayOnline={() => h.setShowOfflineConfirm(false)}
          onGoOffline={async () => {
            h.setShowOfflineConfirm(false);
            await h.doActualToggle();
          }}
        />
      )}
    </PullToRefresh>
  );
}
