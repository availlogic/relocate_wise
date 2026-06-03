/**
 * ImportanceSlider — 0..3 segmented slider for the `importance` field.
 *
 * The PRD calls for a 0-3 scale where 0 means "I don't care" and 3 means
 * "Critical". We render 4 radio-style buttons in a single row so the UI
 * is keyboard-friendly without dragging a real <input type="range">. A
 * textual description under the slider explains the current level.
 */
import type { Importance } from '@relocatewise/shared';

const LEVELS: ReadonlyArray<{ value: Importance; label: string; desc: string }> = [
  { value: 0, label: 'Skip', desc: "Don't factor in." },
  { value: 1, label: 'Nice to have', desc: 'Soft preference.' },
  { value: 2, label: 'Important', desc: 'Strong preference.' },
  { value: 3, label: 'Critical', desc: 'Deal-breaker if missing.' },
];

export interface ImportanceSliderProps {
  name: string;
  legend: string;
  value: Importance;
  onChange: (value: Importance) => void;
  helpText?: string;
}

export function ImportanceSlider({
  name,
  legend,
  value,
  onChange,
  helpText,
}: ImportanceSliderProps) {
  const current = LEVELS.find((l) => l.value === value) ?? LEVELS[0]!;
  return (
    <fieldset
      className="importance-slider"
      data-testid={`importance-${name}`}
    >
      <legend className="importance-slider__legend">
        {legend}
      </legend>
      {helpText ? <p className="importance-slider__help">{helpText}</p> : null}
      <div
        className="importance-slider__levels"
        role="radiogroup"
        aria-label={legend}
      >
        {LEVELS.map((level) => (
          <label
            key={level.value}
            className={`importance-slider__level${
              value === level.value ? ' is-active' : ''
            }`}
            data-testid={`${name}-${level.value}`}
          >
            <input
              type="radio"
              name={name}
              value={level.value}
              checked={value === level.value}
              onChange={() => onChange(level.value)}
            />
            <span className="importance-slider__num">{level.value}</span>
            <span className="importance-slider__label">{level.label}</span>
          </label>
        ))}
      </div>
      <p
        className="importance-slider__desc"
        aria-live="polite"
        data-testid={`${name}-desc`}
      >
        <strong>{current.label}.</strong> {current.desc}
      </p>
    </fieldset>
  );
}
