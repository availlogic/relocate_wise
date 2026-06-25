/**
 * RelocateWise frontend API client.
 *
 * Per Architecture §7.1, the API surface is exactly four endpoints:
 *   GET  /api/health
 *   GET  /api/cities
 *   GET  /api/cities/:slug
 *   POST /api/match
 *
 * Requests are made with **relative** URLs (`/api/...`) so they hit the
 * same origin the SPA is served from. In dev that origin is the Vite
 * dev server on :5173, which forwards `/api/*` to the Fastify API on
 * :3000 via the proxy in `web/vite.config.ts`. In production the
 * origin is the Cloudflare Pages deployment, and the `/api/*` Pages
 * Function rule forwards calls to the Ubuntu API via Cloudflare Tunnel
 * (`docker-compose.cloudflared.yml`).
 *
 * To point at a remote API instead (e.g. for a staging environment or
 * to bypass the proxy in dev), set `VITE_API_BASE=https://staging.example.com`.
 *
 * AC-10: no personal data is sent. The only payload is the user's
 * preference profile, which the server discards after responding.
 */
import type {
  City,
  UserProfile,
  CityDimensions,
} from '@relocatewise/shared';

const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

/**
 * Rich `MatchResult` row — the API returns the full City record (per
 * Architecture §7.1) so the results page can render the full profile
 * without a second round-trip. The shared `MatchedCity` type is the
 * minimum contract; this is the actual one.
 */
export interface MatchedCityFull {
  city: {
    slug: string;
    name: string;
    country: string;
    country_code: string;
    region: string;
    lat: number;
    lng: number;
    description: string;
    dimensions: CityDimensions;
    last_updated: string;
    flag_image_url: string;
    landmark_image_url: string;
  };
  /** Overall match score on a 0-100 integer scale. */
  score: number;
  /** Templated one-line "why this fits you" explanation (English fallback). */
  why: string;
  /** i18next key for the why-template (Architecture §6.5, PRD v3.2.0 S11). */
  why_key: string;
  /** Variables to interpolate into the why-template. */
  why_vars?: Record<string, string>;
}

export interface MatchResponseFull {
  results: MatchedCityFull[];
  /** ISO timestamp at which the result was generated. */
  generated_at: string;
}

/** Slim projection returned by `GET /api/cities`. */
export type CitySummary = Pick<
  City,
  'slug' | 'name' | 'country' | 'country_code' | 'region' | 'lat' | 'lng' | 'description'
>;

/** Error envelope shared by all 4xx/5xx responses. */
export interface ApiErrorEnvelope {
  error: string;
  message: string;
}

/** Thrown by the API client on any non-2xx response. */
export class ApiError extends Error {
  readonly status: number;
  readonly envelope: ApiErrorEnvelope;

  constructor(status: number, envelope: ApiErrorEnvelope) {
    super(envelope.message);
    this.name = 'ApiError';
    this.status = status;
    this.envelope = envelope;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let envelope: ApiErrorEnvelope;
    try {
      envelope = (await res.json()) as ApiErrorEnvelope;
    } catch {
      envelope = { error: 'network_error', message: res.statusText };
    }
    throw new ApiError(res.status, envelope);
  }
  return (await res.json()) as T;
}

export function getHealth(): Promise<{ ok: boolean; version: string; timestamp: string }> {
  return request('/api/health');
}

export function listCities(): Promise<{ cities: CitySummary[] }> {
  return request('/api/cities');
}

export function getCity(slug: string): Promise<City> {
  return request(`/api/cities/${encodeURIComponent(slug)}`);
}

export function postMatch(profile: UserProfile): Promise<MatchResponseFull> {
  return request('/api/match', {
    method: 'POST',
    body: JSON.stringify(profile),
  });
}

export { API_BASE };
