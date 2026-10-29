import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import enTranslations from "../i18n/en.json";
import siTranslations from "../i18n/si.json";

const LANG_STORAGE_KEY = "agrolens_lang";

const dictionaries = {
  en: enTranslations,
  si: siTranslations,
};

const LanguageContext = createContext(null);

function getInitialLanguage() {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === "en" || saved === "si") {
      return saved;
    }
  } catch {
    // Ignore storage read errors
  }
  return "en";
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(getInitialLanguage);

  const setLanguage = useCallback((nextLang) => {
    const validLang = nextLang === "si" ? "si" : "en";
    setLangState(validLang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, validLang);
    } catch {
      // Ignore storage write errors
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(lang === "en" ? "si" : "en");
  }, [lang, setLanguage]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (keyPath, fallback = "") => {
      const keys = keyPath.split(".");
      let current = dictionaries[lang] || dictionaries.en;
      for (const k of keys) {
        if (current && typeof current === "object" && k in current) {
          current = current[k];
        } else {
          // Fallback to English dictionary
          let enCurrent = dictionaries.en;
          for (const ek of keys) {
            if (enCurrent && typeof enCurrent === "object" && ek in enCurrent) {
              enCurrent = enCurrent[ek];
            } else {
              return fallback || keyPath;
            }
          }
          return typeof enCurrent === "string" ? enCurrent : fallback || keyPath;
        }
      }
      return typeof current === "string" ? current : fallback || keyPath;
    },
    [lang]
  );

  const value = useMemo(
    () => ({
      lang,
      setLanguage,
      toggleLanguage,
      t,
    }),
    [lang, setLanguage, toggleLanguage, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
