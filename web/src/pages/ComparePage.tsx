/**
 * ComparePage — side-by-side comparison of 2 or 3 shortlisted cities.
 *
 * Implements PRD S6, Acceptance-Criteria Feature 5, and E2E-2:
 *   - Direct access with < 2 cities → redirect to /results with a
 *     transient notice (Acceptance-Criteria Feature 5 Rule).
 *   - Removing a city that drops the shortlist below 2 also redirects
 *     with a notice (same rule).
 *   - 8 dimensions are aligned row-by-row (PRD v3.1.0 D1..D8); for each
 *     row the cell that owns the unique best score is highlighted
 *     (`compare-page__cell--best`).
 *   - Cost of Living and Housing are inverted: a LOWER index represents
 *     a cheaper city, which is the winner condition (Acceptance-Criteria
 *     Feature 5, FTC-13).
 *
 * v0.4.0: copy is routed through i18next (PRD v3.2.0 S11).
 */
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useShortlist, SHORTLIST_MAX } from '../state/shortlist';
import { renderWhyTemplate } from '../i18n/why';
import './ComparePage.css';

export function ComparePage() {
  const { items, remove, clear } = useShortlist();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Insufficient shortlist (direct access, or after the user removed
  // a city here and dropped below 2). We always emit the
  // "insufficient" notice from this side; the "removed-below-2" path
  // is signalled via /results location.state from handleRemove.
  if (items.length < 2) {
    return (
      <Navigate
        to="/results"
        replace
        state={{ compareNotice: t('compare.insufficient') }}
      />
    );
  }

  const handleRemove = (slug: string) => {
    if (items.length === 2) {
      // Removing the last-but-one drops the shortlist below 2 — flag it
      // so /results can show the appropriate notice.
      remove(slug);
      navigate('/results', { state: { compareNotice: t('compare.dropped') } });
    } else {
      remove(slug);
    }
  };

  return (
    <div className="compare-page" data-testid="compare-page">
      <header className="compare-page__header">
        <h1>{t('compare.title')}</h1>
        <p className="compare-page__sub">
          {t('compare.sub', { count: items.length, max: SHORTLIST_MAX })}
        </p>
        <div className="compare-page__actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={clear}
            data-testid="compare-clear"
          >
            {t('compare.clearAll')}
          </button>
          <Link to="/results" className="btn btn--secondary">
            {t('compare.backToResults')}
          </Link>
        </div>
      </header>

      <div
        className="compare-page__grid"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        data-testid="compare-grid"
      >
        {items.map((entry) => (
          <section
            key={entry.city.slug}
            className="compare-card"
            data-testid={`compare-card-${entry.city.slug}`}
          >
            <header className="compare-card__header">
              <h2>{entry.city.name}</h2>
              <p className="compare-card__country">
                {entry.city.country} · {entry.city.region}
              </p>
              {entry.score > 0 ? (
                <div
                  className="compare-card__score"
                  aria-label={t('results.scoreAria', { score: entry.score })}
                >
                  {entry.score}
                  <span>/100</span>
                </div>
              ) : null}
              <button
                type="button"
                className="btn btn--link"
                onClick={() => handleRemove(entry.city.slug)}
                data-testid={`compare-remove-${entry.city.slug}`}
              >
                {t('compare.remove')}
              </button>
            </header>
            {entry.why ? (
              <p className="compare-card__why">
                {t('compare.why', { why: renderWhyTemplate(t, entry.why, entry.why_key, entry.why_vars) })}
              </p>
            ) : null}
          </section>
        ))}
      </div>

      <DimensionTable items={items} />
    </div>
  );
}

interface DimensionRow {
  /** Stable slug used for the row's data-testid. Localisation-agnostic. */
  slug: string;
  /** i18next key for the human-readable label. */
  labelKey: string;
  /** Lower is better if `invert` is true (cost / housing). */
  invert?: boolean;
  /** Format the value for display (defaults to `${n}/5`). */
  format?: (n: number) => string;
  /** Extract the per-city numeric value for this row. */
  pick: (city: CompareCity) => number;
}

type CompareCity = ReturnType<typeof useShortlist>['items'][number];

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const ROWS: ReadonlyArray<DimensionRow> = [
  {
    slug: 'climate',
    labelKey: 'compare.rows.climate',
    pick: (city) => {
      const v = city.city.dimensions.climate.label;
      return LABEL_RANK[v] ?? 0;
    },
    format: (n) => LABEL_BY_RANK[n] ?? '—',
  },
  {
    slug: 'cost-of-living',
    labelKey: 'compare.rows.cost',
    invert: true,
    pick: (city) => city.city.dimensions.cost,
    format: (n) => `${n}/5`,
  },
  {
    slug: 'housing',
    labelKey: 'compare.rows.housing',
    invert: true,
    pick: (city) => city.city.dimensions.housing,
    format: (n) => `${n}/5`,
  },
  {
    slug: 'career-avg',
    labelKey: 'compare.rows.career',
    pick: (city) =>
      mean([
        city.city.dimensions.career.tech,
        city.city.dimensions.career.finance,
        city.city.dimensions.career.healthcare,
        city.city.dimensions.career.creative,
        city.city.dimensions.career.manufacturing,
      ]),
    format: (n) => `${n.toFixed(1)}/5`,
  },
  {
    slug: 'education',
    labelKey: 'compare.rows.education',
    pick: (city) => city.city.dimensions.education,
    format: (n) => `${n}/5`,
  },
  {
    slug: 'healthcare',
    labelKey: 'compare.rows.healthcare',
    pick: (city) => city.city.dimensions.healthcare,
    format: (n) => `${n}/5`,
  },
  {
    slug: 'community-max',
    labelKey: 'compare.rows.community',
    pick: (city) =>
      Math.max(
        city.city.dimensions.community.urban,
        city.city.dimensions.community.suburban,
        city.city.dimensions.community.coastal,
        city.city.dimensions.community.mountain,
        city.city.dimensions.community.arts_culture,
        city.city.dimensions.community.family_oriented,
        city.city.dimensions.community.expat_friendly,
      ),
    format: (n) => `${n}/5`,
  },
  {
    slug: 'military-safety',
    labelKey: 'compare.rows.militarySafety',
    pick: (city) => city.city.dimensions.military_safety,
    format: (n) => `${n}/5`,
  },
];

/** Map city climate labels to a sortable rank so we can pick a winner. */
const LABEL_RANK: Readonly<Record<string, number>> = {
  Tropical: 1,
  Mediterranean: 2,
  Arid: 3,
  Temperate: 4,
  Highland: 5,
  Continental: 6,
  Cold: 7,
};

const LABEL_BY_RANK: Readonly<Record<number, string>> = Object.fromEntries(
  Object.entries(LABEL_RANK).map(([k, v]) => [v, k]),
);

function DimensionTable({
  items,
}: {
  items: ReturnType<typeof useShortlist>['items'];
}) {
  const { t } = useTranslation();
  return (
    <table className="compare-page__table" data-testid="compare-table">
      <thead>
        <tr>
          <th scope="col">{t('compare.dimension')}</th>
          {items.map((i) => (
            <th key={i.city.slug} scope="col">{i.city.name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ROWS.map((row) => {
          const values = items.map((c) => row.pick(c));
          const target = row.invert ? Math.min(...values) : Math.max(...values);
          const allSame = values.every((v) => v === values[0]);
          return (
            <tr key={row.slug} data-testid={`compare-row-${row.slug}`}>
              <th scope="row">{t(row.labelKey)}</th>
              {items.map((c, idx) => {
                const v = values[idx]!;
                const isBest = !allSame && v === target;
                return (
                  <td
                    key={c.city.slug}
                    className={isBest ? 'compare-page__cell--best' : undefined}
                    data-testid={`compare-cell-${row.slug}-${c.city.slug}`}
                  >
                    {row.format ? row.format(v) : `${v}/5`}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// (slugify helper was removed — rows now use stable English slugs
// that survive localisation, e.g. `compare-row-military-safety`.)