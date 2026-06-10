/**
 * Form-level option lists. Pulled from `@relocatewise/shared` so the
 * frontend can never drift from the API's accepted values. Each list is
 * paired with a human-readable label that the form displays.
 */
import {
  CLIMATE_OPTIONS,
  INDUSTRY_OPTIONS,
  EDUCATION_OPTIONS,
  LIFESTYLE_TAGS,
} from '@relocatewise/shared';

export const CLIMATE_LABELS: Record<
  (typeof CLIMATE_OPTIONS)[number],
  string
> = {
  tropical: 'Tropical',
  temperate: 'Temperate',
  mediterranean: 'Mediterranean',
  continental: 'Continental',
  cold: 'Cold / snowy',
  arid: 'Arid / dry',
  no_preference: 'No preference',
};

export const INDUSTRY_LABELS: Record<
  (typeof INDUSTRY_OPTIONS)[number],
  string
> = {
  tech: 'Technology',
  finance: 'Finance & banking',
  healthcare: 'Healthcare',
  creative: 'Creative industries',
  manufacturing: 'Manufacturing',
};

export const EDUCATION_LABELS: Record<
  (typeof EDUCATION_OPTIONS)[number],
  string
> = {
  not_relevant: 'Not a priority',
  somewhat: 'Somewhat important',
  important: 'Very important',
};

export const LIFESTYLE_LABELS: Record<
  (typeof LIFESTYLE_TAGS)[number],
  string
> = {
  urban: 'Urban / big-city',
  suburban: 'Suburban',
  rural: 'Rural',
  coastal: 'Coastal',
  mountain: 'Mountain',
  arts_culture: 'Arts & culture',
  family_oriented: 'Family-oriented',
  expat_friendly: 'Expat-friendly',
};
