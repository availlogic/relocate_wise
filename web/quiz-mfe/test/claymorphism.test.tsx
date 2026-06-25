/**
 * Claymorphism tests for the Quiz MFE (PRD v3.4.0 FR-22…FR-27,
 * Acceptance-Criteria v1.3.0 AC-21…AC-24, Visual-Guidelines v1.4.0 §4,
 * FTC-3b).
 *
 * Asserts (via parsing the CSS source files directly, since jsdom does
 * not resolve imported CSS custom properties):
 *   - The token file declares the lilac canvas, off-white card,
 *     lavender accent, multi-layered clay outer shadow, and pressed
 *     inverted inner-shadow.
 *   - The pill radius token is 9999px.
 *   - The ProfileForm CSS uses 24-32px radii, multi-layered shadows,
 *     the lavender pastel for the `is-active` state, and the pressed
 *     inverted inner-shadow on selected option cards.
 *   - The ProgressBar CSS uses a 12px clay groove with the lavender
 *     pastel sliding pill (FR-27).
 *   - The wizard buttons use the pill (9999px) shape with the
 *     multi-layered button shadow.
 *   - The tokens.css file includes a `prefers-reduced-motion` guard.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { ProfileForm } from '../src/components/ProfileForm';
import { RadioGroup } from '../src/components/RadioGroup';
import './setup';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../');
const TOKENS_PATH = resolve(REPO_ROOT, 'web/container/src/styles/tokens.css');
const GLOBAL_PATH = resolve(REPO_ROOT, 'web/container/src/styles/global.css');
const PROFILEFORM_CSS_PATH = resolve(
  REPO_ROOT,
  'web/quiz-mfe/src/components/ProfileForm.css',
);
const PROGRESSBAR_CSS_PATH = resolve(
  REPO_ROOT,
  'web/quiz-mfe/src/components/ProgressBar.css',
);

let tokensCss = '';
let globalCss = '';
let profileFormCss = '';
let progressBarCss = '';

beforeAll(async () => {
  tokensCss = await readFile(TOKENS_PATH, 'utf8');
  globalCss = await readFile(GLOBAL_PATH, 'utf8');
  profileFormCss = await readFile(PROFILEFORM_CSS_PATH, 'utf8');
  progressBarCss = await readFile(PROGRESSBAR_CSS_PATH, 'utf8');
});

function expectToken(css: string, name: string, pattern: RegExp) {
  // Capture `--name: ...;` even when the value spans multiple lines.
  const re = new RegExp(`--${name}\\s*:\\s*([^;]+);`);
  const m = css.match(re);
  expect(m, `Token ${name} not found in CSS source`).toBeTruthy();
  if (m) {
    expect(m[1]!.trim()).toMatch(pattern);
  }
}

describe('Phase F — Claymorphism tokens (Visual-Guidelines §2)', () => {
  it('declares the lilac canvas token (#E2DBF8 → hsl(252, 63%, 92%))', () => {
    expectToken(tokensCss, 'color-bg-canvas', /252.*63.*92/);
  });

  it('declares the warm off-white card token (#FFF9F9 → hsl(0, 100%, 98.5%))', () => {
    expectToken(tokensCss, 'color-bg-card', /0.*100.*98/);
  });

  it('declares the lavender accent token (#C5BEF7 → hsl(247, 72%, 86%))', () => {
    expectToken(tokensCss, 'color-accent-lavender', /247.*72.*86/);
  });

  it('declares the mint/sage accent token (hsl(158, 52%, 78%))', () => {
    expectToken(tokensCss, 'color-accent-green', /158.*52.*78/);
  });

  it('declares the peach accent token (hsl(12, 100%, 82%))', () => {
    expectToken(tokensCss, 'color-accent-peach', /12.*100.*82/);
  });

  it('declares the butter-yellow accent token (hsl(42, 100%, 82%))', () => {
    expectToken(tokensCss, 'color-accent-yellow', /42.*100.*82/);
  });

  it('declares the multi-layered clay outer shadow', () => {
    expectToken(
      tokensCss,
      'shadow-clay-outer',
      /rgba\(135,\s*120,\s*200,\s*0\.22\)/,
    );
  });

  it('declares the pressed (inverted inner) shadow', () => {
    expect(
      tokensCss,
      'pressed shadow must use inset + the lavender alpha',
    ).toMatch(/--shadow-pressed:[^;]*inset[^;]*rgba\(135,\s*120,\s*200,\s*0\.2\)/);
  });

  it('declares a pill radius token of 9999px', () => {
    expectToken(tokensCss, 'radius-pill', /^9999px$/);
  });

  it('declares card radii of 24px and 32px (FR-23)', () => {
    expectToken(tokensCss, 'radius-lg', /^24px$/);
    expectToken(tokensCss, 'radius-xl', /^32px$/);
  });

  it('uses Quicksand for headings and Nunito for body (Visual-Guidelines §2)', () => {
    expect(tokensCss).toMatch(/--font-headings:[^;]*Quicksand/);
    expect(tokensCss).toMatch(/--font-body:[^;]*Nunito/);
  });

  it('declares a bouncy cubic-bezier easing token', () => {
    expect(tokensCss).toMatch(
      /--transition-bounce:[^;]*cubic-bezier\(0\.175,\s*0\.885,\s*0\.32,\s*1\.275\)/,
    );
  });

  it('includes a prefers-reduced-motion guard (WCAG 2.1)', () => {
    expect(tokensCss).toContain('prefers-reduced-motion');
    expect(tokensCss).toContain('transition-duration: 0.001ms');
  });
});

describe('Phase F — Claymorphism .btn (Visual-Guidelines §4.2)', () => {
  it('the pill button uses 9999px border-radius', () => {
    // Find the .btn block in global.css
    const block = globalCss.match(/\.btn\s*\{[\s\S]*?\}/);
    expect(block).toBeTruthy();
    if (block) {
      expect(block[0]).toMatch(/border-radius:\s*var\(--radius-pill\)/);
    }
  });

  it('the pill button uses a multi-layered shadow', () => {
    const block = globalCss.match(/\.btn\s*\{[\s\S]*?\}/);
    expect(block).toBeTruthy();
    if (block) {
      expect(block[0]).toMatch(/box-shadow:\s*var\(--shadow-button\)/);
    }
  });

  it('the primary button uses the lavender pastel', () => {
    expect(globalCss).toMatch(/\.btn--primary\s*\{[^}]*background:\s*var\(--color-accent-lavender\)/);
  });

  it('the active button state inverts the shadow to a pressed clay block', () => {
    const active = globalCss.match(/\.btn--primary:active[^{]*\{[^}]*\}/);
    expect(active).toBeTruthy();
    if (active) {
      expect(active[0]).toMatch(/box-shadow:\s*var\(--shadow-button-pressed\)/);
    }
  });
});

describe('Phase F — Claymorphism wizard (FTC-3b)', () => {
  function renderWizard() {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <ProfileForm />
      </MemoryRouter>,
    );
  }

  it('option cards render with the lavender pastel pressed class when selected', async () => {
    const user = userEvent.setup();
    renderWizard();
    const card = screen.getByTestId('climate-mediterranean').closest('label')!;
    expect(card.className).not.toMatch(/is-active/);
    await user.click(card);
    expect(card.className).toMatch(/is-active/);
  });

  it('ProfileForm.css defines 24-32px radii on option cards', () => {
    expect(profileFormCss).toMatch(/\.radio-option\s*\{[\s\S]*?border-radius:\s*var\(--radius-xl\)/);
    expect(profileFormCss).toMatch(/\.profile-form__level\s*\{[\s\S]*?border-radius:\s*var\(--radius-xl\)/);
  });

  it('ProfileForm.css uses the lavender pastel + pressed inverted-shadow on selected cards', () => {
    const active = profileFormCss.match(/\.radio-option\.is-active\s*\{[\s\S]*?\}/);
    expect(active).toBeTruthy();
    if (active) {
      expect(active[0]).toMatch(/background:\s*var\(--color-accent-lavender\)/);
      expect(active[0]).toMatch(/box-shadow:\s*var\(--shadow-pressed\)/);
    }
  });

  it('ProgressBar.css uses a 12px clay groove with a lavender sliding pill (FR-27)', () => {
    expect(progressBarCss).toMatch(/\.progress-bar\s*\{[^}]*height:\s*12px/);
    expect(progressBarCss).toMatch(/\.progress-bar__fill\s*\{[^}]*background:\s*var\(--color-accent-lavender\)/);
    expect(progressBarCss).toMatch(/\.progress-bar__fill\s*\{[^}]*border-radius:\s*var\(--radius-pill\)/);
    expect(progressBarCss).toMatch(/\.progress-bar\s*\{[^}]*box-shadow:\s*var\(--shadow-clay-track\)/);
  });

  it('wizard buttons have a 9999px pill radius in the source CSS', () => {
    expect(globalCss).toMatch(/\.btn\s*\{[^}]*border-radius:\s*var\(--radius-pill\)/);
  });

  it('the per-step surface is a 24-32px-radius clay card with a multi-layered shadow', () => {
    expect(profileFormCss).toMatch(
      /\.profile-form__step\s*\{[^}]*border-radius:\s*var\(--radius-xl\)/,
    );
    expect(profileFormCss).toMatch(
      /\.profile-form__step\s*\{[^}]*box-shadow:\s*var\(--shadow-clay-outer\),\s*var\(--shadow-clay-inner-light\),\s*var\(--shadow-clay-inner-dark\)/,
    );
  });
});

describe('Phase F — Claymorphism tag picker pill chips', () => {
  it('renders standalone RadioGroup without errors', () => {
    function Harness() {
      return (
        <RadioGroup<string>
          name="demo"
          legend="Demo"
          options={[
            { value: 'a', label: 'Alpha' },
            { value: 'b', label: 'Beta' },
          ]}
          value={null}
          onChange={() => undefined}
        />
      );
    }
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('demo-a')).toBeInTheDocument();
  });

  it('tag-chip uses 9999px pill radius', () => {
    expect(profileFormCss).toMatch(/\.tag-chip\s*\{[^}]*border-radius:\s*var\(--radius-pill\)/);
  });
});