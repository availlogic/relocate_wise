/**
 * TagPicker — multi-select chip group for lifestyle tags.
 *
 * Tapping a chip toggles its presence in the array. Empty array means
 * "no preference" for the community dimension per the matching engine.
 */
export interface TagPickerProps<T extends string> {
  name: string;
  legend: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  selected: ReadonlyArray<T>;
  onChange: (next: T[]) => void;
  helpText?: string;
  maxSelections?: number;
}

export function TagPicker<T extends string>({
  name,
  legend,
  options,
  selected,
  onChange,
  helpText,
  maxSelections,
}: TagPickerProps<T>) {
  const toggle = (value: T) => {
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
        {selected.length === 0
          ? 'No tags selected — dimension treated as "no preference".'
          : `${selected.length} selected.`}
      </p>
    </fieldset>
  );
}
