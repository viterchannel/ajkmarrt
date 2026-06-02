import { tDual, type Language, type TranslationKey } from "@workspace/i18n";
import { Bell, ChevronRight, CaseSensitive, Languages, Moon, Shield, Sun, Trash2 } from "lucide-react";
import { useLanguage } from "../../lib/useLanguage";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "../../hooks/use-toast";
import { useFontSize, type FontSizeLevel } from "../../lib/FontSizeContext";
import { useTheme } from "../../lib/useTheme";
import { useAuth } from "../../lib/rider-auth";
import { ThemeAdminPanel } from "../admin/ThemeAdminPanel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

interface ProfileSettingsProps {
  language: Language;
  setLanguage: (lang: "en" | "ur" | "roman") => void;
  unread: number;
  onDeleteAccount: () => Promise<void>;
}

const LANG_OPTIONS: { value: Language; display: string }[] = [
  { value: "en",    display: "EN" },
  { value: "ur",    display: "اردو" },
  { value: "roman", display: "ROM" },
];

export function ProfileSettings({
  language,
  setLanguage,
  unread,
  onDeleteAccount,
}: ProfileSettingsProps) {
  const T = (key: TranslationKey) => tDual(key, language);
  const { loading: langLoading } = useLanguage();
  const { fontSizeLevel, setFontSizeLevel } = useFontSize();
  const { isDark, toggleDark } = useTheme();
  const { user } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  /* Check if user is admin (has admin role or specific flag) */
  const isAdmin = user?.role === "admin" || user?.role === "super_admin" || (user as any)?.isAdmin === true;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setDeleteInput("");
      setDeleting(false);
    }
    setDeleteOpen(open);
  };

  const handleConfirmDelete = async () => {
    if (deleteInput !== "DELETE") return;
    setDeleting(true);
    try {
      await onDeleteAccount();
    } catch (e) {
      setDeleting(false);
      setDeleteOpen(false);
      setDeleteInput("");
      toast({
        title: e instanceof Error ? e.message : T("deleteAccountFailed"),
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="animate-[slideUp_0.7s_ease-out] overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="px-5 py-3.5">
          <p className="flex items-center gap-2 text-[15px] font-bold text-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {T("settingsLabel")}
          </p>
        </div>
        <div className="border-t border-border">
          <div className="flex items-center justify-between border-b border-border/30 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10">
                <Languages size={17} className="text-indigo-500" />
              </div>
              <span className="text-sm font-semibold text-foreground">{T("languageLabel")}</span>
            </div>
            <div className="flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5">
              {LANG_OPTIONS.map((opt) => {
                const active = language === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => { if (!langLoading && !active) setLanguage(opt.value); }}
                    disabled={langLoading || active}
                    aria-label={`Switch language to ${opt.display}`}
                    aria-pressed={active}
                    className={`rounded-full px-3 py-1 text-[10px] font-bold leading-none transition-all duration-150 ${
                      active
                        ? "bg-brand text-surface"
                        : "text-muted-foreground hover:text-foreground active:scale-95"
                    }`}
                  >
                    {opt.display}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-border/30 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10">
                <CaseSensitive size={17} className="text-violet-500" />
              </div>
              <span className="text-sm font-semibold text-foreground">{T("textSizeLabel")}</span>
            </div>
            <div className="flex flex-wrap gap-0.5 rounded-xl bg-muted p-0.5">
              {(["small", "medium", "large"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setFontSizeLevel(level as FontSizeLevel)}
                  className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-all ${fontSizeLevel === level ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                  {level === "small" ? T("textSizeSmall") : level === "medium" ? T("textSizeMedium") : T("textSizeLarge")}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-border/30 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isDark ? "bg-brand/10" : "bg-warning/10"}`}>
                {isDark ? <Moon size={17} className="text-brand" /> : <Sun size={17} className="text-warning" />}
              </div>
              <span className="text-sm font-semibold text-foreground">{T("darkMode")}</span>
            </div>
            <button
              role="switch"
              aria-checked={isDark}
              aria-label={T("darkMode")}
              onClick={toggleDark}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${isDark ? "bg-brand" : "bg-muted"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isDark ? "translate-x-5" : "translate-x-0"}`}
              />
            </button>
          </div>

          <Link
            href="/settings/security"
            className="flex items-center justify-between border-b border-border/30 px-5 py-3.5 transition-colors active:bg-muted"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-error/10">
                <Shield size={17} className="text-error" />
              </div>
              <div>
                <span className="block text-sm font-semibold text-foreground">
                  {T("securitySettingsLink")}
                </span>
                <span className="text-[10px] text-muted-foreground">{T("manageSecuritySettings")}</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </Link>

          <Link
            href="/notifications"
            className="flex items-center justify-between border-b border-border/30 px-5 py-3.5 transition-colors active:bg-muted"
          >
            <div className="flex items-center gap-3">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10">
                <Bell size={17} className="text-blue-500" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[8px] font-extrabold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </div>
              <div>
                <span className="block text-sm font-semibold text-foreground">
                  {T("notificationsLink")}
                </span>
                <span className="text-[10px] text-muted-foreground">{T("viewNotifications")}</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </Link>

          {/* Admin Theme Control Panel — only visible to admin users */}
          {isAdmin && (
            <div className="border-b border-border/30 px-5 py-3.5">
              <ThemeAdminPanel />
            </div>
          )}

          <button
              </div>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </Link>

          <button
            onClick={() => setDeleteOpen(true)}
            className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors active:bg-error/10"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-error/10">
              <Trash2 size={17} className="text-error" />
            </div>
            <div>
              <span className="block text-sm font-semibold text-error">{T("deleteAccount")}</span>
              <span className="text-[10px] text-muted-foreground">{T("deleteAccountDataNote")}</span>
            </div>
          </button>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={handleOpenChange}>
        <AlertDialogContent className="max-w-sm rounded-2xl bg-card p-6">
          <AlertDialogHeader>
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-error/15">
                <Trash2 size={20} className="text-error" />
              </div>
              <AlertDialogTitle className="text-base font-bold text-foreground">
                {T("deleteAccount")}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
              {T("deleteAccountConfirmText")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-4 mb-2">
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={T("deleteAccountConfirmInput")}
              aria-label={T("deleteAccountConfirmInput")}
              className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm focus:border-error focus:outline-none focus:ring-2 focus:ring-error/20"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <AlertDialogFooter className="mt-2 flex gap-3 sm:flex-row">
            <AlertDialogCancel
              disabled={deleting}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground"
            >
              {T("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={deleteInput !== "DELETE" || deleting}
              className="flex-1 rounded-xl bg-error py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:bg-error/90"
            >
              {deleting ? T("deletingLabel") : T("deleteAccount")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
