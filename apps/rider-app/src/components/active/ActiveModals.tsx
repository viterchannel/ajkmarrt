import { AlertTriangle, CheckCircle, MessageSquare, Phone, Shield, Star, UserX, X } from "lucide-react";
import { useState } from "react";
import { api } from "../../lib/api";
import { toast } from "../../hooks/use-toast";

export interface PostDeliveryFeedbackProps {
  show: boolean;
  kind: "order" | "ride";
  entityId: string;
  earningsMsg: string;
  onDone: () => void;
  currency?: string;
}

export function PostDeliverySheet({
  show,
  kind,
  entityId,
  earningsMsg,
  onDone,
  currency = "Rs.",
}: PostDeliveryFeedbackProps) {
  const [tip, setTip] = useState<number>(0);
  const [customTip, setCustomTip] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  if (!show) return null;

  const tipOptions = [0, 1, 2, 5];
  const effectiveTip = isCustom ? parseFloat(customTip) || 0 : tip;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.submitFeedback({
        category: "post_delivery",
        message: kind === "order" ? "Order delivered" : "Ride completed",
        rating: rating > 0 ? rating : undefined,
        tip: effectiveTip > 0 ? effectiveTip : undefined,
        entityId,
        entityKind: kind,
      } as Parameters<typeof api.submitFeedback>[0]);
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Could not submit feedback",
        variant: "destructive",
      });
    }
    setSubmitting(false);
    toast({ title: earningsMsg });
    onDone();
  };

  const handleSkip = () => {
    toast({ title: earningsMsg });
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md animate-[slideUp_0.3s_ease-out] rounded-t-3xl bg-card-dark px-5 pb-8 pt-5 shadow-2xl">
        <div className="mb-1 flex items-center justify-between">
          <div>
            <p className="text-lg font-black text-white">
              {kind === "order" ? "Order Delivered!" : "Ride Completed!"}
            </p>
            <p className="text-xs text-[#B0B0B0]">Rate the customer &amp; leave a tip (optional)</p>
          </div>
          <button
            onClick={handleSkip}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-border-dark"
          >
            <X size={16} className="text-[#B0B0B0]" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-yellow-500/30 bg-yellow-900/20 p-4">
            <p className="mb-3 text-xs font-bold tracking-wider text-yellow-400 uppercase">
              Rate Customer
            </p>
            <div className="flex justify-center gap-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setRating(s)}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  className="transition-transform active:scale-90"
                >
                  <Star
                    size={32}
                    className={
                      s <= (hovered || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-[#B0B0B0]"
                    }
                    fill={s <= (hovered || rating) ? "currentColor" : "none"}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="mt-2 text-center text-xs font-medium text-yellow-400">
                {["", "Poor", "Fair", "Good", "Great", "Excellent!"][rating]}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-success/30 bg-green-900/20 p-4">
            <p className="mb-3 text-xs font-bold tracking-wider text-success uppercase">
              Add Tip
            </p>
            <div className="flex gap-2 flex-wrap">
              {tipOptions.map((t) => (
                <button
                  key={t}
                  onClick={() => { setTip(t); setIsCustom(false); }}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${
                    !isCustom && tip === t
                      ? "bg-success text-white shadow-md shadow-green-200"
                      : "bg-border-dark border border-success/30 text-success"
                  }`}
                >
                  {t === 0 ? "No tip" : `${currency}${t}`}
                </button>
              ))}
              <button
                onClick={() => setIsCustom(true)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${
                  isCustom
                    ? "bg-success text-white shadow-md shadow-green-200"
                    : "bg-border-dark border border-success/30 text-success"
                }`}
              >
                Custom
              </button>
            </div>
            {isCustom && (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-success/30 bg-border-dark px-3 py-2">
                <span className="font-bold text-success">{currency}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  value={customTip}
                  onChange={(e) => setCustomTip(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 text-sm font-bold outline-none text-white"
                  autoFocus
                />
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={handleSkip}
            className="flex-1 rounded-2xl border-2 border-white/10 py-3.5 text-sm font-bold text-[#B0B0B0]"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-[2] rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 py-3.5 text-sm font-black text-white shadow-lg shadow-green-200 disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface CancellationReasonModalProps {
  show: boolean;
  cancelledBy: "customer" | "admin" | "system" | null;
  reason: string | null;
  onDone: () => void;
}

export function CancellationReasonModal({
  show,
  cancelledBy,
  reason,
  onDone,
}: CancellationReasonModalProps) {
  if (!show) return null;
  const byLabel =
    cancelledBy === "customer"
      ? "Customer"
      : cancelledBy === "admin"
        ? "Admin"
        : "System";
  return (
    <div className="fixed inset-0 z-50 flex animate-[fadeIn_0.2s_ease-out] items-center justify-center bg-black/60 p-4 backdrop-blur-md">
      <div className="w-full max-w-sm animate-[slideUp_0.3s_ease-out] overflow-hidden rounded-3xl bg-card-dark shadow-2xl">
        <div className="flex flex-col items-center gap-3 border-b border-error/30 bg-gradient-to-br from-red-50 to-pink-50 px-6 py-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-pink-600 shadow-lg shadow-red-200">
            <UserX className="h-8 w-8 text-white" />
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-white">Ride Cancelled</p>
            <p className="mt-1 text-sm text-[#B0B0B0]">
              Cancelled by <span className="font-bold text-error">{byLabel}</span>
            </p>
          </div>
        </div>
        <div className="space-y-4 p-5">
          {reason ? (
            <div className="rounded-2xl border border-error/30 bg-red-900/20 px-4 py-4">
              <p className="mb-1 text-[10px] font-bold tracking-wider text-error uppercase">
                Reason
              </p>
              <p className="text-sm font-semibold text-error">{reason}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-card-dark px-4 py-3 text-center">
              <p className="text-sm text-[#B0B0B0]">No reason was provided.</p>
            </div>
          )}
          <p className="text-center text-xs text-[#B0B0B0]">
            This ride has been removed from your active tasks. Check your earnings for any applicable cancellation fee.
          </p>
          <button
            onClick={onDone}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-gray-800 to-gray-900 py-4 font-black text-white shadow-lg transition-transform active:scale-[0.97]"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}

export interface ActiveModalsProps {
  showOtpModal: boolean;
  showCancelConfirm: boolean;
  showNoPhotoWarning: boolean;
  showAdminChat: boolean;
  cancelTarget: "order" | "ride" | null;
  otpInput: string;
  setOtpInput: (v: string) => void;
  setShowOtpModal: (v: boolean) => void;
  setShowCancelConfirm: (v: boolean) => void;
  setShowNoPhotoWarning: (v: boolean) => void;
  setShowAdminChat: (v: boolean) => void;
  chatReply: string;
  setChatReply: (v: string) => void;
  adminMessages: Array<{ text: string; ts: string; from: "rider" | "admin" }>;
  setAdminMessages: (
    fn: (
      prev: Array<{ text: string; ts: string; from: "rider" | "admin" }>
    ) => Array<{ text: string; ts: string; from: "rider" | "admin" }>
  ) => void;
  socketRef: React.RefObject<{ emit: (event: string, data: unknown) => void } | null>;
  order: Record<string, unknown> | null;
  ride: Record<string, unknown> | null;
  updateOrderMut: { mutate: (args: { id: string; status: string }) => void; isPending: boolean };
  updateRideMut: { mutate: (args: { id: string; status: string }) => void; isPending: boolean };
  verifyOtpMut: { mutate: (args: { id: string; otp: string }) => void; isPending: boolean };
  handleMarkDelivered: (id: string, forceNoPhoto?: boolean) => void;
  proofUploading: boolean;
  otpAttempts: number;
  feedbackSheet: PostDeliveryFeedbackProps;
  T: (key: import("@workspace/i18n").TranslationKey) => string;
}

export function ActiveModals({
  showOtpModal,
  showCancelConfirm,
  showNoPhotoWarning,
  showAdminChat,
  cancelTarget,
  otpInput,
  setOtpInput,
  setShowOtpModal,
  setShowCancelConfirm,
  setShowNoPhotoWarning,
  setShowAdminChat,
  chatReply,
  setChatReply,
  adminMessages,
  setAdminMessages,
  socketRef,
  order,
  ride,
  updateOrderMut,
  updateRideMut,
  verifyOtpMut,
  handleMarkDelivered,
  proofUploading,
  otpAttempts,
  feedbackSheet,
  T,
}: ActiveModalsProps) {
  const otpBlocked = otpAttempts >= 3;
  const attemptsLeft = Math.max(0, 3 - otpAttempts);

  return (
    <>
      {/* Admin Chat Modal */}
      {showAdminChat && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowAdminChat(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-card-dark p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="flex items-center gap-2 font-black text-white">
                  <MessageSquare size={16} className="text-blue-400" /> Admin Chat
                </p>
                <p className="text-xs text-[#B0B0B0]">Admin can see your messages</p>
              </div>
              <button onClick={() => setShowAdminChat(false)}>
                <X size={18} className="text-[#B0B0B0]" />
              </button>
            </div>
            <div className="mb-3 max-h-64 min-h-[80px] space-y-2 overflow-y-auto rounded-2xl bg-border-dark p-3">
              {adminMessages.map((m) => (
                <div
                  key={`${m.ts}-${m.text}`}
                  className={`flex ${m.from === "rider" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-3 py-1.5 text-xs ${m.from === "rider" ? "bg-brand text-white" : "bg-blue-600 text-white"}`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={chatReply}
                onChange={(e) => setChatReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && chatReply.trim() && socketRef.current) {
                    const msg = chatReply.trim();
                    socketRef.current.emit("rider:chat", { message: msg });
                    setAdminMessages((prev) => [
                      ...prev,
                      { text: msg, ts: new Date().toISOString(), from: "rider" },
                    ]);
                    setChatReply("");
                  }
                }}
                placeholder="Reply to admin..."
                className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                onClick={() => {
                  if (!chatReply.trim() || !socketRef.current) return;
                  const msg = chatReply.trim();
                  socketRef.current.emit("rider:chat", { message: msg });
                  setAdminMessages((prev) => [
                    ...prev,
                    { text: msg, ts: new Date().toISOString(), from: "rider" },
                  ]);
                  setChatReply("");
                }}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OTP Verification Modal */}
      {showOtpModal && ride && (
        <div className="fixed inset-0 z-50 flex animate-[fadeIn_0.2s_ease-out] items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm animate-[slideUp_0.3s_ease-out] overflow-hidden rounded-3xl bg-card-dark shadow-2xl">
            <div className="flex flex-col items-center gap-3 border-b border-blue-500/30 bg-gradient-to-br from-blue-50 to-indigo-50 px-6 py-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-200">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-white">Enter Customer OTP</p>
                <p className="mt-1 text-sm text-[#B0B0B0]">
                  Ask the customer for their 4-digit trip code
                </p>
              </div>
            </div>
            <div className="space-y-4 px-6 py-5">
              {otpBlocked ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-error/30 bg-red-900/20 px-4 py-4 text-center">
                    <AlertTriangle size={28} className="mx-auto mb-2 text-error" />
                    <p className="text-sm font-black text-error">Too many failed attempts</p>
                    <p className="mt-1 text-xs text-error">
                      OTP entry is locked for this session. Please contact support.
                    </p>
                  </div>
                  <div className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 py-4 font-black text-white shadow-lg shadow-red-200">
                    <Phone size={18} /> Contact Support via Admin Chat
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={otpInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setOtpInput(val);
                    }}
                    placeholder="_ _ _ _"
                    className="w-full rounded-2xl border-2 border-white/10 py-4 text-center text-3xl font-black tracking-[0.5em] focus:border-blue-500 focus:outline-none"
                  />
                  {otpAttempts > 0 && (
                    <p className="text-center text-xs font-bold text-error">
                      Wrong code — {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining
                    </p>
                  )}
                  {otpInput.length < 4 && otpAttempts === 0 && (
                    <p className="text-center text-xs font-medium text-blue-500">
                      Enter the 4-digit code from the customer
                    </p>
                  )}
                </div>
              )}

              {!otpBlocked && (
                <button
                  onClick={() => {
                    if (otpInput.length === 4)
                      verifyOtpMut.mutate({ id: ride.id as string, otp: otpInput });
                  }}
                  disabled={otpInput.length !== 4 || verifyOtpMut.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-black text-white shadow-lg shadow-blue-200 disabled:opacity-50"
                >
                  <CheckCircle size={18} />{" "}
                  {verifyOtpMut.isPending ? "Verifying…" : "Verify & Start Ride"}
                </button>
              )}
              <button
                onClick={() => setShowOtpModal(false)}
                className="w-full py-2 text-sm font-bold text-[#B0B0B0]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirm Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex animate-[fadeIn_0.2s_ease-out] items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm animate-[slideUp_0.3s_ease-out] overflow-hidden rounded-3xl bg-card-dark shadow-2xl">
            <div className="flex flex-col items-center gap-3 border-b border-error/30 bg-gradient-to-br from-red-50 to-pink-50 px-6 py-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-pink-600 shadow-lg shadow-red-200">
                <AlertTriangle className="h-8 w-8 text-white" />
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-white">
                  {T("cancelConfirm")} {cancelTarget === "order" ? T("deliveryLabel") : T("ride")}?
                </p>
                <p className="mt-1.5 text-sm text-[#B0B0B0]">{T("actionNotReversible")}</p>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <div className="flex gap-3 rounded-2xl border-2 border-warning/30 bg-amber-900/20 px-4 py-3.5">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-warning/15">
                  <Shield size={16} className="text-warning" />
                </div>
                <p className="text-xs leading-relaxed font-medium text-warning">
                  {T("cancelWarning")}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 rounded-xl bg-border-dark py-3 font-bold text-[#B0B0B0] transition-colors active:bg-[#3A3A3A]"
                >
                  {T("goBack")}
                </button>
                <button
                  onClick={() => {
                    setShowCancelConfirm(false);
                    if (cancelTarget === "order" && order) {
                      updateOrderMut.mutate({ id: order.id as string, status: "cancelled" });
                    } else if (cancelTarget === "ride" && ride) {
                      updateRideMut.mutate({ id: ride.id as string, status: "cancelled" });
                    }
                  }}
                  disabled={updateOrderMut.isPending || updateRideMut.isPending}
                  className="flex-1 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 py-3 font-bold text-white shadow-md shadow-red-200 transition-transform active:scale-[0.97] disabled:opacity-60"
                >
                  {updateOrderMut.isPending || updateRideMut.isPending
                    ? T("cancelling")
                    : T("yesCancel")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Photo Warning Modal */}
      {showNoPhotoWarning && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex animate-[fadeIn_0.15s_ease-out] items-end justify-center bg-black/50">
          <div className="mx-auto w-full max-w-sm animate-[slideUp_0.2s_ease-out] rounded-t-3xl bg-card-dark px-6 py-6 shadow-2xl">
            <div className="mb-5 flex flex-col items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/15">
                <AlertTriangle size={28} className="text-warning" />
              </div>
              <div className="text-center">
                <p className="text-base font-extrabold text-white">No Photo Taken</p>
                <p className="mt-1 text-sm leading-relaxed text-[#B0B0B0]">
                  Delivering without proof photo may cause disputes. Are you sure?
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNoPhotoWarning(false)}
                className="h-12 flex-1 rounded-xl border-2 border-white/10 text-sm font-bold text-[#B0B0B0] transition-colors hover:bg-border-dark"
              >
                Take Photo
              </button>
              <button
                onClick={() => {
                  setShowNoPhotoWarning(false);
                  if (order) handleMarkDelivered(order.id as string, true);
                }}
                disabled={proofUploading || updateOrderMut.isPending}
                className="h-12 flex-1 rounded-xl bg-warning text-sm font-bold text-white transition-colors hover:bg-warning/90 disabled:opacity-60"
              >
                Deliver Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Delivery Feedback Sheet */}
      <PostDeliverySheet {...feedbackSheet} />
    </>
  );
}
