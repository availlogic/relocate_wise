/**
 * LanguageToggle — manual EN / 中文 selector in the global header.
 *
 * Lives in the header of every page (Screen-Specs §0, Acceptance-
 * Criteria Feature 6). The choice persists in localStorage via
 * `web/src/i18n/index.ts`. Toggling does NOT cause a page reload —
 * all consumers re-render via the `useTranslation` hook. The user's
 * current questionnaire step and shortlist selection are preserved
 * (E2E-5 acceptance: "Toggling must preserve the user's current
 * session state").
 */
import { useTranslation } from 'react-i18next';
import {
  getCurrentLanguage,
  setLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '../i18n';

export function LanguageToggle() {
  const { t } = useTranslation();
  const current = getCurrentLanguage();

  const handlePick = (lang: SupportedLanguage) => {
    if (lang === current) return;
    void setLanguage(lang);
  };

  return (
    <div
      className="lang-toggle"
      role="group"
      aria-label={t('app.languageToggle.english')}
      data-testid="lang-toggle"
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          className={
            'lang-toggle__btn' + (lang === current ? ' is-active' : '')
          }
          onClick={() => handlePick(lang)}
          aria-pressed={lang === current}
          data-testid={`lang-${lang}`}
        >
          {lang === 'en'
            ? t('app.languageToggle.english')
            : t('app.languageToggle.chinese')}
        </button>
      ))}
    </div>
  );
}