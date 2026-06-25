/**
 * Public entry point for `@relocatewise/web-quiz-mfe`.
 *
 * The container (`@relocatewise/web-container`) loads this module
 * via `React.lazy(() => import('@relocatewise/web-quiz-mfe'))` and
 * reads the named exports below.
 *
 * Architecture v1.4.0 §4.1: "Quiz MFE: Controls the step-by-step
 * preference questionnaire. Emits a Custom Event with the completed
 * user profile on finish." The Custom Event dispatched on submit is
 * `rw:quiz_completed` (per Acceptance-Criteria Feature 2 / FTC-17).
 */
export { ProfileForm } from './components/ProfileForm.js';