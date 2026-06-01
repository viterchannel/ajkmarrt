import { useState } from "react";
import { useLocation } from "wouter";
import { ChevronDown, ChevronUp, MessageCircle, Phone, Mail, AlertTriangle } from "lucide-react";
import { tDual, type TranslationKey } from "@workspace/i18n";
import { useLanguage } from "../lib/useLanguage";

const FAQS = [
  {
    q: "How do I go online to receive orders?",
    a: "From the Home screen, tap the toggle card at the top to switch your status from Offline to Online. You will start receiving ride and delivery requests immediately.",
  },
  {
    q: "Why was my account suspended or flagged?",
    a: "Accounts can be flagged for high cancellation rates, low ratings, or policy violations. Open the Profile tab to see your standing. Contact support via the chat button below for a review.",
  },
  {
    q: "How and when do I get paid?",
    a: "Earnings are credited to your in-app Wallet after each completed order. You can withdraw to your registered bank account from the Wallet screen. Processing takes 1–3 business days.",
  },
  {
    q: "What should I do if the customer is unreachable?",
    a: "Wait the required grace period shown on the Active screen, then use the 'Customer Unreachable' option to cancel without penalty. Document the situation with a note.",
  },
  {
    q: "How do I update my documents (CNIC, license)?",
    a: "Go to Profile → scroll to the Documents section → tap the upload button next to each document. Approved documents are reviewed by admin within 24 hours.",
  },
  {
    q: "Can I change my registered phone number?",
    a: "Yes. Go to Profile → tap Edit on your personal information → tap 'Send OTP' next to the phone field. Enter the OTP received on the new number to confirm.",
  },
  {
    q: "What happens if my app crashes during an active ride?",
    a: "Your active order is preserved on the server. Reopen the app and you will be taken directly back to the active ride screen. If you experience persistent crashes, contact support.",
  },
  {
    q: "How do I dispute a penalty on my account?",
    a: "Go to Profile → Penalty History to see all penalties with reasons. Use the Chat with Support button below to raise a dispute. Include your order ID and any relevant details.",
  },
] as const;

function AccordionItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="border border-border-dark rounded-xl overflow-hidden mb-3">
      <button
        className="w-full flex items-center justify-between px-4 py-4 text-left bg-card-dark hover:bg-border-dark transition-colors"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-foreground pr-3">{q}</span>
        {open ? (
          <ChevronUp size={18} className="flex-shrink-0 text-brand" />
        ) : (
          <ChevronDown size={18} className="flex-shrink-0 text-[#B0B0B0]" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 bg-card-dark border-t border-border-dark">
          <p className="text-sm text-[#B0B0B0] leading-relaxed">{a}</p>
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
    <div className="min-h-screen bg-page-bg pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-surface border-b border-border-dark px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3">
        <button
          onClick={() => navigate("/profile")}
          aria-label="Back to profile"
          className="flex items-center gap-2 text-[#B0B0B0] hover:text-foreground transition-colors mb-1"
        >
          <ChevronDown size={18} className="rotate-90" />
          <span className="text-sm">Back</span>
        </button>
        <h1 className="text-xl font-bold text-foreground">Help & FAQ</h1>
        <p className="text-xs text-[#B0B0B0] mt-0.5">Common questions and support</p>
      </div>

      <div className="px-4 pt-5">
        {/* FAQ Section */}
        <div className="mb-6">
          <h2 className="text-xs font-bold text-[#B0B0B0] uppercase tracking-wider mb-3">
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
          <h2 className="text-xs font-bold text-[#B0B0B0] uppercase tracking-wider mb-3">
            Support
          </h2>
          <button
            onClick={() => navigate("/chat")}
            className="w-full flex items-center gap-4 bg-brand/10 border border-brand/30 rounded-xl px-4 py-4 hover:bg-brand/15 transition-colors"
            aria-label="Open support chat"
          >
            <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0">
              <MessageCircle size={20} className="text-brand" />
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-foreground">Chat with Support</div>
              <div className="text-xs text-[#B0B0B0] mt-0.5">
                Get help from our team · Usually replies in minutes
              </div>
            </div>
          </button>
        </div>

        {/* Emergency & Contact Info */}
        <div>
          <h2 className="text-xs font-bold text-[#B0B0B0] uppercase tracking-wider mb-3">
            Emergency & Contact
          </h2>
          <div className="bg-card-dark border border-border-dark rounded-xl overflow-hidden">
            <div className="flex items-center gap-4 px-4 py-4 border-b border-border-dark">
              <div className="w-9 h-9 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={17} className="text-warning" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Emergency Helpline</div>
                <div className="text-xs text-[#B0B0B0] mt-0.5">Available 24/7 for urgent issues</div>
              </div>
            </div>
            <div className="flex items-center gap-4 px-4 py-4 border-b border-border-dark">
              <div className="w-9 h-9 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                <Phone size={17} className="text-success" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">+92-311-AJKMART</div>
                <div className="text-xs text-[#B0B0B0] mt-0.5">Mon–Sat, 9am–9pm PKT</div>
              </div>
            </div>
            <div className="flex items-center gap-4 px-4 py-4">
              <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                <Mail size={17} className="text-brand" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">riders@ajkmart.app</div>
                <div className="text-xs text-[#B0B0B0] mt-0.5">Email support · replies within 24h</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
