/**
 * Tests for ProfileForm — the 8-step wizard described in PRD §5 (v3.1.0),
 * FR-1..FR-3, and Acceptance-Criteria Feature 2.
 *
 * Coverage targets the documented contract:
 *   - Exactly 8 steps are rendered sequentially; one question per step.
 *   - A progress bar fills incrementally and labels "Step N of 8".
 *   - Back returns to the previous step; Skip advances without selection.
 *   - The final step shows "View matches" (Submit).
 *   - On submit, the form posts the assembled UserProfile and navigates
 *     to /results with the API response in location.state (AC-10).
 *   - On API failure the envelope message is rendered and the user can
 *     retry without leaving the form.
 *   - Step 2 ("Housing Budget") implements HF-1: a single 1-5 value
 *     maps to cost_ceiling=housing_ceiling=N, both importances=3.
 *   - Step 7 ("Density") implements MF-1: the choice merges into
 *     lifestyle_tags.
 *   - Step 8 ("Military Safety") emits military_safety_importance.
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

/** Click Next `n` times to reach a specific step. */
async function advanceToStep(user: ReturnType<typeof userEvent.setup>, step: number) {
  for (let i = 1; i < step; i++) {
    await user.click(screen.getByTestId('wizard-next'));
  }
}

describe('<ProfileForm /> (8-step wizard)', () => {
  beforeEach(() => {
    postMatchMock.mockReset();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the wizard shell on step 1 with a working progress bar', () => {
    renderForm();
    expect(screen.getByTestId('profile-form')).toBeInTheDocument();
    const bar = screen.getByTestId('progress-bar');
    expect(bar).toHaveAttribute('aria-valuenow', '1');
    expect(bar).toHaveAttribute('aria-valuemax', '8');
    expect(screen.getByTestId('progress-bar-label').textContent).toMatch(/Step 1 of 8/);
  });

  it('renders the Back button disabled on step 1 and enabled after advancing', async () => {
    const user = userEvent.setup();
    renderForm();
    const back = screen.getByTestId('wizard-back');
    expect(back).toBeDisabled();
    await user.click(screen.getByTestId('wizard-next'));
    expect(back).not.toBeDisabled();
    expect(screen.getByTestId('progress-bar')).toHaveAttribute('aria-valuenow', '2');
  });

  it('shows Skip on every step and advances without selecting', async () => {
    const user = userEvent.setup();
    renderForm();
    expect(screen.getByTestId('wizard-skip')).toBeInTheDocument();
    for (let i = 1; i <= 8; i++) {
      await user.click(screen.getByTestId('wizard-skip'));
      expect(screen.getByTestId('progress-bar')).toHaveAttribute(
        'aria-valuenow',
        String(Math.min(i + 1, 8)),
      );
    }
  });

  it('shows the climate radio on step 1 and the density radio on step 7', async () => {
    const user = userEvent.setup();
    renderForm();
    expect(screen.getByTestId('radio-group-climate')).toBeInTheDocument();
    await advanceToStep(user, 7);
    expect(screen.getByTestId('radio-group-density')).toBeInTheDocument();
    expect(screen.getByTestId('density-urban')).toBeInTheDocument();
    expect(screen.getByTestId('density-suburban')).toBeInTheDocument();
    expect(screen.getByTestId('density-rural')).toBeInTheDocument();
  });

  it('shows the military-safety slider on step 8', async () => {
    const user = userEvent.setup();
    renderForm();
    await advanceToStep(user, 8);
    expect(screen.getByTestId('military-safety-step')).toBeInTheDocument();
    expect(screen.getByTestId('military-safety-0')).toBeInTheDocument();
    expect(screen.getByTestId('military-safety-3')).toBeInTheDocument();
  });

  it('does not leak development doc references in the military-safety help text (v0.4.x)', async () => {
    const user = userEvent.setup();
    renderForm();
    await advanceToStep(user, 8);
    const step = screen.getByTestId('military-safety-step');
    // The help paragraph must not contain internal PRD-section references
    // (per bug 1: scrub `(PRD §6.1 D8)` from the user-facing copy).
    expect(step.textContent).not.toMatch(/PRD\s*§/);
  });

  it('renders "View matches" only on step 8', async () => {
    const user = userEvent.setup();
    renderForm();
    expect(screen.queryByTestId('submit')).not.toBeInTheDocument();
    await advanceToStep(user, 8);
    const submit = screen.getByTestId('submit');
    expect(submit).toBeInTheDocument();
    expect(submit.textContent).toMatch(/view matches/i);
  });

  it('HF-1: a single Housing Budget value maps to cost + housing fields', async () => {
    const user = userEvent.setup();
    let captured: UserProfile | undefined;
    postMatchMock.mockImplementation((p: UserProfile) => {
      captured = p;
      return Promise.resolve({ results: [], generated_at: '2026-06-02T00:00:00Z' });
    });
    renderForm();

    // Step 1: pick a climate.
    await user.click(screen.getByTestId('climate-mediterranean'));
    await user.click(screen.getByTestId('wizard-next'));

    // Step 2: pick budget = 3.
    await user.click(screen.getByTestId('budget-3'));

    // Skip through the rest (steps 3..8).
    for (let i = 0; i < 6; i++) {
      await user.click(screen.getByTestId('wizard-skip'));
    }
    await user.click(screen.getByTestId('submit'));

    await waitFor(() => {
      expect(screen.getByTestId('results-path').textContent).toBe('/results');
    });
    expect(captured).toBeDefined();
    expect(captured!.cost_ceiling).toBe(3);
    expect(captured!.housing_ceiling).toBe(3);
    expect(captured!.cost_importance).toBe(3);
    expect(captured!.housing_importance).toBe(3);
  });

  it('MF-1: step 7 density merges into lifestyle_tags', async () => {
    const user = userEvent.setup();
    let captured: UserProfile | undefined;
    postMatchMock.mockImplementation((p: UserProfile) => {
      captured = p;
      return Promise.resolve({ results: [], generated_at: '2026-06-02T00:00:00Z' });
    });
    renderForm();

    // Skip to step 7.
    for (let i = 0; i < 6; i++) {
      await user.click(screen.getByTestId('wizard-skip'));
    }
    await user.click(screen.getByTestId('density-rural'));
    // Advance to step 8 (submit).
    await user.click(screen.getByTestId('wizard-next'));
    await user.click(screen.getByTestId('submit'));

    await waitFor(() => {
      expect(screen.getByTestId('results-path').textContent).toBe('/results');
    });
    expect(captured).toBeDefined();
    expect(captured!.lifestyle_tags).toContain('rural');
  });

  it('step 8 military_safety_importance 3 is captured in the payload', async () => {
    const user = userEvent.setup();
    let captured: UserProfile | undefined;
    postMatchMock.mockImplementation((p: UserProfile) => {
      captured = p;
      return Promise.resolve({ results: [], generated_at: '2026-06-02T00:00:00Z' });
    });
    renderForm();

    await advanceToStep(user, 8);
    await user.click(screen.getByTestId('military-safety-3'));
    await user.click(screen.getByTestId('submit'));

    await waitFor(() => {
      expect(screen.getByTestId('results-path').textContent).toBe('/results');
    });
    expect(captured).toBeDefined();
    expect(captured!.military_safety_importance).toBe(3);
  });

  it('skipped step 8 records military_safety_importance = 0 (default)', async () => {
    const user = userEvent.setup();
    let captured: UserProfile | undefined;
    postMatchMock.mockImplementation((p: UserProfile) => {
      captured = p;
      return Promise.resolve({ results: [], generated_at: '2026-06-02T00:00:00Z' });
    });
    renderForm();

    // Skip directly to step 8.
    for (let i = 0; i < 7; i++) {
      await user.click(screen.getByTestId('wizard-skip'));
    }
    await user.click(screen.getByTestId('submit'));

    await waitFor(() => {
      expect(screen.getByTestId('results-path').textContent).toBe('/results');
    });
    expect(captured).toBeDefined();
    expect(captured!.military_safety_importance).toBe(0);
  });

  it('disables submit and shows "Finding matches…" while the request is in flight', async () => {
    const user = userEvent.setup();
    let resolve!: (v: unknown) => void;
    postMatchMock.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    renderForm();

    await advanceToStep(user, 8);
    await user.click(screen.getByTestId('submit'));
    const submit = screen.getByTestId('submit') as HTMLButtonElement;
    expect(submit).toBeDisabled();
    expect(submit.textContent).toMatch(/finding matches/i);

    resolve({ results: [], generated_at: '2026-06-02T00:00:00Z' });
    await waitFor(() => {
      expect(screen.getByTestId('results-path').textContent).toBe('/results');
    });
  });

  it('does not submit again while one submit is in flight', async () => {
    const user = userEvent.setup();
    let resolve!: (v: unknown) => void;
    postMatchMock.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    renderForm();
    await advanceToStep(user, 8);
    await user.click(screen.getByTestId('submit'));
    await user.click(screen.getByTestId('submit')).catch(() => {});
    expect(postMatchMock).toHaveBeenCalledTimes(1);
    resolve({ results: [], generated_at: '2026-06-02T00:00:00Z' });
    await waitFor(() => {
      expect(screen.getByTestId('results-path').textContent).toBe('/results');
    });
  });

  it('shows the API envelope message on postMatch ApiError and stays on the form', async () => {
    const user = userEvent.setup();
    postMatchMock.mockRejectedValueOnce(
      new ApiError(400, { error: 'invalid_profile', message: 'Bad climate tag.' }),
    );
    renderForm();
    await advanceToStep(user, 8);
    await user.click(screen.getByTestId('submit'));
    const err = await screen.findByTestId('api-error');
    expect(err.textContent).toBe('Bad climate tag.');
    expect(screen.getByTestId('profile-form')).toBeInTheDocument();
  });

  it('falls back to the Error message for non-ApiError throws', async () => {
    const user = userEvent.setup();
    postMatchMock.mockRejectedValueOnce(new Error('network down'));
    renderForm();
    await advanceToStep(user, 8);
    await user.click(screen.getByTestId('submit'));
    const err = await screen.findByTestId('api-error');
    expect(err.textContent).toBe('network down');
  });

  it('falls back to a generic message for unknown throw shapes', async () => {
    const user = userEvent.setup();
    postMatchMock.mockRejectedValueOnce('weird string');
    renderForm();
    await advanceToStep(user, 8);
    await user.click(screen.getByTestId('submit'));
    const err = await screen.findByTestId('api-error');
    expect(err.textContent).toMatch(/something went wrong/i);
  });
});

/**
 * Bug 5 / FTC-5b: "No Preference" option on Step 6 (Community & Lifestyle
 * Fit). The chip is the first entry in the option list, has the same
 * `.tag-chip` style as the other tags, is selected by default, and is
 * mutually exclusive with the other tags (clicking a tag clears "No
 * Preference"; clicking "No Preference" clears any other tags).
 *
 * Submission with "No Preference" active sends `lifestyle_tags: []`
 * (the matching engine already treats `[]` as "no preference" so no
 * backend change is needed).
 */
describe('FTC-5b: "No Preference" in Community & Lifestyle Fit', () => {
  async function advanceToStep6(user: ReturnType<typeof userEvent.setup>) {
    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByTestId('wizard-next'));
    }
  }

  it('renders the No Preference chip on step 6 alongside the lifestyle tags', async () => {
    const user = userEvent.setup();
    renderForm();
    await advanceToStep6(user);
    // Per decision 5b: "No Preference" is selected by default.
    const noPref = screen.getByTestId('community-no-preference');
    expect(noPref).toBeInTheDocument();
    expect(noPref.getAttribute('aria-pressed')).toBe('true');
    // Other tag chips are present and NOT active.
    expect(screen.getByTestId('community-urban').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('community-coastal').getAttribute('aria-pressed')).toBe('false');
  });

  it('clicking a tag while No Preference is active deselects No Preference', async () => {
    const user = userEvent.setup();
    renderForm();
    await advanceToStep6(user);
    // No Preference is on by default.
    expect(screen.getByTestId('community-no-preference').getAttribute('aria-pressed')).toBe('true');
    // Click an actual tag.
    await user.click(screen.getByTestId('community-urban'));
    // No Preference deactivates; the tag activates.
    expect(screen.getByTestId('community-no-preference').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('community-urban').getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking No Preference clears any previously selected tag', async () => {
    const user = userEvent.setup();
    renderForm();
    await advanceToStep6(user);
    // Click an actual tag (this will also deselect "No Preference").
    await user.click(screen.getByTestId('community-urban'));
    await user.click(screen.getByTestId('community-coastal'));
    expect(screen.getByTestId('community-urban').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('community-coastal').getAttribute('aria-pressed')).toBe('true');
    // Now click "No Preference" — both tags should clear.
    await user.click(screen.getByTestId('community-no-preference'));
    expect(screen.getByTestId('community-urban').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('community-coastal').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('community-no-preference').getAttribute('aria-pressed')).toBe('true');
  });

  it('submitting with No Preference active sends lifestyle_tags: []', async () => {
    const user = userEvent.setup();
    let captured: UserProfile | undefined;
    postMatchMock.mockImplementation((p: UserProfile) => {
      captured = p;
      return Promise.resolve({ results: [], generated_at: '2026-06-02T00:00:00Z' });
    });
    renderForm();
    // No Preference is selected by default on step 6; no further
    // action needed. Advance to step 8 and submit.
    await advanceToStep6(user);
    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByTestId('wizard-next'));
    }
    await user.click(screen.getByTestId('submit'));
    await waitFor(() => {
      expect(screen.getByTestId('results-path').textContent).toBe('/results');
    });
    expect(captured).toBeDefined();
    expect(captured!.lifestyle_tags).toEqual([]);
  });
});
