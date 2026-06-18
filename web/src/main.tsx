/**
 * Vite entrypoint — mounts <App /> into the #app element.
 *
 * The i18n bootstrap is imported before rendering so consumers
 * mounted during the first render already see the persisted language
 * (PRD v3.2.0 §6.1 S11 / Architecture v1.3.0 §8.2). The translation
 * bundles are static JSON imports — zero network latency on toggle.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './i18n';
import './styles/global.css';

const container = document.getElementById('app');
if (!container) {
  throw new Error('Root element #app not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
