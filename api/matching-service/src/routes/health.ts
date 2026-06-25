/**
 * `GET /api/health` — liveness probe.
 *
 * Per Architecture §7 the body is `{ ok, version, timestamp }`.
 * Always returns 200 unless the process is dead.
 */
import type { FastifyInstance } from 'fastify';

export function healthRoute(app: FastifyInstance, version: string): void {
  app.get('/api/health', async () => ({ ok: true, version, timestamp: new Date().toISOString() }));
}
