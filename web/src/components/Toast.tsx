/**
 * Toast — transient notification surface for short-lived messages.
 *
 * Used today for the "4th city blocked" alert from the shortlist
 * (Acceptance-Criteria Feature 4: *"You can compare up to 3 cities.
 * Please remove one first."*) and for any redirect notices that should
 * auto-dismiss after a few seconds.
 *
 * Implementation: a small React context that exposes `push(message)`;
 * toasts auto-dismiss after `defaultDurationMs` (4s) and stack at the
 * bottom of the viewport. No external state library.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import './Toast.css';

export interface ToastEntry {
  id: number;
  message: string;
  /** Optional duration override in ms. */
  durationMs?: number;
}

export interface ToastApi {
  /** Push a toast message; returns its id (rarely needed). */
  push: (message: string, options?: { durationMs?: number }) => number;
  /** Manually dismiss a toast. */
  dismiss: (id: number) => void;
  /** Active toasts (read-only view). */
  entries: ToastEntry[];
}

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setEntries((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback<ToastApi['push']>(
    (message, options) => {
      counter.current += 1;
      const id = counter.current;
      const entry: ToastEntry = {
        id,
        message,
        ...(options?.durationMs !== undefined ? { durationMs: options.durationMs } : {}),
      };
      setEntries((prev) => [...prev, entry]);
      const duration = options?.durationMs ?? DEFAULT_DURATION_MS;
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo<ToastApi>(
    () => ({ push, dismiss, entries }),
    [push, dismiss, entries],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="toast-stack"
        role="status"
        aria-live="polite"
        data-testid="toast-stack"
      >
        {entries.map((t) => (
          <div
            key={t.id}
            className="toast"
            data-testid={`toast-${t.id}`}
            role="alert"
          >
            <span className="toast__message">{t.message}</span>
            <button
              type="button"
              className="toast__close"
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
              data-testid={`toast-${t.id}-close`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** No-op fallback when a consumer is rendered without a provider (e.g. tests). */
const NOOP_TOAST: ToastApi = {
  push: () => 0,
  dismiss: () => {},
  entries: [],
};

/**
 * Hook for pushing toasts. Returns a no-op API when used outside a
 * `<ToastProvider>` so consumers in tests (or anywhere else without a
 * provider) don't crash. The provider stack lives at the App root, so
 * production code always has it.
 */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  return ctx ?? NOOP_TOAST;
}