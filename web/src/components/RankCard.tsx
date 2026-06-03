/**
 * RankCard — a single result in the ranked list.
 *
 * Shows the city name, country, region, an integer score (0..100) with
 * a color-coded badge, and the templated "why this fits you" sentence
 * the matching engine returns (per Architecture §5). A "View details"
 * link routes to /city/:slug.
 *
 * When `inShortlist` and `onToggleShortlist` are provided, the card also
 * renders an "Add to compare" checkbox (PRD S4 + S7). The props are
 * optional so the card stays usable in places that don't have a
 * ShortlistProvider in scope (e.g. storybook, simple preview surfaces).
 */
import { Link } from 'react-router-dom';
import type { MatchedCityFull } from '../api';
import './RankCard.css';

export interface RankCardProps {
  rank: number;
  result: MatchedCityFull;
  /** When provided, an "Add to compare" checkbox is rendered. */
  inShortlist?: boolean;
  /**
   * Click handler for the checkbox. If the shortlist is full and the
   * city is not in it, the checkbox is rendered disabled and the
   * handler is not invoked.
   */
  onToggleShortlist?: () => void;
  /** True when the shortlist has reached its cap of 3. */
  shortlistFull?: boolean;
}

export function RankCard({
  rank,
  result,
  inShortlist,
  onToggleShortlist,
  shortlistFull,
}: RankCardProps) {
  const { city, score, why } = result;
  const tier = scoreTier(score);
  const showCompare =
    inShortlist !== undefined && onToggleShortlist !== undefined;
  const checkboxDisabled = Boolean(shortlistFull) && !inShortlist;
  return (
    <article
      className={`rank-card rank-card--${tier}`}
      data-testid={`rank-card-${rank}`}
    >
      <header className="rank-card__header">
        <div className="rank-card__rank" aria-label={`Rank ${rank}`}>
          #{rank}
        </div>
        <div className="rank-card__title">
          <h2>
            {city.name}
            <span className="rank-card__country">, {city.country}</span>
          </h2>
          <p className="rank-card__region">{city.region}</p>
        </div>
        <div
          className={`rank-card__score rank-card__score--${tier}`}
          data-testid={`rank-card-${rank}-score`}
          aria-label={`Match score ${score} out of 100`}
        >
          {score}
        </div>
      </header>
      <p className="rank-card__why" data-testid={`rank-card-${rank}-why`}>
        {why}
      </p>
      <footer className="rank-card__footer">
        {showCompare && (
          <label
            className="rank-card__compare"
            data-testid={`rank-card-${rank}-compare`}
          >
            <input
              type="checkbox"
              checked={inShortlist}
              disabled={checkboxDisabled}
              onChange={onToggleShortlist}
              data-testid={`rank-card-${rank}-compare-checkbox`}
            />
            <span>
              {inShortlist ? 'In compare set' : 'Add to compare'}
              {checkboxDisabled && ' (max 3)'}
            </span>
          </label>
        )}
        <Link
          to={`/city/${encodeURIComponent(city.slug)}`}
          className="btn btn--secondary"
          data-testid={`rank-card-${rank}-link`}
        >
          View full profile
        </Link>
      </footer>
    </article>
  );
}

function scoreTier(score: number): 'high' | 'medium' | 'low' {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}
