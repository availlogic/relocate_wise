/**
 * ProgressBar — the 8-step questionnaire progress indicator.
 *
 * Per Acceptance-Criteria Feature 2 and Screen-Specs §2, each step
 * advances the fill by exactly 12.5% (≈ 100/8). We expose a textual
 * "Step N of TOTAL" label for screen readers and a visible bar for
 * sighted users. The label is localised through i18next (the wizard
 * passes `total` for the aria label; the visible label is the literal
 * string from the translation bundle).
 */
import { useTranslation } from 'react-i18next';
import './ProgressBar.css';

export interface ProgressBarProps {
  /** 1-indexed current step (1..total). */
  step: number;
  /** Total number of steps (default 8). */
  total?: number;
}

export function ProgressBar({ step, total = 8 }: ProgressBarProps) {
  const { t } = useTranslation();
  const pct = Math.min(100, Math.max(0, (step / total) * 100));
  return (
    <div
      className="progress-bar"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={step}
      aria-label={t('wizard.labels.step', { step, total })}
      data-testid="progress-bar"
    >
      <div
        className="progress-bar__fill"
        style={{ width: `${pct}%` }}
        data-testid="progress-bar-fill"
      />
      <span className="progress-bar__label" data-testid="progress-bar-label">
        {t('wizard.labels.step', { step, total })}
      </span>
    </div>
  );
}