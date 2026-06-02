import { tDual, type TranslationKey } from "@workspace/i18n";
import { useState } from "react";
import { useLanguage } from "../lib/useLanguage";

interface Props {
  message: string;
}

export function AnnouncementBar({ message }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);

  if (!message || dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 bg-card px-4 py-2.5 text-card-foreground shadow-sm">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="flex-shrink-0 text-base">📢</span>
        <p className="truncate text-sm font-medium">{message}</p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 text-lg leading-none font-bold text-muted-foreground transition-colors hover:text-foreground"
        aria-label={T("dismissAnnouncement")}
      >
        ×
      </button>
    </div>
  );
}
