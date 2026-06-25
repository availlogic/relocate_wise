/**
 * CeilingSlider — 1..5 segmented slider for the cost/housing ceiling field.
 *
 * Rendered as 5 buttons. `null` is allowed (user has not picked a value
 * yet), in which case all buttons appear unselected. Per PRD FR-3 the
 * ceiling is only meaningful when the corresponding importance is > 0;
 * the parent component is responsible for showing/hiding this slider.
 */
export interface CeilingSliderProps {
  name: string;
  legend: string;
  value: number | null;
  onChange: (value: number) => void;
  /** Optional descriptor for each level, 5 entries. */
  levelLabels?: ReadonlyArray<string>;
  helpText?: string;
}

const DEFAULT_LABELS: ReadonlyArray<string> = [
  'Very low',
  'Low',
  'Average',
  'High',
  'Very high',
];

export function CeilingSlider({
  name,
  legend,
  value,
  onChange,
  levelLabels = DEFAULT_LABELS,
  helpText,
}: CeilingSliderProps) {
  return (
    <fieldset className="ceiling-slider" data-testid={`ceiling-${name}`}>
      <legend className="ceiling-slider__legend">{legend}</legend>
      {helpText ? <p className="ceiling-slider__help">{helpText}</p> : null}
      <div
        className="ceiling-slider__levels"
        role="radiogroup"
        aria-label={legend}
      >
        {[1, 2, 3, 4, 5].map((level) => {
          const isActive = value === level;
          const labelText = levelLabels[level - 1] ?? `Level ${level}`;
          return (
            <label
              key={level}
              className={`ceiling-slider__level${
                isActive ? ' is-active' : ''
              }`}
              data-testid={`${name}-${level}`}
            >
              <input
                type="radio"
                name={name}
                value={level}
                checked={isActive}
                onChange={() => onChange(level)}
              />
              <span className="ceiling-slider__num">{level}</span>
              <span className="ceiling-slider__label">{labelText}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
