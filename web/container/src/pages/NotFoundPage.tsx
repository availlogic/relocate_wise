/**
 * NotFoundPage — fallback route for unknown URLs.
 */
import { Link } from 'react-router-dom';
import './NotFoundPage.css';

export function NotFoundPage() {
  return (
    <div className="not-found" data-testid="not-found">
      <h1>Page not found</h1>
      <p>The page you’re looking for doesn’t exist.</p>
      <Link to="/" className="btn btn--primary">
        Back to the questionnaire
      </Link>
    </div>
  );
}
