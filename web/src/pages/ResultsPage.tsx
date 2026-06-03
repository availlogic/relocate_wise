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
 * toggles membership in the session-scoped shortlist, and a CTA to
 * /compare appears whenever 2+ cities are shortlisted.
 */
import { Link, useLocation } from 'react-router-dom';
import { RankCard } from '../components/RankCard';
import { useShortlist, SHORTLIST_MAX } from '../state/shortlist';
import type { MatchResponseFull } from '../api';
import './ResultsPage.css';

export function ResultsPage() {
  const location = useLocation();
  const state = location.state as MatchResponseFull | null;
  const results = state?.results ?? [];
  const generatedAt = state?.generated_at;
  const { items, has, toggle, count } = useShortlist();
  const full = count >= SHORTLIST_MAX;

  if (results.length === 0) {
    return (
      <div className="results-page results-page--empty" data-testid="results-empty">
        <h1>No results yet</h1>
        <p>
          Submit the questionnaire to see your top matches. We don’t keep
          any of your answers, so a refresh means starting fresh.
        </p>
        <Link to="/" className="btn btn--primary">
          Back to the questionnaire
        </Link>
      </div>
    );
  }

  return (
    <div className="results-page" data-testid="results-page">
      <header className="results-page__header">
        <h1>Your top matches</h1>
        <p className="results-page__sub">
          {results.length} {results.length === 1 ? 'city' : 'cities'} ranked by overall fit.
          {generatedAt ? (
            <>
              {' '}Computed{' '}
              <time dateTime={generatedAt}>
                {new Date(generatedAt).toLocaleString()}
              </time>
              .
            </>
          ) : null}
        </p>
        <div className="results-page__actions">
          <Link to="/" className="btn btn--secondary">
            ← Edit my preferences
          </Link>
          {count >= 2 ? (
            <Link
              to="/compare"
              className="btn btn--primary"
              data-testid="results-compare-cta"
            >
              Compare {count} {count === 1 ? 'city' : 'cities'} →
            </Link>
          ) : (
            <span
              className="results-page__hint"
              data-testid="results-compare-hint"
            >
              Pick {2 - count} more {2 - count === 1 ? 'city' : 'cities'} to compare
              side by side (up to {SHORTLIST_MAX}).
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
              onToggleShortlist={() => toggle(r)}
              shortlistFull={full && !has(r.city.slug)}
            />
          </li>
        ))}
      </ol>
      {items.length > 0 ? (
        <p className="results-page__shortlist-summary" data-testid="results-shortlist-summary">
          {items.length === 1
            ? `1 city saved for comparison. Pick at least one more.`
            : `${items.length} cities saved for comparison.`}
        </p>
      ) : null}
    </div>
  );
}

