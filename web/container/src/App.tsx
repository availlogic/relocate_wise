/**
 * App — the top-level React component for the RelocateWise SPA.
 *
 * This is the **container** in the micro-frontend architecture
 * (Architecture v1.4.0 §4.1, FR-19, AC-19). It owns:
 *
 *   - The host shell: global header (brand + nav), language toggle,
 *     consent banner, footer, and the `ToastProvider` /
 *     `ShortlistProvider` contexts.
 *   - React Router with the six public routes.
 *   - i18next bootstrap (called once at app construction).
 *
 * The actual feature pages are **decoupled MFEs** loaded via
 * `React.lazy` + dynamic `import()`. Each MFE is its own npm
 * workspace (`web/{quiz-mfe,compare-mfe,dashboard-mfe}`) and is
 * bundled into a separate chunk by the container's Vite config
 * (manualChunks). E2E-7 verifies that each route's MFE chunk is
 * fetched on demand.
 *
 * Routing model:
 *   /            → LandingPage (entry point, CTA to /q)
 *   /q           → Quiz MFE (ProfileForm)  [chunk: quiz-mfe]
 *   /results     → Dashboard MFE (ResultsPage)  [chunk: dashboard-mfe]
 *   /city/:slug  → Dashboard MFE (CityPage)  [chunk: dashboard-mfe]
 *   /compare     → Compare MFE (ComparePage)  [chunk: compare-mfe]
 *   /privacy     → PrivacyPage (container-rendered)
 *   *            → NotFoundPage (container-rendered)
 *
 * Cross-MFE communication (Architecture §4.1):
 *   - Quiz MFE dispatches a `rw:quiz_completed` Custom Event on
 *     `window` when the user submits the questionnaire (FTC-17, AC
 *     Feature 2). The Dashboard MFE listens for the event and
 *     navigates to /results with the matched payload.
 *   - Shortlist / toast state is shared through the container's
 *     React contexts (`ShortlistProvider`, `ToastProvider`).
 */
import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ConsentBanner } from './components/ConsentBanner';
import { ToastProvider } from './components/Toast';
import { NotFoundPage } from './pages/NotFoundPage';
import { LandingPage } from './pages/LandingPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { LanguageToggle } from './components/LanguageToggle';
import { ShortlistProvider, useShortlist } from './state/shortlist';
import './App.css';

// Dynamic MFE imports — each MFE is bundled into its own chunk via
// the container's Vite `manualChunks` configuration. E2E-7 asserts
// the chunk filename is fetched on navigation.
const QuizMfe = lazy(() =>
  import('@relocatewise/web-quiz-mfe').then((m) => ({ default: m.ProfileForm })),
);
const DashboardResultsMfe = lazy(() =>
  import('@relocatewise/web-dashboard-mfe').then((m) => ({
    default: m.ResultsPage,
  })),
);
const DashboardCityMfe = lazy(() =>
  import('@relocatewise/web-dashboard-mfe').then((m) => ({
    default: m.CityPage,
  })),
);
const CompareMfe = lazy(() =>
  import('@relocatewise/web-compare-mfe').then((m) => ({
    default: m.ComparePage,
  })),
);

export function App() {
  // Boot the quiz→results listener once. The Dashboard MFE's
  // ResultsPage also listens, but this allows the container to
  // route /results even before the dashboard chunk has loaded
  // (e.g. when the user navigates via the browser back button).
  useEffect(() => {
    function onQuizCompleted(event: Event) {
      const detail = (event as CustomEvent<unknown>).detail;
      // We just stash it on sessionStorage for /results to pick up.
      // The Dashboard MFE's matchResults helper handles the read.
      if (detail && typeof detail === 'object') {
        try {
          sessionStorage.setItem(
            'rw:quiz_completed',
            JSON.stringify({ at: Date.now(), detail }),
          );
        } catch {
          /* sessionStorage may be unavailable */
        }
      }
    }
    window.addEventListener('rw:quiz_completed', onQuizCompleted);
    return () => window.removeEventListener('rw:quiz_completed', onQuizCompleted);
  }, []);

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
              <Suspense fallback={<div data-testid="mfe-loading" />}>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/q" element={<QuizMfe />} />
                  <Route path="/results" element={<DashboardResultsMfe />} />
                  <Route path="/compare" element={<CompareMfe />} />
                  <Route path="/city/:slug" element={<DashboardCityMfe />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
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