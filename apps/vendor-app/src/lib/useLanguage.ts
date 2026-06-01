import type { Language } from "@workspace/i18n";
import { DEFAULT_LANGUAGE, LANGUAGE_OPTIONS, isRTL, preloadLocale } from "@workspace/i18n";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

interface SettingsResponse {
  language?: string;
  [key: string]: unknown;
}

const VALID_LANGS = new Set<string>(LANGUAGE_OPTIONS.map((o) => o.value));
const LS_KEY = "ajkmart_vendor_lang";

const NOTO_LINK_ID = "noto-nastaliq-font";
const NOTO_HREF =
  "https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap";

function applyRTL(lang: Language) {
  const dir = isRTL(lang) ? "rtl" : "ltr";
  document.documentElement.setAttribute("dir", dir);
  document.documentElement.setAttribute("lang", lang === "ur" ? "ur" : "en");
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

function readLocalLang(): Language {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored && VALID_LANGS.has(stored)) return stored as Language;
  } catch (err) {
    console.warn("[artifacts/vendor-app/src/lib/useLanguage.ts]", err);
  } // eslint-disable-line no-console
  return DEFAULT_LANGUAGE;
}

export function useLanguage() {
  const [language, setLang] = useState<Language>(() => {
    const lang = readLocalLang();
    applyRTL(lang);
    preloadLocale(lang).catch(() => {});
    return lang;
  });
  const [loading, setLoading] = useState(false);
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    /* Only fetch from server when a token exists — avoids a 401 on the login
       page which would trigger an unintended logout cycle in apiFetch. */
    if (!api.getToken()) {
      setInitialised(true);
      return;
    }
    api
      .getSettings()
      .then((s: SettingsResponse) => {
        if (s?.language && VALID_LANGS.has(s.language)) {
          const lang = s.language as Language;
          try {
            localStorage.setItem(LS_KEY, lang);
          } catch (err) {
            console.warn("[artifacts/vendor-app/src/lib/useLanguage.ts]", err);
          } // eslint-disable-line no-console
          preloadLocale(lang).catch(() => {});
          setLang(lang);
          applyRTL(lang);
        }
      })
      .catch((err) => {
        console.warn("[artifacts/vendor-app/src/lib/useLanguage.ts]", err);
      }) // eslint-disable-line no-console
      .finally(() => setInitialised(true));
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    setLoading(true);
    await preloadLocale(lang).catch(() => {});
    setLang(lang);
    applyRTL(lang);
    try {
      localStorage.setItem(LS_KEY, lang);
    } catch (err) {
      console.warn("[artifacts/vendor-app/src/lib/useLanguage.ts]", err);
    } // eslint-disable-line no-console
    try {
      await api.updateSettings({ language: lang });
    } catch (err) {
      console.warn("[artifacts/vendor-app/src/lib/useLanguage.ts]", err);
    } // eslint-disable-line no-console
    setLoading(false);
  }, []);

  return { language, setLanguage, loading, initialised };
}
