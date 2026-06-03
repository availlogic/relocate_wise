/**
 * ProfileForm — the 6-dimension preference form described in PRD §5 (FR-2
 * and FR-3). All fields are optional except none — every dimension has a
 * neutral default that means "skip / no preference". The Submit button is
 * always enabled; the matching engine handles a fully-empty profile.
 *
 * Validation:
 *  - When cost_importance > 0, cost_ceiling is required (1..5).
 *  - When housing_importance > 0, housing_ceiling is required (1..5).
 *
 * On successful submit the form calls `postMatch(profile)` and navigates
 * to /results, passing the response via React Router location state so
 * the URL stays clean (AC-10 — no PII in URLs).
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CLIMATE_OPTIONS,
  INDUSTRY_OPTIONS,
  EDUCATION_OPTIONS,
  LIFESTYLE_TAGS,
  type UserProfile,
  type Importance,
  type ClimatePreference,
  type Industry,
  type EducationPriority,
  type LifestyleTag,
} from '@relocatewise/shared';
import { postMatch, ApiError, type MatchResponseFull } from '../api';
import { RadioGroup } from './RadioGroup';
import { ImportanceSlider } from './ImportanceSlider';
import { CeilingSlider } from './CeilingSlider';
import { TagPicker } from './TagPicker';
import {
  CLIMATE_LABELS,
  INDUSTRY_LABELS,
  EDUCATION_LABELS,
  LIFESTYLE_LABELS,
} from '../formOptions';
import './ProfileForm.css';

/** Initial empty profile, used on mount. */
function emptyProfile(): UserProfile {
  return {
    climate: null,
    cost_importance: 0,
    cost_ceiling: null,
    housing_importance: 0,
    housing_ceiling: null,
    career_industry: null,
    education: 'not_relevant',
    healthcare_importance: 0,
    lifestyle_tags: [],
  };
}

export interface ProfileFormProps {
  /** Optional initial values, used for tests and a "restore last draft" flow. */
  initial?: Partial<UserProfile>;
}

export function ProfileForm({ initial }: ProfileFormProps) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile>(() => ({
    ...emptyProfile(),
    ...initial,
  }));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Derived validation
  const validationError = useMemo(() => {
    if (profile.cost_importance > 0 && profile.cost_ceiling === null) {
      return 'Pick a cost-of-living ceiling — importance is set above 0.';
    }
    if (profile.housing_importance > 0 && profile.housing_ceiling === null) {
      return 'Pick a housing ceiling — importance is set above 0.';
    }
    return null;
  }, [profile.cost_importance, profile.cost_ceiling, profile.housing_importance, profile.housing_ceiling]);

  const update = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setProfile((p) => ({ ...p, [key]: value }));
  };

  // When the user drops importance back to 0, clear the ceiling so we
  // never send a stale number into a dimension they no longer care about.
  const setImportance = (key: 'cost' | 'housing', value: Importance) => {
    setProfile((p) => {
      const next: UserProfile = { ...p };
      if (key === 'cost') {
        next.cost_importance = value;
        if (value === 0) next.cost_ceiling = null;
      } else {
        next.housing_importance = value;
        if (value === 0) next.housing_ceiling = null;
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response: MatchResponseFull = await postMatch(profile);
      navigate('/results', { state: response });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.envelope.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Build option lists (typed) for the form controls.
  const climateOptions = CLIMATE_OPTIONS.map((v) => ({
    value: v,
    label: CLIMATE_LABELS[v],
  }));
  const industryOptions = INDUSTRY_OPTIONS.map((v) => ({
    value: v,
    label: INDUSTRY_LABELS[v],
  }));
  const educationOptions = EDUCATION_OPTIONS.map((v) => ({
    value: v,
    label: EDUCATION_LABELS[v],
  }));
  const lifestyleOptions = LIFESTYLE_TAGS.map((v) => ({
    value: v,
    label: LIFESTYLE_LABELS[v],
  }));

  return (
    <form
      className="profile-form"
      onSubmit={handleSubmit}
      noValidate
      data-testid="profile-form"
    >
      <section className="profile-form__intro">
        <h1>Tell us what matters</h1>
        <p>
          Answer only the questions you care about. Anything you skip is
          treated as a soft “no preference” and won’t drag your score down.
        </p>
      </section>

      <section className="profile-form__section">
        <RadioGroup<ClimatePreference>
          name="climate"
          legend="Climate"
          options={climateOptions}
          value={profile.climate}
          onChange={(v) => update('climate', v)}
          nullable
          helpText="Pick the climate you’d most like to live in."
        />
      </section>

      <section className="profile-form__section">
        <ImportanceSlider
          name="cost"
          legend="Cost of living"
          value={profile.cost_importance}
          onChange={(v) => setImportance('cost', v)}
          helpText="How much should the day-to-day cost matter?"
        />
        {profile.cost_importance > 0 ? (
          <CeilingSlider
            name="cost-ceiling"
            legend="Maximum cost level (1 = very cheap, 5 = very expensive)"
            value={profile.cost_ceiling}
            onChange={(v) => update('cost_ceiling', v)}
          />
        ) : null}
      </section>

      <section className="profile-form__section">
        <ImportanceSlider
          name="housing"
          legend="Housing availability & cost"
          value={profile.housing_importance}
          onChange={(v) => setImportance('housing', v)}
          helpText="How critical is the housing market?"
        />
        {profile.housing_importance > 0 ? (
          <CeilingSlider
            name="housing-ceiling"
            legend="Maximum housing level (1 = easy, 5 = very tight)"
            value={profile.housing_ceiling}
            onChange={(v) => update('housing_ceiling', v)}
          />
        ) : null}
      </section>

      <section className="profile-form__section">
        <RadioGroup<Industry>
          name="career"
          legend="Career industry"
          options={industryOptions}
          value={profile.career_industry}
          onChange={(v) => update('career_industry', v)}
          nullable
          helpText="Pick the industry you’d most like to work in."
        />
      </section>

      <section className="profile-form__section">
        <RadioGroup<EducationPriority>
          name="education"
          legend="Education quality"
          options={educationOptions}
          value={profile.education}
          onChange={(v) => update('education', v as EducationPriority)}
          helpText="How important are schools and universities for you?"
        />
      </section>

      <section className="profile-form__section">
        <ImportanceSlider
          name="healthcare"
          legend="Healthcare quality"
          value={profile.healthcare_importance}
          onChange={(v) => update('healthcare_importance', v)}
          helpText="How critical is access to good healthcare?"
        />
      </section>

      <section className="profile-form__section">
        <TagPicker<LifestyleTag>
          name="lifestyle"
          legend="Lifestyle preferences"
          options={lifestyleOptions}
          selected={profile.lifestyle_tags}
          onChange={(v) => update('lifestyle_tags', v)}
          helpText="Pick all that apply — the more you pick, the stricter the filter."
        />
      </section>

      {validationError ? (
        <p className="profile-form__error" role="alert" data-testid="validation-error">
          {validationError}
        </p>
      ) : null}
      {error ? (
        <p className="profile-form__error" role="alert" data-testid="api-error">
          {error}
        </p>
      ) : null}

      <div className="profile-form__actions">
        <button
          type="submit"
          className="btn btn--primary"
          disabled={!!validationError || submitting}
          data-testid="submit"
        >
          {submitting ? 'Finding matches…' : 'Find my matches'}
        </button>
      </div>
    </form>
  );
}
