import { toast } from "@/hooks/use-toast";
import { PullToRefresh } from "../components/PullToRefresh";
import { useHomeData } from "../components/home/useHomeData";
import { HomeHeader } from "../components/home/HomeHeader";
import { HomeStats } from "../components/home/HomeStats";
import { HomeAlertCenter } from "../components/home/HomeAlertCenter";
import { HomeRequests } from "../components/home/HomeRequests";
import { GoalSection } from "../components/home/GoalSection";
import { SkeletonHome } from "../components/dashboard/SkeletonHome";
import { OfflineConfirmDialog } from "../components/dashboard/OfflineConfirmDialog";
import { ChevronRight } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const h = useHomeData();

  if (h.authLoading) return <SkeletonHome />;

  /* Show a one-time warning when document upload failed silently during registration */
  const showDocWarning = (() => {
    try {
      if (sessionStorage.getItem("reg_doc_upload_warning") === "1") {
        sessionStorage.removeItem("reg_doc_upload_warning");
        return true;
      }
      return false;
    } catch { return false; }
  })();
  if (showDocWarning) {
    toast({
      title: "Documents not uploaded",
      description: "Your ID documents couldn't be uploaded during registration. Please upload them from your Profile page to complete KYC verification.",
      variant: "destructive",
      duration: 8000,
    });
  }

  const showBiometricWarning = (() => {
    try {
      if (sessionStorage.getItem("biometric_save_failed") === "1") {
        sessionStorage.removeItem("biometric_save_failed");
        return true;
      }
      return false;
    } catch { return false; }
  })();
  if (showBiometricWarning) {
    toast({
      title: "Biometric not saved",
      description: "Could not save biometric login. You can enable it later from Profile › Security Settings.",
      duration: 6000,
    });
  }

  /* Profile banner conditions */
  const hasBankInfo = !!(h.user?.bankName && h.user?.bankAccount);
  const kycStatus = (h.user as any)?.kycStatus ?? "none";
  const kycVerified = kycStatus === "verified" || kycStatus === "pending";
  const phoneVerified = !!(h.verifLoaded ? h.verifStatus?.phoneVerified : (h.user as any)?.phoneVerified);
  const emailVerified = !!(h.user?.email) && !!(h.verifLoaded ? h.verifStatus?.emailVerified : (h.user as any)?.emailVerified);

  const showProfileBanner = !h.profileBannerDismissed && (
    !phoneVerified || (!!h.user?.email && !emailVerified) || !hasBankInfo || (h.config.wallet?.kycRequired && !kycVerified)
  );

  const showPhoneBanner = !phoneVerified;
  const showEmailBanner = !!(h.user?.email) && !emailVerified;
  const showBankBanner = !hasBankInfo;
  const showKycBanner = h.config.wallet?.kycRequired && !kycVerified;

  const handleDismissProfile = () => {
    try { sessionStorage.setItem("_ajkm_profileBannerDismissed", "1"); } catch {}
    h.setProfileBannerDismissed(true);
  };

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

      {/* ── Header: greeting, wallet, online toggle + sound ── */}
      <HomeHeader
        user={h.user}
        greeting={h.greeting}
        lastSeenLabel={h.lastSeenLabel}
        currency={h.currency}
        T={h.T}
        effectiveOnline={h.effectiveOnline}
        toggling={h.toggling}
        silenceOn={h.silenceOn}
        blockingReason={h.blockingReason}
        onToggleOnline={h.toggleOnline}
        onToggleSilence={h.toggleSilence}
        newFlash={h.newFlash}
      />

      {/* ── Main content ── */}
      <main className="relative z-10 mx-auto w-full max-w-2xl space-y-3 px-3 pt-4 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] sm:px-4">
        {/* Alert Center: all banners consolidated */}
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
          showPhoneBanner={showPhoneBanner}
          showEmailBanner={showEmailBanner}
          showBankBanner={showBankBanner}
          showKycBanner={showKycBanner}
          profileBannerDismissed={h.profileBannerDismissed}
          onDismissProfileBanner={handleDismissProfile}
          T={h.T}
        />

        {/* Unified Stats */}
        <HomeStats
          todayEarned={h.earningsData?.today?.earnings ?? h.user?.stats?.earningsToday ?? 0}
          todayRides={h.earningsData?.today?.deliveries ?? h.user?.stats?.deliveriesToday ?? 0}
          acceptanceRate={h.cancelStatsData?.cancelRate != null ? Math.max(0, 100 - h.cancelStatsData.cancelRate) : null}
          rating={h.user?.stats?.rating ?? null}
          onlineSince={h.onlineSince}
          isOnline={h.effectiveOnline}
          currency={h.currency}
          language={h.language}
          maxDeliveries={h.config.rider?.maxDeliveries ?? 3}
        />

        {/* Goal Section */}
        <GoalSection
          adminGoal={h.config.rider?.dailyGoal ?? 5000}
          personalGoal={h.earningsData?.dailyGoal ?? h.user?.dailyGoal ?? null}
          todayEarnings={h.earningsData?.today?.earnings ?? h.user?.stats?.earningsToday ?? 0}
          currency={h.currency}
          T={h.T}
          refreshUser={h.refreshUser}
        />

        {/* Requests or Offline State */}
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
        <Link
          href="/active"
          className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] left-4 z-30 block animate-[slideUp_0.3s_ease-out] rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-3 shadow-lg shadow-green-300/40 transition-transform active:scale-[0.98]"
          aria-label="Go to active task"
        >
          <div className="mx-auto flex max-w-md items-center gap-2.5">
            <div className="h-2.5 w-2.5 flex-shrink-0 animate-pulse rounded-full bg-white" />
            <p className="flex-1 truncate text-sm font-extrabold text-white">
              {h.T("youHaveActiveTask")}
            </p>
            <ChevronRight size={14} className="flex-shrink-0 text-white/80" />
          </div>
        </Link>
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
