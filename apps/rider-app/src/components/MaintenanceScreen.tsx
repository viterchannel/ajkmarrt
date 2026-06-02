import { tDual, type TranslationKey } from "@workspace/i18n";
import { useLanguage } from "../lib/useLanguage";

interface Props {
  message: string;
  appName?: string;
}

export function MaintenanceScreen({ message, appName = "AJKMart" }: Props) {
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden page-header-gradient bg-card p-6">
      <div className="absolute top-[-20%] right-[-10%] h-72 w-72 rounded-full bg-muted/20" />
      <div className="absolute bottom-[-15%] left-[-10%] h-64 w-64 rounded-full bg-success/[0.04]" />
      <div className="relative z-10 w-full max-w-sm rounded-3xl bg-card p-8 text-center shadow-2xl">
        <div className="mb-4 text-6xl">🔧</div>
        <h1 className="mb-2 text-2xl font-extrabold text-white">
          {appName} {T("maintenanceTitle")}
        </h1>
        <div className="mx-auto mb-4 h-1 w-16 rounded-full bg-card" />
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          {message || T("maintenanceDefaultMsg")}
        </p>
        <div className="rounded-2xl border border-border bg-card p-3 text-xs font-medium text-muted-foreground">
          ⏱ {T("maintenanceBack")}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          {T("riderPortal")} · {appName}
        </p>
      </div>
    </div>
  );
}
