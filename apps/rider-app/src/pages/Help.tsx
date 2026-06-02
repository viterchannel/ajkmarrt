import { useState } from "react";
import { ChevronDown, ChevronUp, MessageCircle, AlertTriangle, Phone, Mail } from "lucide-react";
import { useLanguage } from "../lib/useLanguage";
import { tDual, type TranslationKey } from "@workspace/i18n";
import { useLocation } from "wouter";

const FAQS = [
  {
    q: "How do I accept a ride or delivery?",
    a: "When a new request comes in, you'll see a notification on your Home screen. Tap Accept before the timer runs out. Make sure you're online and available.",
  },
  {
    q: "How do I get paid?",
    a: "Your earnings are credited to your AJKMart Wallet after each completed job. You can withdraw to your bank account from the Wallet page once you meet the minimum payout amount.",
  },
  {
    q: "What if the customer cancels?",
    a: "If the customer cancels after you've already reached the pickup point, you may be eligible for a cancellation fee. Check the Earnings page for details.",
  },
  {
    q: "How do I update my documents?",
    a: "Go to Profile → Documents tab to upload or update your CNIC, driving license, vehicle registration, or vehicle photo.",
  },
  {
    q: "Why is my account under review?",
    a: "New accounts are reviewed within 24–48 hours. If your documents are incomplete or need verification, you'll see a status message on your Profile page.",
  },
];

function AccordionItem({
  q,
  a,
  open,
  onToggle,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mb-2 overflow-hidden rounded-xl border border-border bg-card">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors active:bg-muted"
      >
        <span className="pr-3 text-sm font-semibold text-foreground">{q}</span>
        {open ? (
          <ChevronUp size={18} className="flex-shrink-0 text-brand" />
        ) : (
          <ChevronDown size={18} className="flex-shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="border-t border-border bg-muted/30 px-4 pb-4 pt-1">
          <p className="text-sm leading-relaxed text-muted-foreground">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function Help() {
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  const [, navigate] = useLocation();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-page-bg" style={{ paddingBottom: "calc(64px + max(8px, env(safe-area-inset-bottom, 8px)))" }}>
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border bg-page-bg px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3">
        <button
          onClick={() => navigate("/profile")}
          aria-label="Back to profile"
          className="mb-1 flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown size={18} className="rotate-90" />
          <span className="text-sm">Back</span>
        </button>
        <h1 className="text-xl font-bold text-foreground">Help & FAQ</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">Common questions and support</p>
      </div>

      <div className="px-4 pt-5">
        {/* FAQ Section */}
        <div className="mb-6">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Frequently Asked Questions
          </h2>
          {FAQS.map((item, i) => (
            <AccordionItem
              key={i}
              q={item.q}
              a={item.a}
              open={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>

        {/* Chat with Support */}
        <div className="mb-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Support
          </h2>
          <button
            onClick={() => navigate("/chat")}
            className="flex w-full items-center gap-4 rounded-xl border border-brand/30 bg-brand/10 px-4 py-4 transition-colors hover:bg-brand/15"
            aria-label="Open support chat"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand/20">
              <MessageCircle size={20} className="text-brand" />
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-foreground">Chat with Support</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Get help from our team · Usually replies in minutes
              </div>
            </div>
          </button>
        </div>

        {/* Emergency & Contact Info */}
        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Emergency & Contact
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-4 border-b border-border px-4 py-4">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-warning/10">
                <AlertTriangle size={17} className="text-warning" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Emergency Helpline</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Available 24/7 for urgent issues</div>
              </div>
            </div>
            <div className="flex items-center gap-4 border-b border-border px-4 py-4">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-success/10">
                <Phone size={17} className="text-success" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">+92-311-AJKMART</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Mon–Sat, 9am–9pm PKT</div>
              </div>
            </div>
            <div className="flex items-center gap-4 px-4 py-4">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand/10">
                <Mail size={17} className="text-brand" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">riders@ajkmart.app</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Email support · replies within 24h</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
