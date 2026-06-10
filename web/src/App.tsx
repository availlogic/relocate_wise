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
 * `HeaderShortlistBadge` is rendered on every page and reacts to the
 * live count. `ConsentBanner` sits at the top of the shell and is
 * visible until the user makes a first-visit choice (PRD FR-13, AC-11).
 */
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { ProfileForm } from './components/ProfileForm';
import { ConsentBanner } from './components/ConsentBanner';
import { ToastProvider } from './components/Toast';
import { ResultsPage } from './pages/ResultsPage';
import { CityPage } from './pages/CityPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LandingPage } from './pages/LandingPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { ComparePage } from './pages/ComparePage';
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
              <Link className="app-header__brand" to="/">RelocateWise</Link>
              <nav className="app-header__nav" aria-label="Primary">
                <Link to="/q">Questionnaire</Link>
                <HeaderShortlistBadge />
                <Link to="/privacy">Privacy</Link>
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
            <footer className="app-footer">
              <p>
                RelocateWise is decision support, not legal or immigration
                advice. Verify any visa or residency information with the
                destination country’s official sources.
              </p>
              <p>
                <Link to="/privacy">How your data is handled</Link>
                {' · '}
                <a
                  href="https://github.com/"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Source on GitHub
                </a>
              </p>
            </footer>
          </div>
        </ShortlistProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

/** Tiny header widget — links to /compare and shows the live count. */
function HeaderShortlistBadge() {
  const { count } = useShortlist();
  return (
    <Link
      to="/compare"
      className="app-header__shortlist"
      data-testid="header-shortlist"
      aria-label={`Shortlist with ${count} of 3 cities`}
    >
      Compare
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
