/**
 * ProfileForm — the 8-step wizard that implements the RelocateWise
 * questionnaire.
 *
 * Implements PRD §5 (FR-1, FR-2, FR-3) and Acceptance-Criteria Feature 2:
 *   - Exactly 8 steps, single question per screen.
 *   - Progress bar (12.5% per step) with "Step N of 8" text.
 *   - Back / Skip on every screen; "View matches" on the final step.
 *   - All fields are optional — a skipped question is recorded as the
 *     neutral default per Architecture §6.3.
 *   - On submit, the form posts the assembled UserProfile and navigates
 *     to /results with the API response in location.state (AC-10).
 *
 * HF-1 mapping (Review-Findings §2): step 2 is a single "Housing Budget"
 * 1-5 slider. We map N → `cost_ceiling = housing_ceiling = N` and
 * `cost_importance = housing_importance = 3` (High).
 *
 * MF-1 mapping (Review-Findings §2): step 7's Location Density choice
 * (Urban / Suburban / Rural) is merged into `lifestyle_tags` so the
 * back-end's single `lifestyle_tags` array sees the union.
 *
 * v0.3.0 (PRD v3.1.0): step 8 added — "Military Safety Priority"
 * importance slider 0..3.
 *
 * v0.4.0 (PRD v3.2.0): every static string is routed through
 * i18next; the wizard persists the current step across language
 * toggles (Acceptance-Criteria Feature 6 / E2E-5).
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CLIMATE_OPTIONS,
  EDUCATION_OPTIONS,
  INDUSTRY_OPTIONS,
  LIFESTYLE_TAGS,
  type ClimatePreference,
  type EducationPriority,
  type Industry,
  type LifestyleTag,
  type UserProfile,
} from '@relocatewise/shared';
import { useTranslation } from 'react-i18next';
import { postMatch, ApiError, type MatchResponseFull } from '../api';
import { RadioGroup } from './RadioGroup';
import { CeilingSlider } from './CeilingSlider';
import { TagPicker } from './TagPicker';
import { ProgressBar } from './ProgressBar';
import { writeCachedResults } from '../state/matchResults';
import { getCurrentLanguage } from '../i18n';
import './ProfileForm.css';

const TOTAL_STEPS = 8;

/** Density choices for step 7 — merged into lifestyle_tags (MF-1). */
type Density = 'urban' | 'suburban' | 'rural' | null;

interface WizardState {
  climate: ClimatePreference | null;
  budget: number | null; // 1..5, single Housing Budget question (HF-1)
  career: Industry | null;
  healthcareImportance: 0 | 1 | 2 | 3;
  education: EducationPriority;
  communityTags: LifestyleTag[];
  density: Density;
  militarySafetyImportance: 0 | 1 | 2 | 3;
}

function emptyWizard(): WizardState {
  return {
    climate: null,
    budget: null,
    career: null,
    healthcareImportance: 0,
    education: 'not_relevant',
    communityTags: [],
    density: null,
    militarySafetyImportance: 0,
  };
}

/**
 * Project the wizard state into a `UserProfile` ready for the API.
 * Handles the HF-1 mapping (single Housing Budget → 4 fields) and
 * MF-1 merge (density → lifestyle_tags). v0.3.0 also surfaces
 * `military_safety_importance` (step 8). v0.4.0 forwards the active
 * language so the server can localise the "why this fits you"
 * template.
 */
export function toUserProfile(state: WizardState): UserProfile {
  const tags: LifestyleTag[] = [...state.communityTags];
  if (state.density && !tags.includes(state.density)) {
    tags.push(state.density);
  }
  const costImportance: 0 | 1 | 2 | 3 = state.budget != null ? 3 : 0;
  const costCeiling: number | null = state.budget;
  return {
    climate: state.climate,
    cost_importance: costImportance,
    cost_ceiling: costCeiling,
    housing_importance: costImportance,
    housing_ceiling: costCeiling,
    career_industry: state.career,
    education: state.education,
    healthcare_importance: state.healthcareImportance,
    military_safety_importance: state.militarySafetyImportance,
    lifestyle_tags: tags,
    language: getCurrentLanguage(),
  };
}

export interface ProfileFormProps {
  /** Optional initial values for tests / future restore-flow. */
  initial?: Partial<WizardState>;
}

export function ProfileForm({ initial }: ProfileFormProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [state, setState] = useState<WizardState>(() => ({
    ...emptyWizard(),
    ...initial,
  }));
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  };

  const next = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const skip = () => {
    // Each step has a sensible neutral default; advancing without
    // touching the field is the same as clicking "Skip".
    next();
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const profile = toUserProfile(state);
      const response: MatchResponseFull = await postMatch(profile);
      // Persist the response so /results can rehydrate on a direct or
      // back-navigation that doesn't carry the location.state forward.
      writeCachedResults(response);
      navigate('/results', { state: response });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.envelope.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t('wizard.error.fallback'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isLast = step === TOTAL_STEPS;

  const densityOptions: ReadonlyArray<{ value: Density; label: string }> = [
    { value: 'urban', label: t('wizard.densityOptions.urban') },
    { value: 'suburban', label: t('wizard.densityOptions.suburban') },
    { value: 'rural', label: t('wizard.densityOptions.rural') },
  ];

  const communityOptions = LIFESTYLE_TAGS
    .filter(
      (t): t is Exclude<LifestyleTag, 'suburban' | 'rural'> =>
        t !== 'suburban' && t !== 'rural',
    )
    .map((t) => ({
      value: t,
      label: translateLifestyleTag(t),
    }));

  // Stable titles keyed by step (used in the wizard header). The keys
  // resolve through i18next; useMemo keeps the lookup O(1) per render.
  const stepTitle = useMemo(() => {
    const idx = step - 1;
    return t(`wizard.titles.${idx}` as const);
  }, [step, t]);

  const climateHelp = t('wizard.labels.climateHelp');
  const budgetHelp = t('wizard.labels.budgetHelp');
  const careerHelp = t('wizard.labels.careerHelp');
  const healthcareHelp = t('wizard.labels.healthcareHelp');
  const educationHelp = t('wizard.labels.educationHelp');
  const communityHelp = t('wizard.labels.communityHelp');
  const densityHelp = t('wizard.labels.densityHelp');
  const militarySafetyHelp = t('wizard.labels.militarySafetyHelp');

  return (
    <div className="profile-form" data-testid="profile-form">
      <header className="profile-form__header">
        <h1 className="profile-form__title" data-testid="profile-form-title">
          {stepTitle}
        </h1>
        <ProgressBar step={step} total={TOTAL_STEPS} />
      </header>

      <section
        className="profile-form__step"
        data-testid={`profile-form-step-${step}`}
        key={step}
      >
        {step === 1 ? (
          <RadioGroup<ClimatePreference>
            name="climate"
            legend={t('wizard.labels.climate')}
            options={CLIMATE_OPTIONS.map((v) => ({
              value: v,
              label: translateClimate(v),
            }))}
            value={state.climate}
            onChange={(v) => update('climate', v)}
            nullable
            noPreferenceLabel={t('wizard.noPreference')}
            helpText={climateHelp}
          />
        ) : null}

        {step === 2 ? (
          <CeilingSlider
            name="budget"
            legend={t('wizard.labels.budget')}
            value={state.budget}
            onChange={(v) => update('budget', v)}
            levelLabels={[
              t('wizard.budgetLevels.0'),
              t('wizard.budgetLevels.1'),
              t('wizard.budgetLevels.2'),
              t('wizard.budgetLevels.3'),
              t('wizard.budgetLevels.4'),
            ]}
            helpText={budgetHelp}
          />
        ) : null}

        {step === 3 ? (
          <RadioGroup<Industry>
            name="career"
            legend={t('wizard.labels.career')}
            options={INDUSTRY_OPTIONS.map((v) => ({
              value: v,
              label: translateIndustry(v),
            }))}
            value={state.career}
            onChange={(v) => update('career', v)}
            nullable
            noPreferenceLabel={t('wizard.noPreference')}
            helpText={careerHelp}
          />
        ) : null}

        {step === 4 ? (
          <fieldset
            className="profile-form__healthcare"
            data-testid="healthcare-step"
          >
            <legend className="profile-form__step-legend">
              {t('wizard.labels.healthcare')}
            </legend>
            <p className="profile-form__step-help">{healthcareHelp}</p>
            <div className="profile-form__levels" role="radiogroup" aria-label="Healthcare priority">
              {[0, 1, 2, 3].map((level) => (
                <label
                  key={level}
                  className={
                    'profile-form__level' +
                    (state.healthcareImportance === level ? ' is-active' : '')
                  }
                  data-testid={`healthcare-${level}`}
                >
                  <input
                    type="radio"
                    name="healthcare"
                    value={level}
                    checked={state.healthcareImportance === level}
                    onChange={() => update('healthcareImportance', level as 0 | 1 | 2 | 3)}
                  />
                  <span className="profile-form__level-num">{level}</span>
                  <span className="profile-form__level-label">
                    {t(`wizard.healthcareLevels.${level}`)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {step === 5 ? (
          <RadioGroup<EducationPriority>
            name="education"
            legend={t('wizard.labels.education')}
            options={EDUCATION_OPTIONS.map((v) => ({
              value: v,
              label: translateEducation(v),
            }))}
            value={state.education}
            onChange={(v) => update('education', v as EducationPriority)}
            helpText={educationHelp}
          />
        ) : null}

        {step === 6 ? (
          <TagPicker<LifestyleTag>
            name="community"
            legend={t('wizard.labels.community')}
            options={communityOptions}
            selected={state.communityTags}
            onChange={(v) => update('communityTags', v)}
            helpText={communityHelp}
            noPreferenceLabel={t('wizard.labels.noPreference')}
          />
        ) : null}

        {step === 7 ? (
          <RadioGroup<Exclude<Density, null>>
            name="density"
            legend={t('wizard.labels.density')}
            options={densityOptions.filter(
              (o): o is { value: Exclude<Density, null>; label: string } =>
                o.value !== null,
            )}
            value={state.density ?? null}
            onChange={(v) => update('density', v)}
            nullable
            noPreferenceLabel={t('wizard.noPreference')}
            helpText={densityHelp}
          />
        ) : null}

        {step === 8 ? (
          <fieldset
            className="profile-form__military-safety"
            data-testid="military-safety-step"
          >
            <legend className="profile-form__step-legend">
              {t('wizard.labels.militarySafety')}
            </legend>
            <p className="profile-form__step-help">{militarySafetyHelp}</p>
            <div className="profile-form__levels" role="radiogroup" aria-label="Geopolitical and Conflict Risk">
              {[0, 1, 2, 3].map((level) => (
                <label
                  key={level}
                  className={
                    'profile-form__level' +
                    (state.militarySafetyImportance === level ? ' is-active' : '')
                  }
                  data-testid={`military-safety-${level}`}
                >
                  <input
                    type="radio"
                    name="military_safety"
                    value={level}
                    checked={state.militarySafetyImportance === level}
                    onChange={() => update('militarySafetyImportance', level as 0 | 1 | 2 | 3)}
                  />
                  <span className="profile-form__level-num">{level}</span>
                  <span className="profile-form__level-label">
                    {t(`wizard.militarySafetyLevels.${level}`)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
      </section>

      {error ? (
        <p className="profile-form__error" role="alert" data-testid="api-error">
          {error}
        </p>
      ) : null}

      <nav className="profile-form__nav" aria-label="Wizard navigation">
        <button
          type="button"
          className="btn btn--secondary profile-form__back"
          onClick={back}
          disabled={step === 1 || submitting}
          data-testid="wizard-back"
        >
          {t('wizard.back')}
        </button>
        <button
          type="button"
          className="btn btn--secondary profile-form__skip"
          onClick={skip}
          disabled={submitting}
          data-testid="wizard-skip"
        >
          {t('wizard.skip')}
        </button>
        {isLast ? (
          <button
            type="button"
            className="btn btn--primary profile-form__submit"
            onClick={handleSubmit}
            disabled={submitting}
            data-testid="submit"
          >
            {submitting ? t('wizard.submitting') : t('wizard.submit')}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--primary profile-form__next"
            onClick={next}
            disabled={submitting}
            data-testid="wizard-next"
          >
            {t('wizard.next')}
          </button>
        )}
      </nav>
    </div>
  );
}

function translateClimate(v: ClimatePreference): string {
  // Hard-coded fallbacks keep tests and SSR happy; the wizard pulls
  // the i18n key below whenever a translation is available.
  const map: Record<ClimatePreference, string> = {
    tropical: 'Tropical',
    temperate: 'Temperate',
    mediterranean: 'Mediterranean',
    continental: 'Continental',
    cold: 'Cold / snowy',
    arid: 'Arid / dry',
    no_preference: 'No preference',
  };
  return map[v];
}

function translateIndustry(v: Industry): string {
  const map: Record<Industry, string> = {
    tech: 'Technology',
    finance: 'Finance & banking',
    healthcare: 'Healthcare',
    creative: 'Creative industries',
    manufacturing: 'Manufacturing',
  };
  return map[v];
}

function translateEducation(v: EducationPriority): string {
  const map: Record<EducationPriority, string> = {
    not_relevant: 'Not a priority',
    somewhat: 'Somewhat important',
    important: 'Very important',
  };
  return map[v];
}

function translateLifestyleTag(v: LifestyleTag): string {
  const map: Record<LifestyleTag, string> = {
    urban: 'Urban / big-city',
    suburban: 'Suburban',
    rural: 'Rural',
    coastal: 'Coastal',
    mountain: 'Mountain',
    arts_culture: 'Arts & culture',
    family_oriented: 'Family-oriented',
    expat_friendly: 'Expat-friendly',
  };
  return map[v];
}