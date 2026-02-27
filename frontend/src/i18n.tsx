/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { deMessages } from './locales/de';
import { enMessages } from './locales/en';
import { esMessages } from './locales/es';
import { frMessages } from './locales/fr';
import { itMessages } from './locales/it';
import { nlMessages } from './locales/nl';
import { ptMessages } from './locales/pt';

type Language = 'en' | 'fr' | 'es' | 'de' | 'it' | 'pt' | 'nl';

const resolveLang = (value?: string | null): Language => {
  if (!value) return 'fr';
  const normalized = value.toLowerCase();
  if (normalized.startsWith('fr')) return 'fr';
  if (normalized.startsWith('es')) return 'es';
  if (normalized.startsWith('de')) return 'de';
  if (normalized.startsWith('it')) return 'it';
  if (normalized.startsWith('pt')) return 'pt';
  if (normalized.startsWith('nl')) return 'nl';
  return 'en';
};

const getStoredLang = (): Language => {
  const storage = globalThis.window?.localStorage;
  if (!storage) return 'fr';
  return resolveLang(storage.getItem('lang'));
};

const messages: Record<Language, Record<string, string>> = {
  en: enMessages,
  fr: frMessages,
  es: { ...enMessages, ...esMessages },
  de: { ...enMessages, ...deMessages },
  it: { ...enMessages, ...itMessages },
  pt: { ...enMessages, ...ptMessages },
  nl: { ...enMessages, ...nlMessages },
};

const languageOrder: Language[] = ['fr', 'en', 'es', 'de', 'it', 'pt', 'nl'];

type I18nContextValue = {
  lang: Language;
  setLanguage: (lang: Language) => void;
  toggleLang: () => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue>({
  lang: getStoredLang(),
  setLanguage: () => {},
  toggleLang: () => {},
  t: (key) => messages[getStoredLang()]?.[key] || messages.en[key] || key,
});

type I18nProviderProperties = Readonly<{ children: ReactNode }>;

export function I18nProvider({ children }: I18nProviderProperties) {
  const [lang, setLang] = useState<Language>(() => getStoredLang());

  const setLanguage = (nextLanguage: Language) => {
    setLang(nextLanguage);
    if (globalThis.window) {
      globalThis.window.localStorage.setItem('lang', nextLanguage);
    }
  };

  const toggleLang = () => {
    const currentIndex = languageOrder.indexOf(lang);
    const next = languageOrder[(currentIndex + 1) % languageOrder.length] ?? 'fr';
    setLanguage(next);
  };

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLanguage,
      toggleLang,
      t: (key: string) => messages[lang]?.[key] || messages.en[key] || key,
    }),
    [lang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
