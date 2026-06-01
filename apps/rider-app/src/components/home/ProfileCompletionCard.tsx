import { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { Link } from "wouter";

interface ProfileCompletionCardProps {
  showPhoneBanner: boolean;
  showEmailBanner: boolean;
  showBankBanner: boolean;
  showKycBanner: boolean;
}

interface CompletionItem {
  key: string;
  label: string;
  hint: string;
  href: string;
  actionLabel: string;
}

export function ProfileCompletionCard({
  showPhoneBanner,
  showEmailBanner,
  showBankBanner,
  showKycBanner,
}: ProfileCompletionCardProps) {
  const profileTotal = 4;
  const profileDone =
    (!showPhoneBanner ? 1 : 0) +
    (!showEmailBanner ? 1 : 0) +
    (!showBankBanner ? 1 : 0) +
    (!showKycBanner ? 1 : 0);
  const profilePct = Math.round((profileDone / profileTotal) * 100);

  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(`_ajkm_profileCard_${profilePct}`) === "1";
    } catch {
      return false;
    }
  });

  const anyIncomplete = showPhoneBanner || showEmailBanner || showBankBanner || showKycBanner;

  if (!anyIncomplete || dismissed) return null;

  const items: CompletionItem[] = [
    {
      key: "phone",
      label: "Phone verified",
      hint: "Required to go online",
      href: "/profile",
      actionLabel: "Verify phone",
    },
    {
      key: "bank",
      label: "Bank account added",
      hint: "Required for withdrawals",
      href: "/profile",
      actionLabel: "Add bank",
    },
    {
      key: "kyc",
      label: "KYC approved",
      hint: "CNIC pending admin review",
      href: "/profile",
      actionLabel: "View KYC",
    },
    {
      key: "email",
      label: "Email verified",
      hint: "Improves account security",
      href: "/profile",
      actionLabel: "Verify email",
    },
  ];

  const itemsWithStatus = [
    { ...items[0], done: !showPhoneBanner },
    { ...items[1], done: !showBankBanner },
    { ...items[2], done: !showKycBanner },
    { ...items[3], done: !showEmailBanner },
  ];

  const firstIncomplete = itemsWithStatus.find((i) => !i.done);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      sessionStorage.setItem(`_ajkm_profileCard_${profilePct}`, "1");
    } catch {}
    setDismissed(true);
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-card-dark overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
              Profile {profilePct}% complete
            </p>
            <span className="text-[10px] font-medium text-white/30">
              {profileDone}/{profileTotal}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-brand transition-all duration-500"
              style={{ width: `${profilePct}%` }}
            />
          </div>
          {!expanded && firstIncomplete && (
            <p className="mt-1.5 text-[10px] text-white/40 truncate">
              Next: {firstIncomplete.hint}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleDismiss}
            className="rounded p-0.5 text-white/30 hover:text-white/60"
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
          {expanded ? (
            <ChevronUp size={14} className="text-white/30" />
          ) : (
            <ChevronDown size={14} className="text-white/30" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {itemsWithStatus.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`h-2 w-2 flex-shrink-0 rounded-full ${
                    item.done ? "bg-success" : "bg-white/20"
                  }`}
                />
                <div className="min-w-0">
                  <p
                    className={`text-[11px] font-semibold ${
                      item.done ? "text-success" : "text-white/70"
                    }`}
                  >
                    {item.label}
                  </p>
                  {!item.done && (
                    <p className="text-[10px] text-white/30 truncate">{item.hint}</p>
                  )}
                </div>
              </div>
              {!item.done && (
                <Link
                  href={item.href}
                  className="flex-shrink-0 rounded-lg border border-brand/40 px-2.5 py-1 text-[10px] font-bold text-brand"
                >
                  {item.actionLabel}
                </Link>
              )}
              {item.done && (
                <span className="text-[10px] font-bold text-success">✓ Done</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
