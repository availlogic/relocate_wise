/**
 * TagPicker — multi-select chip group for lifestyle tags.
 *
 * Tapping a chip toggles its presence in the array. Empty array means
 * "no preference" for the community dimension per the matching engine.
 *
 * v0.4.x — Bug 5 / FTC-5b: an optional "No Preference" pseudo-chip can
 * be rendered as the first entry in the option list. The sentinel
 * value `NO_PREFERENCE` is private to this component and is never
 * exposed in the public `selected` array (the matching engine
 * receives `[]` either way). Click semantics:
 *   - "No Preference" is the default state (selected-by-default when
 *     the prop is provided and the array is empty).
 *   - Clicking "No Preference" clears any other selected tags.
 *   - Clicking any other tag while "No Preference" is active clears
 *     "No Preference" and toggles the new tag in.
 */
export interface TagPickerProps<T extends string> {
  name: string;
  legend: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  selected: ReadonlyArray<T>;
  onChange: (next: T[]) => void;
  helpText?: string;
  maxSelections?: number;
  /**
   * Optional label for the "No Preference" pseudo-chip. When set, the
   * chip is rendered as the first entry in the list and is mutually
   * exclusive with the other tags.
   */
  noPreferenceLabel?: string;
}

const NO_PREFERENCE = '__none__';

export function TagPicker<T extends string>({
  name,
  legend,
  options,
  selected,
  onChange,
  helpText,
  maxSelections,
  noPreferenceLabel,
}: TagPickerProps<T>) {
  const noPrefOn = selected.length === 0;
  const toggle = (value: T | typeof NO_PREFERENCE) => {
    if (value === NO_PREFERENCE) {
      // "No Preference" is exclusive: always clear the array.
      onChange([]);
      return;
    }
    // Toggling a real tag while "No Preference" is active replaces
    // the no-preference state with the new tag.
    if (noPrefOn) {
      onChange([value]);
      return;
    }
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
      return;
    }
    if (maxSelections !== undefined && selected.length >= maxSelections) {
      return;
    }
    onChange([...selected, value]);
  };

  return (
    <fieldset
      className="tag-picker"
      data-testid={`tag-picker-${name}`}
      role="group"
      aria-label={legend}
    >
      <legend className="tag-picker__legend">{legend}</legend>
      {helpText ? <p className="tag-picker__help">{helpText}</p> : null}
      <div className="tag-picker__chips">
        {noPreferenceLabel ? (
          <button
            key="__no-preference__"
            type="button"
            className={`tag-chip${noPrefOn ? ' is-on' : ''}`}
            aria-pressed={noPrefOn}
            onClick={() => toggle(NO_PREFERENCE)}
            data-testid={`${name}-no-preference`}
          >
            {noPreferenceLabel}
          </button>
        ) : null}
        {options.map((opt) => {
          const isOn = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              className={`tag-chip${isOn ? ' is-on' : ''}`}
              aria-pressed={isOn}
              onClick={() => toggle(opt.value)}
              data-testid={`${name}-${opt.value}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <p className="tag-picker__count" aria-live="polite">
        {noPrefOn
          ? noPreferenceLabel ?? 'No preference'
          : `${selected.length} selected.`}
      </p>
    </fieldset>
  );
}
