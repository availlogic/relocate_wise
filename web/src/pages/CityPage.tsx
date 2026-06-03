/**
 * CityPage — full profile for a single city.
 *
 * Fetches `GET /api/cities/:slug` and renders the seven dimension scores
 * (per PRD FR-5). Handles loading, error (incl. 404), and a back link to
 * the previous page if any.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { City } from '@relocatewise/shared';
import { getCity, ApiError } from '../api';
import { CityDimensions } from '../components/CityDimensions';
import './CityPage.css';

export function CityPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [city, setCity] = useState<City | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCity(slug)
      .then((data) => {
        if (!cancelled) {
          setCity(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setError(err.envelope.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Could not load the city.');
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="city-page" data-testid="city-loading">
        <p>Loading city profile…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="city-page city-page--error" data-testid="city-error">
        <h1>Couldn’t load this city</h1>
        <p>{error}</p>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => navigate(-1)}
        >
          Go back
        </button>
      </div>
    );
  }

  if (!city) {
    return null;
  }

  return (
    <article className="city-page" data-testid="city-page">
      <header className="city-page__header">
        <Link to="/results" className="city-page__back">← Back to results</Link>
        <h1>
          {city.name}
          <span className="city-page__country">, {city.country}</span>
        </h1>
        <p className="city-page__region">{city.region}</p>
        <p className="city-page__desc">{city.description}</p>
        <dl className="city-page__meta">
          <div>
            <dt>Coordinates</dt>
            <dd>
              {city.lat.toFixed(2)}°, {city.lng.toFixed(2)}°
            </dd>
          </div>
          <div>
            <dt>Last updated</dt>
            <dd>
              <time dateTime={city.last_updated}>{city.last_updated}</time>
            </dd>
          </div>
        </dl>
      </header>
      <section className="city-page__dimensions">
        <h2>Dimension scores</h2>
        <CityDimensions dimensions={city.dimensions} />
      </section>
    </article>
  );
}
