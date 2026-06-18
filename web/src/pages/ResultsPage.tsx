/**
 * ResultsPage — the ranked list of matched cities for a profile.
 *
 * The matched results are read from React Router's `location.state` (set
 * by ProfileForm on submit). If the user lands here directly — e.g. by
 * refreshing — there's no state, and we show an empty-state message with
 * a CTA back to the form. This is intentional per AC-10: we don't store
 * PII in URLs.
 *
 * Each row is wired to the shortlist context: ticking "Add to compare"
 * toggles membership in the session-scoped shortlist. When the user
 * attempts to add a 4th city the toggle is blocked and a toast is shown
 * (Acceptance-Criteria Feature 4). When the user navigates here from
 * /compare with an insufficient shortlist, a notice is rendered above
 * the header.
 *
 * "Start Over" clears the shortlist and routes to "/" (Acceptance-
 * Criteria Feature 3 + E2E-3).
 *
 * v0.4.0: copy is routed through i18next (PRD v3.2.0 S11).
 */
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RankCard } from '../components/RankCard';
import { ShortlistBar } from '../components/ShortlistBar';
import { useToast } from '../components/Toast';
import { useShortlist, SHORTLIST_MAX } from '../state/shortlist';
import { readCachedResults } from '../state/matchResults';
import type { MatchResponseFull } from '../api';
import './ResultsPage.css';

interface ResultsLocationState extends MatchResponseFull {
  compareNotice?: string;
}

export function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useTranslation();
  const locationState = (location.state ?? null) as ResultsLocationState | null;
  // Rehydrate from sessionStorage if the location.state is missing
  // (e.g. the user landed here from a <Navigate replace /> or hit the
  // URL directly). The cached result is the most recent quiz
  // outcome, kept in sync by ProfileForm.
  const [cached, setCached] = useState<MatchResponseFull | null>(() =>
    locationState ? null : readCachedResults(),
  );
  // After a redirect from /compare, the location state is empty. We
  // re-read the cache in a layout effect so the results-page renders
  // synchronously on the next paint.
  useEffect(() => {
    if (!locationState && !cached) {
      const fromCache = readCachedResults();
      if (fromCache) setCached(fromCache);
    }
  });
  const state: ResultsLocationState | null = locationState ?? (cached ? { ...cached } : null);
  const results = state?.results ?? [];
  const generatedAt = state?.generated_at;
  const { items, has, toggle, count, startOver } = useShortlist();
  const full = count >= SHORTLIST_MAX;

  // Surface the "navigate to /compare with <2 cities" notice once.
  useEffect(() => {
    if (state?.compareNotice) {
      toast.push(state.compareNotice, { durationMs: 6000 });
      // Strip the notice from location.state so a refresh doesn't re-fire.
      navigate(location.pathname, {
        replace: true,
        state: { ...state, compareNotice: undefined },
      });
    }
  }, [state, toast, navigate, location.pathname]);

  if (results.length === 0) {
    return (
      <div className="results-page results-page--empty" data-testid="results-empty">
        <h1>{t('results.emptyTitle')}</h1>
        <p>{t('results.emptyBody')}</p>
        <Link to="/" className="btn btn--primary">
          {t('results.emptyCta')}
        </Link>
      </div>
    );
  }

  const handleStartOver = () => {
    startOver();
    navigate('/');
  };

  const handleToggle = (city: MatchResponseFull['results'][number]) => {
    const willBeIn = !has(city.city.slug);
    if (willBeIn && count >= SHORTLIST_MAX) {
      toast.push(t('results.shortlistFull'));
      return;
    }
    toggle(city);
  };

  const generatedAtText = generatedAt
    ? new Date(generatedAt).toLocaleString()
    : '';

  return (
    <div className="results-page" data-testid="results-page">
      <header className="results-page__header">
        <h1>{t('results.title')}</h1>
        <p className="results-page__sub" data-testid="results-sub">
          {t('results.sub', {
            count: results.length,
            city: t(`results.subCity_${results.length === 1 ? 'one' : 'other'}`),
          })}
          {generatedAtText ? (
            <>
              {' '}
              <time dateTime={generatedAt}>
                {t('results.subComputed', { when: generatedAtText })}
              </time>
            </>
          ) : null}
        </p>
        <div className="results-page__actions">
          <Link to="/" className="btn btn--secondary">
            {t('results.editPreferences')}
          </Link>
          <button
            type="button"
            className="btn btn--secondary results-page__start-over"
            onClick={handleStartOver}
            data-testid="results-start-over"
          >
            {t('results.startOver')}
          </button>
          {count >= 2 ? (
            <Link
              to="/compare"
              className="btn btn--primary"
              data-testid="results-compare-cta"
            >
              {t(`results.compare${count === 1 ? 'One' : 'Many'}`, { count })}
            </Link>
          ) : (
            <span
              className="results-page__hint"
              data-testid="results-compare-hint"
            >
              {t('results.hint', {
                count: 2 - count,
                city: t(`results.hintCity_${2 - count === 1 ? 'one' : 'other'}`),
                max: SHORTLIST_MAX,
              })}
            </span>
          )}
        </div>
      </header>
      <ol className="results-page__list" data-testid="results-list">
        {results.map((r, idx) => (
          <li key={r.city.slug}>
            <RankCard
              rank={idx + 1}
              result={r}
              inShortlist={has(r.city.slug)}
              onToggleShortlist={() => handleToggle(r)}
              shortlistFull={full && !has(r.city.slug)}
            />
          </li>
        ))}
      </ol>
      {items.length > 0 ? (
        <p className="results-page__shortlist-summary" data-testid="results-shortlist-summary">
          {t(`results.summary_${items.length === 1 ? 'one' : 'other'}`, { count: items.length })}
        </p>
      ) : null}
      <ShortlistBar />
    </div>
  );
}