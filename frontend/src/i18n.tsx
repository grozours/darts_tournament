/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { enMessages } from './locales/en';
import { frMessages } from './locales/fr';

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

const baseMessages: Record<Language, Record<string, string>> = {
  en: enMessages,
  fr: frMessages,
  es: enMessages,
  de: enMessages,
  it: enMessages,
  pt: enMessages,
  nl: enMessages,
};

const loadLanguageMessages = async (lang: Language): Promise<Record<string, string>> => {
  switch (lang) {
    case 'es': {
      const { esMessages } = await import('./locales/es');
      return { ...enMessages, ...esMessages };
    }
    case 'de': {
      const { deMessages } = await import('./locales/de');
      return { ...enMessages, ...deMessages };
    }
    case 'it': {
      const { itMessages } = await import('./locales/it');
      return { ...enMessages, ...itMessages };
    }
    case 'pt': {
      const { ptMessages } = await import('./locales/pt');
      return { ...enMessages, ...ptMessages };
    }
    case 'nl': {
      const { nlMessages } = await import('./locales/nl');
      return { ...enMessages, ...nlMessages };
    }
    case 'fr': {
      return frMessages;
    }
    case 'en':
    default: {
      return enMessages;
    }
  }
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
  t: (key) => baseMessages[getStoredLang()]?.[key] || enMessages[key] || key,
});

type I18nProviderProperties = Readonly<{ children: ReactNode }>;

export function I18nProvider({ children }: I18nProviderProperties) {
  const [lang, setLang] = useState<Language>(() => getStoredLang());
  const [messagesByLang, setMessagesByLang] = useState<Record<Language, Record<string, string>>>(baseMessages);

  useEffect(() => {
    if (lang === 'en' || lang === 'fr') {
      return;
    }
    if (messagesByLang[lang] !== enMessages) {
      return;
    }

    let disposed = false;
    const loadMessages = async () => {
      try {
        const loaded = await loadLanguageMessages(lang);
        if (disposed) {
          return;
        }
        setMessagesByLang((current) => ({
          ...current,
          [lang]: loaded,
        }));
      } catch {
        // Keep English fallback if a locale chunk fails to load.
      }
    };

    void loadMessages();
    return () => {
      disposed = true;
    };
  }, [lang, messagesByLang]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLang(nextLanguage);
    if (globalThis.window) {
      globalThis.window.localStorage.setItem('lang', nextLanguage);
    }
  }, []);

  const toggleLang = useCallback(() => {
    const currentIndex = languageOrder.indexOf(lang);
    const next = languageOrder[(currentIndex + 1) % languageOrder.length] ?? 'fr';
    setLanguage(next);
  }, [lang, setLanguage]);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLanguage,
      toggleLang,
      t: (key: string) => messagesByLang[lang]?.[key] || enMessages[key] || key,
    }),
    [lang, messagesByLang, setLanguage, toggleLang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
