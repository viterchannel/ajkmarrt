import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, X } from "lucide-react";
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
    { key: "phone", label: "Phone verified",    hint: "Required to go online",      href: "/profile", actionLabel: "Verify" },
    { key: "bank",  label: "Bank account added", hint: "Required for withdrawals",   href: "/profile", actionLabel: "Add" },
    { key: "kyc",   label: "KYC approved",        hint: "CNIC pending admin review", href: "/profile", actionLabel: "View" },
    { key: "email", label: "Email verified",      hint: "Improves account security", href: "/profile", actionLabel: "Verify" },
  ];

  const itemsWithStatus = [
    { ...items[0]!, done: !showPhoneBanner },
    { ...items[1]!, done: !showBankBanner },
    { ...items[2]!, done: !showKycBanner },
    { ...items[3]!, done: !showEmailBanner },
  ];

  const firstIncomplete = itemsWithStatus.find((i) => !i.done);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    try { sessionStorage.setItem(`_ajkm_profileCard_${profilePct}`, "1"); } catch {}
    setDismissed(true);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-brand/20 bg-card shadow-sm">
      {/* Header row — div instead of button to avoid nested-button bug */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setExpanded((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left select-none"
        aria-expanded={expanded}
      >
        {/* Progress + label */}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand">
              Profile {profilePct}% complete
            </p>
            <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[9px] font-bold text-brand">
              {profileDone}/{profileTotal}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/20">
            <div
              className="h-full rounded-full bg-brand transition-all duration-500"
              style={{ width: `${profilePct}%` }}
            />
          </div>
          {!expanded && firstIncomplete && (
            <p className="mt-1.5 truncate text-[10px] text-muted-foreground">
              Next: {firstIncomplete.hint}
            </p>
          )}
        </div>

        {/* Dismiss + expand */}
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            onClick={handleDismiss}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground transition-colors active:bg-muted/20"
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
          {expanded ? (
            <ChevronUp size={14} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={14} className="text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded items */}
      {expanded && (
        <div className="space-y-2 px-4 pb-4">
          {itemsWithStatus.map((item) => (
            <div
              key={item.key}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                item.done
                  ? "border-success/20 bg-success/[0.05]"
                  : "border-border/60 bg-muted/5"
              }`}
            >
              {item.done ? (
                <CheckCircle2 size={15} className="flex-shrink-0 text-success" />
              ) : (
                <div className="h-3.5 w-3.5 flex-shrink-0 rounded-full border-2 border-muted-foreground/30" />
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-[11px] font-semibold leading-tight ${item.done ? "text-success" : "text-foreground"}`}>
                  {item.label}
                </p>
                {!item.done && (
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{item.hint}</p>
                )}
              </div>
              {!item.done ? (
                <Link
                  href={item.href}
                  className="flex-shrink-0 rounded-lg bg-brand px-3 py-1 text-[10px] font-bold text-black transition-opacity active:opacity-80"
                >
                  {item.actionLabel}
                </Link>
              ) : (
                <span className="flex-shrink-0 text-[10px] font-bold text-success">Done</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
