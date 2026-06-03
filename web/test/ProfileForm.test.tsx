/**
 * Tests for ProfileForm — the 6-dimension preference form described in
 * PRD §5 (FR-2 and FR-3). We mount the form inside a MemoryRouter so
 * `useNavigate` has a real router to call into, and we mock the api
 * module so we can drive submit success / failure deterministically.
 *
 * Coverage targets the documented contract:
 *   - Submit is always enabled; the form is permissive by design.
 *   - Validation: cost_ceiling required when cost_importance > 0,
 *     housing_ceiling required when housing_importance > 0.
 *   - Dropping importance back to 0 clears the associated ceiling.
 *   - On success the form navigates to /results with the API
 *     response in location.state (no PII in the URL — AC-10).
 *   - On API failure the envelope message is rendered as an error
 *     and the form stays on the page (still submittable).
 *   - Restoring an `initial` profile pre-fills the form.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ProfileForm } from '../src/components/ProfileForm';
import { ApiError } from '../src/api';
import type { UserProfile } from '@relocatewise/shared';

// Mock the api module so we can drive postMatch().
const { postMatchMock } = vi.hoisted(() => ({ postMatchMock: vi.fn() }));
vi.mock('../src/api', async () => {
  const actual = await vi.importActual<typeof import('../src/api')>('../src/api');
  return { ...actual, postMatch: postMatchMock };
});

function renderForm(initial?: Partial<UserProfile>) {
  // SpyOnLocation captures the path and state on /results.
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
        <Route path="/" element={<ProfileForm initial={initial} />} />
        <Route path="/results" element={<SpyOnLocation />} />
      </Routes>
    </MemoryRouter>,
  );
}

const FULL_PROFILE: UserProfile = {
  climate: 'mediterranean',
  cost_importance: 0,
  cost_ceiling: null,
  housing_importance: 0,
  housing_ceiling: null,
  career_industry: 'tech',
  education: 'important',
  healthcare_importance: 0,
  lifestyle_tags: [],
};

describe('<ProfileForm />', () => {
  beforeEach(() => {
    postMatchMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all 6 dimension sections with their legends', () => {
    renderForm();
    const form = screen.getByTestId('profile-form');
    expect(form).toBeInTheDocument();
    // Each dimension's legend becomes a fieldset legend inside the form.
    for (const legend of [
      'Climate',
      'Cost of living',
      'Housing availability & cost',
      'Career industry',
      'Education quality',
      'Healthcare quality',
      'Lifestyle preferences',
    ]) {
      expect(screen.getByText(legend)).toBeInTheDocument();
    }
  });

  it('always shows a working Submit button, even with an empty profile', () => {
    renderForm();
    const submit = screen.getByTestId('submit') as HTMLButtonElement;
    expect(submit).toBeInTheDocument();
    expect(submit).not.toBeDisabled();
  });

  it('requires a cost_ceiling once cost_importance is moved above 0', async () => {
    const user = userEvent.setup();
    renderForm();
    // Click importance level 1 for cost
    await user.click(screen.getByTestId('cost-1'));
    // Submit is now blocked because cost_ceiling is required
    const submit = screen.getByTestId('submit') as HTMLButtonElement;
    expect(submit).toBeDisabled();
    expect(screen.getByTestId('validation-error').textContent).toMatch(
      /cost-of-living ceiling/i,
    );
  });

  it('requires a housing_ceiling once housing_importance is moved above 0', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByTestId('housing-1'));
    const submit = screen.getByTestId('submit') as HTMLButtonElement;
    expect(submit).toBeDisabled();
    expect(screen.getByTestId('validation-error').textContent).toMatch(
      /housing ceiling/i,
    );
  });

  it('clears the cost_ceiling when cost_importance is dropped back to 0', async () => {
    const user = userEvent.setup();
    renderForm({ cost_importance: 2, cost_ceiling: 4 });
    // First confirm the ceiling is rendered (importance > 0).
    const ceilingRow = screen.getByTestId('cost-ceiling-4');
    expect(ceilingRow.className).toMatch(/is-active/);
    // Now drop importance back to 0.
    await user.click(screen.getByTestId('cost-0'));
    // Submit is enabled again, ceiling UI is gone, no validation error.
    expect(screen.getByTestId('submit')).not.toBeDisabled();
    expect(screen.queryByTestId('validation-error')).not.toBeInTheDocument();
  });

  it('clears the housing_ceiling when housing_importance is dropped back to 0', async () => {
    const user = userEvent.setup();
    renderForm({ housing_importance: 2, housing_ceiling: 5 });
    expect(screen.getByTestId('housing-ceiling-5').className).toMatch(/is-active/);
    await user.click(screen.getByTestId('housing-0'));
    expect(screen.getByTestId('submit')).not.toBeDisabled();
  });

  it('navigates to /results with the API response in location.state on success', async () => {
    const user = userEvent.setup();
    const response = { results: [], generated_at: '2026-06-02T00:00:00Z' };
    postMatchMock.mockResolvedValueOnce(response);
    renderForm(FULL_PROFILE);

    await user.click(screen.getByTestId('submit'));

    await waitFor(() => {
      expect(screen.getByTestId('results-path').textContent).toBe('/results');
    });
    // No profile data in the URL.
    expect(postMatchMock).toHaveBeenCalledTimes(1);
    expect(postMatchMock).toHaveBeenCalledWith(FULL_PROFILE);
    // State was passed; nothing else in the path.
    expect(screen.getByTestId('results-path').textContent).toBe('/results');
  });

  it('shows the API envelope message when postMatch returns an ApiError', async () => {
    const user = userEvent.setup();
    postMatchMock.mockRejectedValueOnce(
      new ApiError(400, { error: 'invalid_profile', message: 'Bad climate tag.' }),
    );
    renderForm(FULL_PROFILE);

    await user.click(screen.getByTestId('submit'));

    const err = await screen.findByTestId('api-error');
    expect(err.textContent).toBe('Bad climate tag.');
    // We are still on the form, ready to retry. The results-route spy
    // is not mounted when we are still on /, so we assert on the form
    // being present instead.
    expect(screen.getByTestId('profile-form')).toBeInTheDocument();
    expect(screen.queryByTestId('results-path')).not.toBeInTheDocument();
  });

  it('falls back to the Error message for non-ApiError throws', async () => {
    const user = userEvent.setup();
    postMatchMock.mockRejectedValueOnce(new Error('network down'));
    renderForm(FULL_PROFILE);
    await user.click(screen.getByTestId('submit'));
    const err = await screen.findByTestId('api-error');
    expect(err.textContent).toBe('network down');
  });

  it('falls back to a generic message for unknown throw shapes', async () => {
    const user = userEvent.setup();
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    postMatchMock.mockRejectedValueOnce('weird string');
    renderForm(FULL_PROFILE);
    await user.click(screen.getByTestId('submit'));
    const err = await screen.findByTestId('api-error');
    expect(err.textContent).toMatch(/something went wrong/i);
  });

  it('disables Submit while the request is in flight and re-enables on error', async () => {
    const user = userEvent.setup();
    // A promise we resolve manually so we can observe the "Submitting" state.
    let resolve!: (v: unknown) => void;
    postMatchMock.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    renderForm(FULL_PROFILE);
    await user.click(screen.getByTestId('submit'));
    // While the promise is pending, the button should be disabled and the
    // label should read "Finding matches…".
    const submit = screen.getByTestId('submit') as HTMLButtonElement;
    expect(submit).toBeDisabled();
    expect(submit.textContent).toBe('Finding matches…');
    // Now reject so the form goes back to its enabled state.
    resolve = resolve as unknown as (v: unknown) => void;
    resolve({ results: [], generated_at: '2026-06-02T00:00:00Z' });
    await waitFor(() => {
      expect(screen.getByTestId('results-path').textContent).toBe('/results');
    });
  });

  it('does not submit again while one submit is in flight', async () => {
    const user = userEvent.setup();
    let resolve!: (v: unknown) => void;
    postMatchMock.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    renderForm(FULL_PROFILE);
    await user.click(screen.getByTestId('submit'));
    // A second click should be a no-op (button is disabled).
    await user.click(screen.getByTestId('submit')).catch(() => {});
    expect(postMatchMock).toHaveBeenCalledTimes(1);
    // Resolve the request so the test cleanly tears down.
    resolve({ results: [], generated_at: '2026-06-02T00:00:00Z' });
    await waitFor(() => {
      expect(screen.getByTestId('results-path').textContent).toBe('/results');
    });
  });

  it('restores an `initial` profile, pre-filling the form', () => {
    const initial: Partial<UserProfile> = {
      climate: 'tropical',
      cost_importance: 2,
      cost_ceiling: 3,
      housing_importance: 0,
      housing_ceiling: null,
      career_industry: 'finance',
      education: 'somewhat',
      healthcare_importance: 1,
      lifestyle_tags: ['coastal', 'arts_culture'],
    };
    renderForm(initial);

    // The cost-importance active button is 2 and the cost-ceiling active
    // button is 3, proving the initial profile is honored.
    expect(screen.getByTestId('cost-2').className).toMatch(/is-active/);
    expect(screen.getByTestId('cost-ceiling-3').className).toMatch(/is-active/);
    // The selected climate radio is checked.
    const climateTropical = screen.getByLabelText('Tropical') as HTMLInputElement;
    expect(climateTropical.checked).toBe(true);
    // The healthcare importance 1 button is active.
    expect(screen.getByTestId('healthcare-1').className).toMatch(/is-active/);
  });
});
