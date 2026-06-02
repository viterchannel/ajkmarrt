import { ArrowDown, Bike, Camera, Car, CheckCircle, ChevronRight, MapPin, MessageSquare, PenLine, Phone, RefreshCw, Shield, User, X } from "lucide-react";
import { useState } from "react";
import { toast } from "../../hooks/use-toast";
import { SafeImage } from "../../components/ui/SafeImage";
import {
  DropoffEtaBadge,
  EstimatedArrivalBadge,
  formatCurrency,
  MapErrorBoundary,
  NavButton,
  RIDE_STEP_ICONS,
  RIDE_STEPS,
  RideRouteMap,
  SosButton,
  TurnByTurnPanel,
} from "./ActiveHelpers";
import { SignaturePad } from "./SignaturePad";
import { ActiveHeroCard } from "./ActiveHeroCard";
import { ActiveStepper } from "./ActiveStepper";

export interface ActiveRidePanelProps {
  ride: Record<string, unknown>;
  rideStep: number;
  RIDE_LABELS: string[];
  riderPos: { lat: number; lng: number } | null;
  currency: string;
  riderEarningPct: number;
  startedAt?: string | null;
  config: {
    rides?: { riderEarningPct?: number };
    finance: { riderEarningPct?: number };
    features?: { sos?: boolean };
  };
  updateRideMut: {
    mutate: (args: { id: string; status: string; lat?: number; lng?: number; proofPhotoUrl?: string }) => void;
    isPending: boolean;
  };
  handleCompleteRide: (id: string) => Promise<void>;
  rideProofPhoto: string | null;
  rideProofFile: File | null;
  rideProofUploading: boolean;
  ridePhotoInputRef: React.RefObject<HTMLInputElement | null>;
  handleRidePhotoCapture: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  setRideProofPhoto: (v: string | null) => void;
  setRideProofFile: (v: File | null) => void;
  setShowOtpModal: (v: boolean) => void;
  setOtpInput: (v: string) => void;
  setCancelTarget: (v: "order" | "ride") => void;
  setShowCancelConfirm: (v: boolean) => void;
  pressedBtn: string | null;
  setPressedBtn: (v: string | null) => void;
  T: (key: import("@workspace/i18n").TranslationKey) => string;
}

export function ActiveRidePanel({
  ride,
  rideStep,
  RIDE_LABELS,
  riderPos,
  currency,
  riderEarningPct,
  startedAt,
  config,
  updateRideMut,
  handleCompleteRide,
  rideProofPhoto,
  rideProofFile,
  rideProofUploading,
  ridePhotoInputRef,
  handleRidePhotoCapture,
  setRideProofPhoto,
  setRideProofFile,
  setShowOtpModal,
  setOtpInput,
  setCancelTarget,
  setShowCancelConfirm,
  pressedBtn,
  setPressedBtn,
  T,
}: ActiveRidePanelProps) {
  const [proofMode, setProofMode] = useState<"photo" | "signature">("photo");
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const idRaw = ride.id;
  if (typeof idRaw !== "string" || !idRaw) {
    return (
      <div className="rounded-3xl border border-error/20 bg-error/10 p-5 text-center">
        <p className="text-sm font-bold text-error">{T("invalidRideData")}</p>
      </div>
    );
  }
  const id = idRaw;
  const type = ride.type as string | undefined;
  const status = ride.status as string;
  const riderEarning = parseFloat(String(ride.fare ?? 0)) * (riderEarningPct / 100);

  return (
    <div className="space-y-4">
      <ActiveHeroCard
        kind="ride"
        ride={ride}
        rideStep={rideStep}
        riderPos={riderPos}
        currency={currency}
        startedAt={startedAt}
      />

    <div className="animate-[slideUp_0.4s_ease-out] overflow-hidden rounded-3xl border border-border bg-card shadow-lg shadow-black/40">
      <div className="relative flex items-center gap-3 overflow-hidden bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700 px-4 py-4">
        <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-card/10" />
        <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-card/5" />
        <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-border bg-card/20 shadow-inner backdrop-blur-md">
          {type === "bike" ? (
            <Bike size={22} className="text-white" />
          ) : (
            <Car size={22} className="text-white" />
          )}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-black text-white capitalize">
              {type === "bike" ? T("bikeRide") : T("carRide")}
            </p>
            {(ride as { isPoolRide?: boolean }).isPoolRide && (
              <span className="flex items-center gap-1 rounded-full border border-white/30 bg-card/20 px-2 py-0.5 text-[9px] font-bold tracking-wide text-white">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
                {T("poolRide")}
              </span>
            )}
          </div>
          <p className="mt-0.5 font-mono text-xs text-purple-200">
            #{id.slice(-6).toUpperCase()} · {String(ride.distance ?? "")}km
          </p>
        </div>
        <div className="relative text-right">
          <p className="text-xl font-black tracking-tight text-white">
            {formatCurrency(ride.fare as number, currency)}
          </p>
          <div className="mt-1 rounded-lg border border-border bg-card/15 px-2.5 py-1 backdrop-blur-sm">
            <p className="text-[10px] font-bold text-white">
              {T("youEarnLabel")} {formatCurrency(riderEarning, currency)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {rideStep >= 0 && (
          <div className="rounded-2xl border border-border/80 bg-card p-4">
            <ActiveStepper steps={RIDE_LABELS} currentStep={rideStep} />
          </div>
        )}

        <div className="relative">
          <div className="rounded-2xl border border-success/20 bg-gradient-to-br from-green-50 to-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-md shadow-green-200">
                <MapPin size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-wider text-success uppercase">
                  {T("pickup")}
                </p>
                <p className="mt-0.5 text-sm font-bold text-white">
                  {ride.pickupAddress as string}
                </p>
              </div>
            </div>
          </div>
          <div className="relative z-10 -my-1.5 flex justify-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-border bg-card shadow-sm">
              <ArrowDown size={14} className="text-muted-foreground" />
            </div>
          </div>
          <div className="rounded-2xl border border-error/20 bg-gradient-to-br from-red-50 to-pink-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-pink-600 shadow-md shadow-red-200">
                <MapPin size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-wider text-error uppercase">
                  {T("dropOff")}
                </p>
                <p className="mt-0.5 text-sm font-bold text-white">
                  {ride.dropAddress as string}
                </p>
              </div>
            </div>
          </div>
        </div>

        {!!ride.customerName && (
          <div className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-200">
                <User size={22} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold tracking-wider text-blue-500 uppercase">
                  {T("passenger")}
                </p>
                <p className="text-base font-black text-white">{ride.customerName as string}</p>
                {!!ride.customerPhone && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone size={10} /> {ride.customerPhone as string}
                  </p>
                )}
              </div>
            </div>
            <div className="border-t border-blue-500/30 bg-muted/60 px-3 py-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {!!ride.customerPhone && (
                  <a
                    href={`tel:${ride.customerPhone as string}`}
                    className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-3 py-3 text-sm font-bold text-white shadow-md shadow-green-200 transition-all active:scale-[0.97]"
                  >
                    <Phone size={15} /> {T("callPassenger")}
                  </a>
                )}
                <button
                  onClick={() => {
                    const ajkId = ride.customerAjkId as string | null;
                    window.location.href = ajkId
                      ? `/chat?ajkId=${encodeURIComponent(ajkId)}`
                      : "/chat";
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-3 py-3 text-sm font-bold text-white shadow-md shadow-blue-200 transition-all active:scale-[0.97]"
                >
                  <MessageSquare size={15} /> {T("chat")}
                </button>
              </div>
              {(status === "accepted" || status === "arrived" || status === "in_transit") && (
                <div className="flex justify-end">
                  <SosButton
                    rideId={id}
                    riderPos={riderPos}
                    T={T as (key: import("@workspace/i18n").TranslationKey) => string}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {status === "accepted" && (
          <EstimatedArrivalBadge
            riderPos={riderPos}
            pickupLat={ride.pickupLat as number}
            pickupLng={ride.pickupLng as number}
            vehicleType={type}
          />
        )}

        <div className="flex gap-2">
          {status === "accepted" ? (
            <NavButton
              label={T("goToPickup")}
              lat={ride.pickupLat as number}
              lng={ride.pickupLng as number}
              address={ride.pickupAddress as string}
              color="orange"
            />
          ) : (
            <NavButton
              label={T("goToDropOff")}
              lat={ride.dropLat as number}
              lng={ride.dropLng as number}
              address={ride.dropAddress as string}
              color="blue"
            />
          )}
        </div>

        {riderPos && status === "accepted" && ride.pickupLat != null && ride.pickupLng != null && (
          <MapErrorBoundary>
            <TurnByTurnPanel
              fromLat={riderPos.lat}
              fromLng={riderPos.lng}
              toLat={ride.pickupLat as number}
              toLng={ride.pickupLng as number}
              label={T("pickup")}
              riderLat={riderPos.lat}
              riderLng={riderPos.lng}
            />
          </MapErrorBoundary>
        )}
        {riderPos &&
          (status === "arrived" || status === "in_transit") &&
          ride.dropLat != null &&
          ride.dropLng != null && (
            <MapErrorBoundary>
              <TurnByTurnPanel
                fromLat={riderPos.lat}
                fromLng={riderPos.lng}
                toLat={ride.dropLat as number}
                toLng={ride.dropLng as number}
                label={T("dropOff")}
                riderLat={riderPos.lat}
                riderLng={riderPos.lng}
              />
            </MapErrorBoundary>
          )}

        {ride.pickupLat != null &&
          ride.pickupLng != null &&
          ride.dropLat != null &&
          ride.dropLng != null && (
            <MapErrorBoundary fallbackMsg={T("routeMapUnavailable")}>
              <RideRouteMap
                pickupLat={ride.pickupLat as number}
                pickupLng={ride.pickupLng as number}
                pickupLabel={ride.pickupAddress as string}
                dropLat={ride.dropLat as number}
                dropLng={ride.dropLng as number}
                dropLabel={ride.dropAddress as string}
                riderLat={riderPos?.lat}
                riderLng={riderPos?.lng}
              />
            </MapErrorBoundary>
          )}


        {/* ── Live ETA to drop-off (in_transit only) ── */}
        {status === "in_transit" && (
          <DropoffEtaBadge
            riderPos={riderPos}
            dropLat={ride.dropLat as number | null}
            dropLng={ride.dropLng as number | null}
            vehicleType={type}
          />
        )}

        {/* ── Proof-of-drop-off card (in_transit only) ── */}
        {status === "in_transit" && (
          <div className="animate-[slideUp_0.3s_ease-out] rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
            <p className="mb-3 flex items-center gap-2 text-xs font-extrabold text-blue-400">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/15">
                <Camera className="h-3.5 w-3.5 text-blue-400" />
              </span>
              {T("dropOffProofCard")} <span className="font-normal text-blue-400">({T("optional")})</span>
            </p>

            {/* Mode toggle */}
            {!rideProofPhoto && (
              <div className="mb-3 flex overflow-hidden rounded-xl border border-blue-500/30 bg-muted">
                <button
                  onClick={() => setProofMode("photo")}
                  className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-bold transition-colors ${proofMode === "photo" ? "bg-blue-600 text-white" : "text-blue-500"}`}
                >
                  <Camera size={13} /> {T("takePhoto")}
                </button>
                <button
                  onClick={() => setProofMode("signature")}
                  className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-bold transition-colors ${proofMode === "signature" ? "bg-blue-600 text-white" : "text-blue-500"}`}
                >
                  <PenLine size={13} /> {T("signatureLabel")}
                </button>
              </div>
            )}

            <input
              id="ride-proof-input"
              ref={ridePhotoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleRidePhotoCapture}
            />

            {rideProofPhoto ? (
              <div className="space-y-2.5">
                <div className="relative h-44 overflow-hidden rounded-2xl bg-muted shadow-inner">
                  <SafeImage
                    src={rideProofPhoto}
                    alt={T("deliveryProof")}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                  <div className="absolute top-3 right-3">
                    <span className="flex items-center gap-1 rounded-full bg-success px-3 py-1 text-[10px] font-bold text-white shadow-lg">
                      <CheckCircle size={10} /> {T("proofReady")}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setRideProofPhoto(null);
                    setRideProofFile(null);
                    if (ridePhotoInputRef.current) ridePhotoInputRef.current.value = "";
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-blue-500/30 bg-muted py-2.5 text-xs font-bold text-blue-400 transition-colors active:bg-blue-900/20"
                >
                  <Camera size={12} /> {T("retakeOrClear")}
                </button>
              </div>
            ) : proofMode === "photo" ? (
              <button
                onClick={() => ridePhotoInputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2.5 rounded-2xl border-2 border-dashed border-blue-500/30 bg-muted py-5 text-blue-500 transition-all hover:bg-blue-900/20 active:scale-[0.98]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15">
                  <Camera className="h-6 w-6 text-blue-500" />
                </span>
                <span className="text-sm font-bold">{T("takeDropOffPhoto")}</span>
                <span className="text-[10px] text-blue-400">{T("opensCameraHint")}</span>
              </button>
            ) : (
              <button
                onClick={() => setShowSignaturePad(true)}
                className="flex w-full flex-col items-center gap-2.5 rounded-2xl border-2 border-dashed border-blue-500/30 bg-muted py-5 text-blue-500 transition-all hover:bg-blue-900/20 active:scale-[0.98]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15">
                  <PenLine className="h-6 w-6 text-blue-500" />
                </span>
                <span className="text-sm font-bold">{T("captureSignature")}</span>
                <span className="text-[10px] text-blue-400">{T("drawWithFingerHint")}</span>
              </button>
            )}

            {rideProofFile && !rideProofPhoto && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">{T("processingLabel")}</p>
            )}
          </div>
        )}

        {showSignaturePad && (
          <SignaturePad
            onConfirm={(dataUrl, file) => {
              setRideProofPhoto(dataUrl);
              setRideProofFile(file);
              setShowSignaturePad(false);
            }}
            onCancel={() => setShowSignaturePad(false)}
          />
        )}

        {/* ── Primary action buttons ── */}
        <div className="flex gap-2 pt-1">
          {status === "accepted" && (
            <button
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) =>
                      updateRideMut.mutate({
                        id,
                        status: "arrived",
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                      }),
                    () => updateRideMut.mutate({ id, status: "arrived" }),
                    { enableHighAccuracy: true, timeout: 5000 }
                  );
                } else {
                  updateRideMut.mutate({ id, status: "arrived" });
                }
              }}
              disabled={updateRideMut.isPending}
              onTouchStart={() => setPressedBtn("arrived")}
              onTouchEnd={() => setPressedBtn(null)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand py-4 font-black text-black shadow-lg transition-transform disabled:opacity-60 min-h-[52px] ${pressedBtn === "arrived" ? "scale-[0.97]" : ""}`}
            >
              <MapPin size={16} /> {T("arrivedAtPickup")}
            </button>
          )}
          {["arrived", "accepted"].includes(status) &&
            !(ride as { otpVerified?: boolean }).otpVerified && (
              <button
                onClick={() => {
                  setOtpInput("");
                  setShowOtpModal(true);
                }}
                disabled={updateRideMut.isPending}
                onTouchStart={() => setPressedBtn("otp")}
                onTouchEnd={() => setPressedBtn(null)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-black text-white shadow-lg shadow-blue-200 transition-transform disabled:opacity-60 ${pressedBtn === "otp" ? "scale-[0.97]" : ""}`}
              >
                <Shield size={16} /> {T("verifyOtpStart")}
              </button>
            )}
          {status === "arrived" && (ride as { otpVerified?: boolean }).otpVerified && (
            <button
              onClick={() => updateRideMut.mutate({ id, status: "in_transit" })}
              disabled={updateRideMut.isPending}
              onTouchStart={() => setPressedBtn("start")}
              onTouchEnd={() => setPressedBtn(null)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand py-4 font-black text-black shadow-lg transition-transform disabled:opacity-60 min-h-[52px] ${pressedBtn === "start" ? "scale-[0.97]" : ""}`}
            >
              <Car size={16} /> {T("startRide")}
            </button>
          )}
          {status === "in_transit" && (
            <button
              onClick={() => void handleCompleteRide(id)}
              disabled={updateRideMut.isPending || rideProofUploading}
              onTouchStart={() => setPressedBtn("complete")}
              onTouchEnd={() => setPressedBtn(null)}
              className={`flex flex-1 items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 py-4 text-base font-black text-white shadow-lg shadow-green-200 transition-transform disabled:opacity-60 ${pressedBtn === "complete" ? "scale-[0.97]" : ""}`}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-card/20">
                {rideProofUploading ? (
                  <RefreshCw size={17} className="animate-spin" />
                ) : (
                  <CheckCircle size={17} />
                )}
              </span>
              {rideProofUploading ? T("uploadingPhoto") : T("completeRide")}
              {!rideProofUploading && <ChevronRight size={15} className="ml-auto opacity-60" />}
            </button>
          )}
          {(status === "accepted" || status === "arrived" || status === "in_transit") && (
            <button
              onClick={() => {
                setCancelTarget("ride");
                setShowCancelConfirm(true);
              }}
              disabled={updateRideMut.isPending}
              className="rounded-2xl border-2 border-error/30 bg-error/10 px-5 py-4 text-sm font-bold text-error transition-colors active:bg-error/15"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
