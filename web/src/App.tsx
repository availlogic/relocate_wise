/**
 * App — the top-level React component. Sets up React Router with the
 * routes the MVP exposes plus a 404 fallback.
 *
 * Routing model:
 *   /            → LandingPage (entry point, CTA to /q)
 *   /q           → ProfileForm (the questionnaire)
 *   /results     → ResultsPage (ranked cities)
 *   /compare     → ComparePage (2-3 shortlisted cities)
 *   /city/:slug  → CityPage (full city profile)
 *   /privacy     → PrivacyPage (data-handling commitment)
 *   *            → NotFoundPage
 *
 * `ShortlistProvider` is mounted inside the router so any page that
 * needs the session-scoped compare shortlist can call `useShortlist()`.
 * `LanguageToggle` lives in the global header (Screen-Specs §0,
 * Acceptance-Criteria Feature 6 / E2E-5) so the user can switch
 * between English and Simplified Chinese on any page. Toggling does
 * not reset questionnaire state or the shortlist (state lives in
 * the parent providers, not in the toggle component).
 * `ConsentBanner` sits at the top of the shell and is visible until
 * the user makes a first-visit choice (PRD FR-13, AC-11).
 */
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProfileForm } from './components/ProfileForm';
import { ConsentBanner } from './components/ConsentBanner';
import { ToastProvider } from './components/Toast';
import { ResultsPage } from './pages/ResultsPage';
import { CityPage } from './pages/CityPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LandingPage } from './pages/LandingPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { ComparePage } from './pages/ComparePage';
import { LanguageToggle } from './components/LanguageToggle';
import { ShortlistProvider, useShortlist } from './state/shortlist';
import './App.css';

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ShortlistProvider>
          <div className="app-shell">
            <ConsentBanner />
            <header className="app-header">
              <Link className="app-header__brand" to="/">
                <BrandLabel />
              </Link>
              <nav className="app-header__nav" aria-label="Primary">
                <LanguageToggle />
                <Link to="/q" data-testid="nav-questionnaire">
                  <NavQuestionnaireLabel />
                </Link>
                <HeaderShortlistBadge />
                <Link to="/privacy" data-testid="nav-privacy">
                  <NavPrivacyLabel />
                </Link>
              </nav>
            </header>
            <main className="app-main">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/q" element={<ProfileForm />} />
                <Route path="/results" element={<ResultsPage />} />
                <Route path="/compare" element={<ComparePage />} />
                <Route path="/city/:slug" element={<CityPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </ShortlistProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

function BrandLabel() {
  const { t } = useTranslation();
  return <span>{t('app.brand')}</span>;
}

function NavQuestionnaireLabel() {
  const { t } = useTranslation();
  return <>{t('app.nav.questionnaire')}</>;
}

function NavPrivacyLabel() {
  const { t } = useTranslation();
  return <>{t('app.nav.privacy')}</>;
}

/** Tiny header widget — links to /compare and shows the live count. */
function HeaderShortlistBadge() {
  const { count } = useShortlist();
  const { t } = useTranslation();
  const aria = t('app.nav.compareAria', { count });
  return (
    <Link
      to="/compare"
      className="app-header__shortlist"
      data-testid="header-shortlist"
      aria-label={aria}
    >
      {t('app.nav.compare')}
      <span
        className={
          'app-header__shortlist-count' +
          (count >= 3 ? ' app-header__shortlist-count--full' : '')
        }
        data-testid="header-shortlist-count"
      >
        {count}/3
      </span>
    </Link>
  );
}

/**
 * Footer rendered at the bottom of every page. Localised through
 * i18next so the disclaimer + data-handling link update when the
 * language toggles.
 */
function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="app-footer">
      <p>{t('app.footer.disclaimer')}</p>
      <p>
        <Link to="/privacy">{t('app.footer.dataHandling')}</Link>
        {' · '}
        <a
          href="https://github.com/"
          target="_blank"
          rel="noreferrer noopener"
        >
          {t('app.footer.source')}
        </a>
      </p>
    </footer>
  );
}