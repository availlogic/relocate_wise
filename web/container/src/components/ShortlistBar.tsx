/**
 * ShortlistBar — the floating compare-shortlist bar.
 *
 * Renders at the bottom of any page that hosts it (currently /results
 * and /city/:slug). Per Acceptance-Criteria Feature 4 + Screen-Specs §3:
 *   - Hidden when shortlist count == 0.
 *   - Shows count "N of 3 selected" + city chips with remove X.
 *   - "Compare Now" CTA, disabled when count < 2.
 *   - "Clear all" empties the shortlist.
 *
 * Renders nothing when there are no items; pages can mount it
 * unconditionally.
 *
 * v0.4.0: copy is routed through i18next (PRD v3.2.0 S11).
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SHORTLIST_MAX, useShortlist } from '../state/shortlist';
import './ShortlistBar.css';

export function ShortlistBar() {
  const { items, remove, clear, count } = useShortlist();
  const { t } = useTranslation();
  if (items.length === 0) return null;

  return (
    <aside
      className="shortlist-bar"
      role="region"
      aria-label="Comparison shortlist"
      data-testid="shortlist-bar"
    >
      <div className="shortlist-bar__left">
        <span className="shortlist-bar__count" data-testid="shortlist-bar-count">
          {t('shortlist.count', { count, max: SHORTLIST_MAX })}
        </span>
        <ul className="shortlist-bar__chips">
          {items.map((city) => (
            <li
              key={city.city.slug}
              className="shortlist-bar__chip"
              data-testid={`shortlist-bar-chip-${city.city.slug}`}
            >
              <span>{city.city.name}</span>
              <button
                type="button"
                aria-label={t('shortlist.remove', { name: city.city.name })}
                onClick={() => remove(city.city.slug)}
                data-testid={`shortlist-bar-remove-${city.city.slug}`}
                className="shortlist-bar__chip-x"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="shortlist-bar__right">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={clear}
          data-testid="shortlist-bar-clear"
        >
          {t('shortlist.clear')}
        </button>
        <Link
          to="/compare"
          className="btn btn--primary"
          aria-disabled={count < 2}
          data-testid="shortlist-bar-compare"
          onClick={(e) => {
            if (count < 2) e.preventDefault();
          }}
        >
          {t('shortlist.compare')}
        </Link>
      </div>
    </aside>
  );
}