import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Direction } from '../model/types';
import { en, type Dictionary } from './en';
import { it } from './it';

export type Language = 'en' | 'it';
export type Key = keyof Dictionary;
export const LANGUAGES: Language[] = ['en', 'it'];
export const LOCALES: Record<Language, string> = { en: 'en-GB', it: 'it-IT' };

const DICTIONARIES: Record<Language, Dictionary> = { en, it };
const STORAGE_KEY = 'apollo-crossword:lang';

type Params = Record<string, string | number>;
export type CountKey = 'count.check' | 'count.reveal' | 'count.letter' | 'count.game' | 'count.hour' | 'count.minute' | 'count.second';

function fill(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'it';
}

function readStored(): Language | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

/** English unless the player picked a language in settings. */
function detect(): Language {
  return readStored() ?? 'en';
}

export interface I18n {
  lang: Language;
  locale: string;
  setLang: (lang: Language) => void;
  /** Translate a key, filling `{placeholders}`. */
  t: (key: Key, params?: Params) => string;
  /** Pluralised count: `tn('count.check', 2)` → "2 checks". */
  tn: (base: CountKey, n: number) => string;
  /** Spoken duration: "1 minute 23 seconds" / "1 minuto 23 secondi". */
  describeDuration: (ms: number) => string;
  /** "1 Across" / "1 Orizzontale". */
  wordLabel: (word: { number: number; direction: Direction }) => string;
  /** Section heading: "Across" / "Orizzontali". */
  directionHeading: (direction: Direction) => string;
  /** Name of a puzzle language, in the current language. */
  languageName: (language: Language) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(detect);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<I18n>(() => {
    const dictionary = DICTIONARIES[lang];
    const t: I18n['t'] = (key, params) => fill(dictionary[key] ?? en[key] ?? key, params);
    const tn: I18n['tn'] = (base, n) => t(`${base}_${n === 1 ? 'one' : 'other'}` as Key, { n });
    return {
      lang,
      locale: LOCALES[lang],
      setLang,
      t,
      tn,
      describeDuration: (ms) => {
        const total = Math.max(0, Math.floor(ms / 1000));
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const seconds = total % 60;
        const parts: string[] = [];
        if (hours) parts.push(tn('count.hour', hours));
        if (minutes) parts.push(tn('count.minute', minutes));
        if (seconds || parts.length === 0) parts.push(tn('count.second', seconds));
        return parts.join(' ');
      },
      wordLabel: (word) => `${word.number} ${t(word.direction === 'across' ? 'dir.across' : 'dir.down')}`,
      directionHeading: (direction) => t(direction === 'across' ? 'dir.acrossPlural' : 'dir.downPlural'),
      languageName: (language) => t(language === 'it' ? 'lang.it' : 'lang.en'),
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}

/** Map a server error code to a translated message; falls back to the server's text. */
export function describeError(i18n: Pick<I18n, 't'>, error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case 'bad-credentials':
      return i18n.t('error.badCredentials');
    case 'bad-link':
      return i18n.t('error.badLink');
    case 'sign-in-again':
      return i18n.t('error.signInAgain');
    case 'no-puzzles':
      return i18n.t('error.noPuzzles');
    case 'puzzle-missing':
      return i18n.t('error.puzzleMissing');
    case 'network':
      return i18n.t('error.network');
  }
  return error instanceof Error && error.message ? error.message : i18n.t('error.generic');
}
