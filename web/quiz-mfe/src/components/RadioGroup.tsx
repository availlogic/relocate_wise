/**
 * RadioGroup — single-choice picker rendered as a list of labelled options.
 *
 * Used for one-of-N selections where the option labels are short (climate,
 * career industry, education priority). A `null` value is allowed by passing
 * `nullable` so the user can clear their choice. The "No preference" label
 * is localised via the `noPreferenceLabel` prop (default English text is
 * kept as a fallback for callers that don't use i18n).
 */
import type { ChangeEvent } from 'react';

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

export interface RadioGroupProps<T extends string> {
  name: string;
  legend: string;
  options: ReadonlyArray<RadioOption<T>>;
  value: T | null;
  onChange: (value: T | null) => void;
  nullable?: boolean;
  required?: boolean;
  helpText?: string;
  /** Text for the "No preference" nullable option. Defaults to "No preference". */
  noPreferenceLabel?: string;
}

export function RadioGroup<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  nullable = false,
  required = false,
  helpText,
  noPreferenceLabel = 'No preference',
}: RadioGroupProps<T>) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    onChange(next === '' ? null : (next as T));
  };

  return (
    <fieldset
      className="radio-group"
      data-testid={`radio-group-${name}`}
      aria-describedby={helpText ? `${name}-help` : undefined}
    >
      <legend className="radio-group__legend">
        {legend}
        {required ? <span aria-hidden="true"> *</span> : null}
      </legend>
      {helpText ? (
        <p id={`${name}-help`} className="radio-group__help">
          {helpText}
        </p>
      ) : null}
      <div className="radio-group__options" role="radiogroup">
        {nullable ? (
          <label
            className={`radio-option${value === null ? ' is-active' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value=""
              checked={value === null}
              onChange={handleChange}
              data-testid={`${name}-null`}
            />
            <span>{noPreferenceLabel}</span>
          </label>
        ) : null}
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`radio-option${value === opt.value ? ' is-active' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={handleChange}
              data-testid={`${name}-${opt.value}`}
            />
            <span>
              <strong>{opt.label}</strong>
              {opt.description ? (
                <span className="radio-option__desc"> — {opt.description}</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}