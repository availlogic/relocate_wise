/**
 * ComparePage — side-by-side comparison of 2 or 3 shortlisted cities.
 *
 * Implements PRD S6, Acceptance-Criteria Feature 5, and E2E-2:
 *   - Direct access with < 2 cities → redirect to /results with a
 *     transient notice (Acceptance-Criteria Feature 5 Rule).
 *   - Removing a city that drops the shortlist below 2 also redirects
 *     with a notice (same rule).
 *   - 7 dimensions are aligned row-by-row; for each row the cell that
 *     owns the unique best score is highlighted (`compare-page__cell--best`).
 *   - Cost of Living and Housing are inverted: a LOWER index represents
 *     a cheaper city, which is the winner condition (Acceptance-Criteria
 *     Feature 5, FTC-13).
 */
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useShortlist, SHORTLIST_MAX } from '../state/shortlist';
import './ComparePage.css';

const COMPARISON_INSUFFICIENT_NOTICE =
  'Please select at least 2 cities to compare.';
const COMPARISON_DROPPED_NOTICE =
  'You now have fewer than 2 cities in your comparison.';

export function ComparePage() {
  const { items, remove, clear } = useShortlist();
  const navigate = useNavigate();

  // Insufficient shortlist (direct access, or after the user removed
  // a city here and dropped below 2). We always emit the
  // "insufficient" notice from this side; the "removed-below-2" path
  // is signalled via /results location.state from handleRemove.
  if (items.length < 2) {
    return (
      <Navigate
        to="/results"
        replace
        state={{ compareNotice: COMPARISON_INSUFFICIENT_NOTICE }}
      />
    );
  }

  const handleRemove = (slug: string) => {
    if (items.length === 2) {
      // Removing the last-but-one drops the shortlist below 2 — flag it
      // so /results can show the appropriate notice.
      remove(slug);
      navigate('/results', { state: { compareNotice: COMPARISON_DROPPED_NOTICE } });
    } else {
      remove(slug);
    }
  };

  return (
    <div className="compare-page" data-testid="compare-page">
      <header className="compare-page__header">
        <h1>Compare cities</h1>
        <p className="compare-page__sub">
          Comparing {items.length} of {SHORTLIST_MAX} possible cities. The
          best match in each row is highlighted.
        </p>
        <div className="compare-page__actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={clear}
            data-testid="compare-clear"
          >
            Clear all
          </button>
          <Link to="/results" className="btn btn--secondary">
            Back to results
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
                  aria-label={`Match score ${entry.score} out of 100`}
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
                Remove
              </button>
            </header>
            {entry.why ? (
              <p className="compare-card__why">“{entry.why}”</p>
            ) : null}
          </section>
        ))}
      </div>

      <DimensionTable items={items} />
    </div>
  );
}

interface DimensionRow {
  label: string;
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
    label: 'Climate',
    pick: (city) => {
      // No numeric value; render the label below as a special case.
      // The "winner" highlighting is meaningless on a label, so we
      // skip highlighting here by using a constant string match.
      const v = city.city.dimensions.climate.label;
      return LABEL_RANK[v] ?? 0;
    },
    format: (n) => LABEL_BY_RANK[n] ?? '—',
  },
  {
    label: 'Cost of living',
    invert: true,
    pick: (city) => city.city.dimensions.cost,
    format: (n) => `${n}/5`,
  },
  {
    label: 'Housing',
    invert: true,
    pick: (city) => city.city.dimensions.housing,
    format: (n) => `${n}/5`,
  },
  {
    label: 'Career (avg)',
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
    label: 'Education',
    pick: (city) => city.city.dimensions.education,
    format: (n) => `${n}/5`,
  },
  {
    label: 'Healthcare',
    pick: (city) => city.city.dimensions.healthcare,
    format: (n) => `${n}/5`,
  },
  {
    label: 'Community (max)',
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
  return (
    <table className="compare-page__table" data-testid="compare-table">
      <thead>
        <tr>
          <th scope="col">Dimension</th>
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
            <tr key={row.label} data-testid={`compare-row-${slugify(row.label)}`}>
              <th scope="row">{row.label}</th>
              {items.map((c, idx) => {
                const v = values[idx]!;
                const isBest = !allSame && v === target;
                return (
                  <td
                    key={c.city.slug}
                    className={isBest ? 'compare-page__cell--best' : undefined}
                    data-testid={`compare-cell-${slugify(row.label)}-${c.city.slug}`}
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

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}