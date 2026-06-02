import { AlertCircle, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { tDual, type TranslationKey } from "@workspace/i18n";
import { useLanguage } from "../lib/useLanguage";

export default function NotFound() {
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden page-header-gradient bg-card p-4">
      <div className="absolute top-[-20%] right-[-10%] h-72 w-72 rounded-full bg-white/[0.02]" />
      <div className="absolute bottom-[-15%] left-[-10%] h-64 w-64 rounded-full bg-success/[0.04]" />

      <div className="relative z-10 w-full max-w-sm rounded-3xl bg-card p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-error/15">
          <AlertCircle size={40} className="text-error" />
        </div>
        <h1 className="mb-2 text-3xl font-extrabold text-white">404</h1>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          {T("notFoundPageDesc")}
        </p>
        <Link
          href="/"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-card text-sm font-bold text-white transition-colors hover:bg-card"
        >
          <ArrowLeft size={15} /> {T("goHome")}
        </Link>
      </div>
    </div>
  );
}
