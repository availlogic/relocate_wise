/**
 * i18next bootstrap for the RelocateWise SPA (PRD v3.2.0 §6.1 S11 /
 * Architecture v1.3.0 §8.2 / Screen-Specs §0).
 *
 * - Bundles English (default) and Simplified Chinese JSON files into
 *   the SPA so language switches happen with zero network latency.
 * - Persists the user's choice in `localStorage[rw:lang]` so the
 *   preference survives reloads (Functional-Test-Cases FTC-14).
 * - Falls back to `en` when the persisted value is missing or invalid.
 *
 * Translation coverage (matches the keys used in en.json / zh.json):
 *   app.*       — header, footer, consent, language toggle.
 *   landing.*   — value-prop hero + grid.
 *   privacy.*   — privacy policy page.
 *   wizard.*    — 8-step questionnaire (titles, labels, options).
 *   results.*   — ranked results page + rank card.
 *   shortlist.* — floating shortlist bar.
 *   city.*      — city profile page + dimension labels.
 *   compare.*   — side-by-side comparison page.
 *   why.*       — "why this fits you" templates (locale-aware, see
 *                  api/src/matching/why.ts for the server-side keys).
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import zh from './zh.json';

export const SUPPORTED_LANGUAGES = ['en', 'zh'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = 'rw:lang';

function readPersistedLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'zh') return stored;
  // Optional: detect browser language on first visit.
  const navLang = window.navigator?.language?.toLowerCase() ?? '';
  if (navLang.startsWith('zh')) return 'zh';
  return 'en';
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: readPersistedLanguage(),
  fallbackLng: 'en',
  supportedLngs: [...SUPPORTED_LANGUAGES],
  interpolation: {
    // React already escapes interpolation; prevent i18next from
    // double-escaping (it defaults to true).
    escapeValue: false,
  },
  returnNull: false,
  // React-specific: react-i18next needs Suspense off in jsdom tests.
  react: {
    useSuspense: false,
  },
});

/**
 * Switch the active language at runtime. Persists the choice in
 * localStorage so it survives a refresh. Returns the promise from
 * `i18n.changeLanguage` so callers (e.g. tests, the LanguageToggle)
 * can await the language switch before asserting on rendered copy.
 */
export async function setLanguage(lang: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(lang);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage may be unavailable */
    }
  }
}

export function getCurrentLanguage(): SupportedLanguage {
  const current = i18n.language?.toLowerCase() ?? 'en';
  return current.startsWith('zh') ? 'zh' : 'en';
}

export default i18n;