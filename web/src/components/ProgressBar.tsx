/**
 * ProgressBar — the 7-step questionnaire progress indicator.
 *
 * Per Acceptance-Criteria Feature 2 and Screen-Specs §2, each step
 * advances the fill by exactly 14.2% (≈ 100/7). We expose a textual
 * "Step N of TOTAL" label for screen readers and a visible bar for
 * sighted users.
 */
import './ProgressBar.css';

export interface ProgressBarProps {
  /** 1-indexed current step (1..total). */
  step: number;
  /** Total number of steps (default 7). */
  total?: number;
}

export function ProgressBar({ step, total = 7 }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (step / total) * 100));
  return (
    <div
      className="progress-bar"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={step}
      aria-label={`Step ${step} of ${total}`}
      data-testid="progress-bar"
    >
      <div
        className="progress-bar__fill"
        style={{ width: `${pct}%` }}
        data-testid="progress-bar-fill"
      />
      <span className="progress-bar__label" data-testid="progress-bar-label">
        Step {step} of {total}
      </span>
    </div>
  );
}