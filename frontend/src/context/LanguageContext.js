import { createContext, useState, useContext, useCallback } from 'react';
import translations from '../utils/translations';

export const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('mangaguard_lang') || 'en');

  const switchLang = useCallback((newLang) => {
    const l = newLang === 'am' ? 'am' : 'en';
    setLang(l);
    localStorage.setItem('mangaguard_lang', l);
  }, []);

  const t = useCallback((section, key) => {
    const entry = translations[section]?.[key];
    if (!entry) return key;
    return entry[lang] || entry['en'] || key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, switchLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
