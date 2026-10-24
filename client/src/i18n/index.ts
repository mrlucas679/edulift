import { en, type Key } from './en';

export type Language = 'en' | 'zu' | 'st';

// Only English is reviewed so far. zu and st fall back to English until a reviewer signs off their tables.
const tables: Partial<Record<Language, Partial<Record<Key, string>>>> = {
  en,
};

export function t(key: Key, language: Language = 'en'): string {
  return tables[language]?.[key] ?? en[key];
}
