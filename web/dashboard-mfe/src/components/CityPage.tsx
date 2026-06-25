/**
 * CityPage — full profile for a single city.
 *
 * Fetches `GET /api/cities/:slug` and renders the 8 dimension scores
 * (per FR-5) plus the landmark photo and country flag graphic
 * (per FR-8 / FTC-16). Handles loading skeleton, error (incl. 404),
 * and a back link to /results.
 *
 * Adds an "Add to / Remove from Comparison" button (Acceptance-Criteria
 * Feature 4) wired to the session-scoped shortlist.
 *
 * v0.4.0: copy is routed through i18next (PRD v3.2.0 S11).
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { City } from '@relocatewise/shared';
import { useTranslation } from 'react-i18next';
import { getCity, ApiError } from '@relocatewise/web-container/api';
import { CityDimensions } from './CityDimensions';
import { ShortlistBar } from '@relocatewise/web-container/components/ShortlistBar';
import { useShortlist } from '@relocatewise/web-container/state/shortlist';
import { useToast } from '@relocatewise/web-container/components/Toast';
import './CityPage.css';

export function CityPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [city, setCity] = useState<City | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { has, toggle, count } = useShortlist();
  const toast = useToast();

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
          setError(t('city.loadFailFallback'));
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, t]);

  if (loading) {
    return (
      <div className="city-page" data-testid="city-loading">
        <div className="skeleton skeleton--title" aria-hidden="true" />
        <div className="skeleton skeleton--text" aria-hidden="true" />
        <div className="skeleton skeleton--text" aria-hidden="true" />
        <div className="skeleton skeleton--block" aria-hidden="true" />
        <span className="visually-hidden">{t('city.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="city-page city-page--error" data-testid="city-error">
        <h1>{t('city.error')}</h1>
        <p>{error}</p>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => navigate(-1)}
        >
          {t('city.backShort')}
        </button>
      </div>
    );
  }

  if (!city) {
    return null;
  }

  const inShortlist = has(city.slug);
  const wouldExceedCap = !inShortlist && count >= 3;

  const handleShortlistToggle = () => {
    if (wouldExceedCap) {
      toast.push(t('results.shortlistFull'));
      return;
    }
    toggle({
      city: {
        slug: city.slug,
        name: city.name,
        country: city.country,
        country_code: city.country_code,
        region: city.region,
        lat: city.lat,
        lng: city.lng,
        description: city.description,
        last_updated: city.last_updated,
        flag_image_url: city.flag_image_url,
        landmark_image_url: city.landmark_image_url,
        dimensions: city.dimensions,
      },
      score: 0,
      why: '',
      why_key: 'neutral',
    });
  };

  return (
    <article className="city-page" data-testid="city-page">
      <header className="city-page__header">
        <Link to="/results" className="city-page__back" data-testid="city-page__back">
          {t('city.back')}
        </Link>
        <h1>
          {city.name}
          <span className="city-page__country">, {city.country}</span>
          <img
            className="city-page__flag"
            src={city.flag_image_url}
            alt={t('city.flagAlt', { country: city.country })}
            width={24}
            height={16}
            data-testid="city-page-flag"
          />
        </h1>
        <p className="city-page__region">{city.region}</p>
        <p className="city-page__desc">{city.description}</p>
        <div className="city-page__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleShortlistToggle}
            disabled={wouldExceedCap}
            title={wouldExceedCap ? t('city.fullTitle') : undefined}
            data-testid="city-toggle-shortlist"
          >
            {inShortlist ? t('city.remove') : t('city.add')}
          </button>
        </div>
        <dl className="city-page__meta" data-testid="city-page__meta">
          <div>
            <dt>{t('city.coordinates')}</dt>
            <dd>
              {city.lat.toFixed(2)}°, {city.lng.toFixed(2)}°
            </dd>
          </div>
          <div>
            <dt>{t('city.metaLastUpdated')}</dt>
            <dd>
              <time dateTime={city.last_updated}>{city.last_updated}</time>
            </dd>
          </div>
        </dl>
      </header>
      <figure className="city-page__landmark" data-testid="city-page-landmark">
        <img
          src={city.landmark_image_url}
          alt={t('city.landmarkAlt', { name: city.name })}
          loading="lazy"
          decoding="async"
          width={1280}
          height={720}
        />
      </figure>
      <section className="city-page__dimensions">
        <h2>{t('city.dimensionsTitle')}</h2>
        <CityDimensions dimensions={city.dimensions} />
      </section>
      <footer className="city-page__updated" data-testid="city-page-updated">
        {t('city.lastUpdated')} <time dateTime={city.last_updated}>{city.last_updated}</time>
      </footer>
      <ShortlistBar />
    </article>
  );
}