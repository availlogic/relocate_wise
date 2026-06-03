/**
 * ComparePage — side-by-side comparison of 2 or 3 shortlisted cities.
 *
 * Implements PRD S6: "users can select up to three cities from their
 * results list and see a side-by-side comparison on a dedicated page."
 *
 * - Empty shortlist → CTA to /results (with a "go rank cities" prompt)
 * - Exactly 1 city → prompt to add at least one more
 * - 2 or 3 cities → comparison grid with the best match per row
 *   highlighted (a soft yellow background per Architecture §3).
 *
 * The page is read-only on city data; the only mutations are removing
 * a single city from the shortlist and clearing the whole set.
 */
import { Link } from 'react-router-dom';
import { useShortlist, SHORTLIST_MAX } from '../state/shortlist';
import './ComparePage.css';

export function ComparePage() {
  const { items, remove, clear } = useShortlist();

  if (items.length === 0) {
    return <EmptyState />;
  }

  if (items.length === 1) {
    const only = items[0]!;
    return <OneState city={only} />;
  }

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
              <div
                className="compare-card__score"
                aria-label={`Match score ${entry.score} out of 100`}
              >
                {entry.score}
                <span>/100</span>
              </div>
              <button
                type="button"
                className="btn btn--link"
                onClick={() => remove(entry.city.slug)}
                data-testid={`compare-remove-${entry.city.slug}`}
              >
                Remove
              </button>
            </header>
            <p className="compare-card__why">“{entry.why}”</p>
          </section>
        ))}
      </div>

      <DimensionTable items={items} />
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="compare-page compare-page--empty"
      data-testid="compare-empty"
    >
      <h1>No cities to compare yet</h1>
      <p>
        Rank a few cities first, then tick <em>Add to compare</em> on up to{' '}
        {SHORTLIST_MAX} results to see them side by side.
      </p>
      <Link to="/" className="btn btn--primary">
        Start the questionnaire
      </Link>
    </div>
  );
}

function OneState({ city }: { city: { city: { name: string; slug: string } } }) {
  return (
    <div
      className="compare-page compare-page--empty"
      data-testid="compare-one"
    >
      <h1>Add at least one more city</h1>
      <p>
        <strong>{city.city.name}</strong> is in your shortlist. Pick at
        least one more from your results to start comparing.
      </p>
      <Link to="/results" className="btn btn--primary">
        Back to results
      </Link>
    </div>
  );
}

/** A small dimension matrix — one row per dimension, one column per city. */
function DimensionTable({
  items,
}: {
  items: ReturnType<typeof useShortlist>['items'];
}) {
  const rows: Array<{
    label: string;
    values: number[];
    format: (n: number) => string;
  }> = [
    { label: 'Cost of living', values: items.map((i) => i.city.dimensions.cost), format: (n) => `${n}/5` },
    { label: 'Housing', values: items.map((i) => i.city.dimensions.housing), format: (n) => `${n}/5` },
    { label: 'Education', values: items.map((i) => i.city.dimensions.education), format: (n) => `${n}/5` },
    { label: 'Healthcare', values: items.map((i) => i.city.dimensions.healthcare), format: (n) => `${n}/5` },
  ];
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
        {rows.map((row) => {
          const max = Math.max(...row.values);
          return (
            <tr key={row.label} data-testid={`compare-row-${slugify(row.label)}`}>
              <th scope="row">{row.label}</th>
              {row.values.map((v, idx) => {
                const item = items[idx]!;
                const best = v === max && row.values.filter((x) => x === max).length === 1;
                return (
                  <td
                    key={item.city.slug}
                    className={best ? 'compare-page__cell--best' : undefined}
                    data-testid={`compare-cell-${slugify(row.label)}-${item.city.slug}`}
                  >
                    {row.format(v)}
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
  return s.toLowerCase().replace(/\s+/g, '-');
}
