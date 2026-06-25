/**
 * CityDimensions — visual representation of the eight dimension scores
 * for a single city. Renders each as a labelled bar with a 0..5 scale
 * (sub-scores like climate's `label` are shown as plain text).
 *
 * v0.3.0: now displays 8 dimensions per PRD v3.1.0 / FTC-10 (Climate,
 * Cost, Housing, Career, Healthcare, Education, Community, Military
 * Safety).
 */
import type { CityDimensions as CityDimensionsT } from '@relocatewise/shared';
import './CityDimensions.css';

export interface CityDimensionsProps {
  dimensions: CityDimensionsT;
}

interface BarRow {
  label: string;
  value: number;
  sub?: string;
}

export function CityDimensions({ dimensions }: CityDimensionsProps) {
  const rows: BarRow[] = [
    {
      label: 'Climate',
      value: 0,
      sub: dimensions.climate.label,
    },
    {
      label: 'Cost of living',
      value: dimensions.cost,
    },
    {
      label: 'Housing',
      value: dimensions.housing,
    },
    {
      label: 'Education',
      value: dimensions.education,
    },
    {
      label: 'Healthcare',
      value: dimensions.healthcare,
    },
    {
      label: 'Military safety',
      value: dimensions.military_safety,
      ...(dimensions.military_safety_sub
        ? {
            sub: `Conflict risk: ${prettyRisk(
              dimensions.military_safety_sub.conflict_risk,
            )} · Advisory: ${dimensions.military_safety_sub.travel_advisory}`,
          }
        : {}),
    },
  ];

  const careerRows: BarRow[] = [
    { label: 'Tech', value: dimensions.career.tech },
    { label: 'Finance', value: dimensions.career.finance },
    { label: 'Healthcare', value: dimensions.career.healthcare },
    { label: 'Creative', value: dimensions.career.creative },
    { label: 'Manufacturing', value: dimensions.career.manufacturing },
  ];

  const communityRows: BarRow[] = [
    { label: 'Urban', value: dimensions.community.urban },
    { label: 'Suburban', value: dimensions.community.suburban },
    { label: 'Coastal', value: dimensions.community.coastal },
    { label: 'Mountain', value: dimensions.community.mountain },
    { label: 'Arts & culture', value: dimensions.community.arts_culture },
    { label: 'Family-oriented', value: dimensions.community.family_oriented },
    { label: 'Expat-friendly', value: dimensions.community.expat_friendly },
  ];

  return (
    <div className="city-dims" data-testid="city-dims">
      <section className="city-dims__group">
        <h3>Overall</h3>
        <ul>
          {rows.map((r) => (
            <DimensionRow key={r.label} row={r} />
          ))}
        </ul>
      </section>
      <section className="city-dims__group">
        <h3>Career by industry</h3>
        <ul>
          {careerRows.map((r) => (
            <DimensionRow key={r.label} row={r} />
          ))}
        </ul>
      </section>
      <section className="city-dims__group">
        <h3>Community</h3>
        <ul>
          {communityRows.map((r) => (
            <DimensionRow key={r.label} row={r} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function prettyRisk(risk: string): string {
  if (!risk) return '—';
  return risk.charAt(0).toUpperCase() + risk.slice(1);
}

function DimensionRow({ row }: { row: BarRow }) {
  const pct = Math.max(0, Math.min(5, row.value)) * 20;
  const tier = row.value >= 4 ? 'high' : row.value >= 2.5 ? 'mid' : 'low';
  return (
    <li className="city-dims__row" data-testid={`dim-${row.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
      <span className="city-dims__label">{row.label}</span>
      <span className="city-dims__bar" aria-hidden="true">
        <span className={`city-dims__fill city-dims__fill--${tier}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="city-dims__value">
        {row.sub ? row.sub : row.value.toFixed(1)}
      </span>
    </li>
  );
}
