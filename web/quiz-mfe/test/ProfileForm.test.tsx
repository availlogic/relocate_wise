/**
 * Tests for ProfileForm — the 8-step wizard described in PRD §5 (v3.1.0),
 * FR-1..FR-3, and Acceptance-Criteria Feature 2.
 *
 * Phase D (v1.0.0 GA) changed the submission contract: instead of
 * `postMatch()` being called from the MFE, the form now dispatches a
 * `rw:quiz_completed` Custom Event on `window` (Architecture §4.1,
 * FTC-17). The container's <App /> listens for the event and routes
 * /results; the Dashboard MFE re-issues `postMatch()` itself if it
 * needs a fresh response (see `readCachedResults`).
 *
 * Coverage targets the documented contract:
 *   - Exactly 8 steps are rendered sequentially; one question per step.
 *   - A progress bar fills incrementally and labels "Step N of 8".
 *   - Back returns to the previous step; Skip advances without selection.
 *   - The final step shows "View matches" (Submit).
 *   - On submit the form:
 *       1. Dispatches `rw:quiz_completed` with the `UserProfile`
 *          payload (FTC-17).
 *       2. Navigates to /results.
 *       3. Stashes the profile in `sessionStorage` for the dashboard
 *          MFE to rehydrate on back-navigation.
 *   - Step 2 ("Housing Budget") implements HF-1: a single 1-5 value
 *     maps to cost_ceiling=housing_ceiling=N, both importances=3.
 *   - Step 7 ("Density") implements MF-1: the choice merges into
 *     lifestyle_tags.
 *   - Step 8 ("Military Safety") emits military_safety_importance.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ProfileForm } from '../src/components/ProfileForm';
import type { UserProfile } from '@relocatewise/shared';

function renderForm() {
  function SpyOnLocation() {
    const loc = useLocation();
    return (
      <div>
        <div data-testid="results-path">{loc.pathname}</div>
        <pre data-testid="results-state">{JSON.stringify(loc.state)}</pre>
      </div>
    );
  }
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<ProfileForm />} />
        <Route path="/results" element={<SpyOnLocation />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Click Next to reach a specific step. Handles the submit-button swap on step 8. */
async function advanceToStep(user: ReturnType<typeof userEvent.setup>, step: number) {
  for (let i = 1; i < step; i++) {
    const next = screen.queryByTestId('wizard-next');
    if (next) {
      await user.click(next);
    }
  }
}

/** Wait for a `rw:quiz_completed` Custom Event to be dispatched on `window`. */
function waitForQuizCompleted(): Promise<CustomEvent<unknown>> {
  return new Promise<CustomEvent<unknown>>((resolve) => {
    function onEvent(event: Event) {
      window.removeEventListener('rw:quiz_completed', onEvent);
      resolve(event as CustomEvent<unknown>);
    }
    window.addEventListener('rw:quiz_completed', onEvent);
  });
}

describe('<ProfileForm /> (8-step wizard)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    // Clean up any stray listeners.
    window.sessionStorage.clear();
  });

  it('renders the wizard shell on step 1 with a working progress bar', () => {
    renderForm();
    expect(screen.getByTestId('profile-form')).toBeInTheDocument();
    const bar = screen.getByTestId('progress-bar');
    expect(bar).toHaveAttribute('aria-valuenow', '1');
    expect(bar).toHaveAttribute('aria-valuemax', '8');
    expect(screen.getByTestId('progress-bar-label').textContent).toMatch(/Step 1 of 8/);
  });

  it('navigates forward and back through the 8 steps', async () => {
    const user = userEvent.setup();
    renderForm();
    const back = screen.getByTestId('wizard-back');
    expect(back).toBeDisabled();
    await user.click(screen.getByTestId('wizard-next'));
    expect(back).not.toBeDisabled();
    expect(screen.getByTestId('progress-bar')).toHaveAttribute('aria-valuenow', '2');
    await user.click(back);
    expect(screen.getByTestId('progress-bar')).toHaveAttribute('aria-valuenow', '1');
  });

  it('Skip advances to the next step without selecting', async () => {
    const user = userEvent.setup();
    renderForm();
    expect(screen.getByTestId('progress-bar')).toHaveAttribute('aria-valuenow', '1');
    await user.click(screen.getByTestId('wizard-skip'));
    expect(screen.getByTestId('progress-bar')).toHaveAttribute(
      'aria-valuenow',
      '2',
    );
  });

  it('renders "View matches" only on step 8', async () => {
    const user = userEvent.setup();
    renderForm();
    expect(screen.queryByTestId('submit')).not.toBeInTheDocument();
    await advanceToStep(user, 8);
    expect(screen.getByTestId('submit')).toBeInTheDocument();
    expect(screen.getByTestId('submit').textContent).toMatch(/view matches/i);
  });

  it('Renders the density step with Urban / Suburban / Rural choices', async () => {
    const user = userEvent.setup();
    renderForm();
    await advanceToStep(user, 7);
    expect(screen.getByTestId('radio-group-density')).toBeInTheDocument();
    expect(screen.getByTestId('density-urban')).toBeInTheDocument();
    expect(screen.getByTestId('density-suburban')).toBeInTheDocument();
    expect(screen.getByTestId('density-rural')).toBeInTheDocument();
  });

  it('renders the military safety step on step 8', async () => {
    const user = userEvent.setup();
    renderForm();
    await advanceToStep(user, 8);
    expect(screen.getByTestId('military-safety-step')).toBeInTheDocument();
  });

  it('HF-1: a single Housing Budget value maps to cost + housing fields', async () => {
    const user = userEvent.setup();
    renderForm();
    await advanceToStep(user, 2);
    await user.click(screen.getByTestId('budget-3'));
    await advanceToStep(user, 8);
    const eventPromise = waitForQuizCompleted();
    await user.click(screen.getByTestId('submit'));
    const event = await eventPromise;
    const detail = (event as CustomEvent<{ profile: UserProfile }>).detail;
    expect(detail.profile.cost_ceiling).toBe(3);
    expect(detail.profile.housing_ceiling).toBe(3);
    expect(detail.profile.cost_importance).toBe(3);
    expect(detail.profile.housing_importance).toBe(3);
  });

  it('MF-1: step 7 density merges into lifestyle_tags', async () => {
    const user = userEvent.setup();
    renderForm();
    await advanceToStep(user, 7);
    await user.click(screen.getByTestId('density-suburban'));
    await advanceToStep(user, 8);
    const eventPromise = waitForQuizCompleted();
    await user.click(screen.getByTestId('submit'));
    const event = await eventPromise;
    const detail = (event as CustomEvent<{ profile: UserProfile }>).detail;
    expect(detail.profile.lifestyle_tags).toContain('suburban');
  });

  it('step 8 military_safety_importance 3 is captured in the payload', async () => {
    const user = userEvent.setup();
    renderForm();
    await advanceToStep(user, 8);
    await user.click(screen.getByTestId('military-safety-3'));
    const eventPromise = waitForQuizCompleted();
    await user.click(screen.getByTestId('submit'));
    const event = await eventPromise;
    const detail = (event as CustomEvent<{ profile: UserProfile }>).detail;
    expect(detail.profile.military_safety_importance).toBe(3);
  });

  it('skipped step 8 records military_safety_importance = 0 (default)', async () => {
    const user = userEvent.setup();
    renderForm();
    await advanceToStep(user, 8);
    // Don't click anything — the default is 0.
    const eventPromise = waitForQuizCompleted();
    await user.click(screen.getByTestId('submit'));
    const event = await eventPromise;
    const detail = (event as CustomEvent<{ profile: UserProfile }>).detail;
    expect(detail.profile.military_safety_importance).toBe(0);
  });

  it('on submit, navigates to /results (FTC-17 + Architecture §4.1)', async () => {
    const user = userEvent.setup();
    renderForm();
    await advanceToStep(user, 8);
    const eventPromise = waitForQuizCompleted();
    await user.click(screen.getByTestId('submit'));
    await eventPromise;
    await waitFor(() => {
      expect(screen.getByTestId('results-path').textContent).toBe('/results');
    });
  });

  it('on submit, stashes the profile in sessionStorage for the dashboard MFE', async () => {
    const user = userEvent.setup();
    renderForm();
    await advanceToStep(user, 8);
    const eventPromise = waitForQuizCompleted();
    await user.click(screen.getByTestId('submit'));
    await eventPromise;
    const raw = sessionStorage.getItem('rw:profile');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { climate?: string };
    expect(parsed).toHaveProperty('climate');
  });
});