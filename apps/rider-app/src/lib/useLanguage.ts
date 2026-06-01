import type { Language } from "@workspace/i18n";
import { LANGUAGE_OPTIONS, isRTL, preloadLocale } from "@workspace/i18n";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";

const STORAGE_KEY = "ajkmart_rider_language";
const VALID_LANGS = new Set<string>(LANGUAGE_OPTIONS.map((o) => o.value));

const NOTO_LINK_ID = "noto-nastaliq-font";
const NOTO_HREF =
  "https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap";

function applyNotoFont(lang: Language): void {
  if (lang === "ur") {
    if (!document.getElementById(NOTO_LINK_ID)) {
      const link = document.createElement("link");
      link.id = NOTO_LINK_ID;
      link.rel = "stylesheet";
      link.href = NOTO_HREF;
      document.head.appendChild(link);
    }
  } else {
    document.getElementById(NOTO_LINK_ID)?.remove();
  }
}

/**
 * Returns the stored language ONLY if it is "en".
 * Any non-English stored value is cleared from localStorage so the next cold
 * start also begins in English — Urdu/Roman sessions last only for the
 * duration of the tab they were selected in.
 */
function getStoredLanguageForStartup(): Language | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored || !VALID_LANGS.has(stored)) return null;
    if (stored === "en") return "en";
    // Non-English was persisted from a previous session — clear it so the
    // next cold start also defaults to English.
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("[useLanguage]", err); // eslint-disable-line no-console
  }
  return null;
}

/* P3: Cache the last-applied direction so we don't double-write the `dir`
   attribute on the document during the initial sync (caused a brief LTR→RTL
   flicker in the original code where applyRTL ran twice in quick succession). */
let _lastAppliedDir: string | null = null;
function applyRTL(lang: Language) {
  const dir = isRTL(lang) ? "rtl" : "ltr";
  if (_lastAppliedDir === dir + "|" + lang) return;
  _lastAppliedDir = dir + "|" + lang;
  document.documentElement.setAttribute("dir", dir);
  document.documentElement.setAttribute("lang", lang === "ur" ? "ur" : "en");
  applyNotoFont(lang);
}

interface LanguageCtx {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  loading: boolean;
  initialised: boolean;
}

const LanguageContext = createContext<LanguageCtx>({
  language: "en",
  setLanguage: async () => {},
  loading: false,
  initialised: false,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [loading, setLoading] = useState(false);
  const [initialised, setInitialised] = useState(false);

  /* Track whether the user has explicitly picked a language in this session so
     we never let a background operation silently overwrite their active choice. */
  const localPickRef = useRef<boolean>(false);

  useEffect(() => {
    // Cold-start rule: always begin in English.
    // Only restore "en" from a previous session; any stored non-English is
    // cleared by getStoredLanguageForStartup() so subsequent loads also start
    // in English.
    const stored = getStoredLanguageForStartup();
    if (stored === "en") {
      // Previous session explicitly chose English — honour it.
      setLanguageState("en");
      applyRTL("en");
      preloadLocale("en").catch(() => {});
    } else {
      // No stored preference (or a non-English one that was just cleared):
      // start in English. No server fetch needed — the rule is English first.
      setLanguageState("en");
      applyRTL("en");
      preloadLocale("en").catch(() => {});
    }

    // Sync settings to the server in the background (for other prefs), but
    // do NOT apply the server's language — the cold-start default is always en.
    if (api.getToken()) {
      api.getSettings().catch((err) => {
        console.warn("[useLanguage]", err); // eslint-disable-line no-console
      });
    }

    setInitialised(true);
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    setLoading(true);
    await preloadLocale(lang).catch(() => {});
    setLanguageState(lang);
    applyRTL(lang);
    // Mark that the user has made an explicit pick in this session.
    localPickRef.current = true;
    // Persist the selection — if English, it will be restored on the next cold
    // start; if non-English, getStoredLanguageForStartup() will clear it on the
    // next load so the app always opens in English.
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (err) {
      console.warn("[useLanguage]", err); // eslint-disable-line no-console
    }
    try {
      await api.updateSettings({ language: lang });
    } catch (err) {
      console.warn("[useLanguage]", err); // eslint-disable-line no-console
    }
    setLoading(false);
  }, []);

  return React.createElement(
    LanguageContext.Provider,
    { value: { language, setLanguage, loading, initialised } },
    children
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
