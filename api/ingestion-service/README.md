# `@relocatewise/ingestion-service`

The **ingestion service** is one of the three Node.js microservices that make up the RelocateWise GA v1.0 release (per `docs/Architecture.md` v1.4.0 §4.5 and §8).

It owns:
- The `ingestion` PostgreSQL schema (`pipeline_logs`).
- The `node-cron` scheduler that periodically calls `runIngestion()`.
- The CLI entrypoint (`npm -w @relocatewise/ingestion-service run ingest`) for ad-hoc passes.
- The HTTP-backed `ScoresWriter` that PUTs per-dimension scores to the matching service's internal endpoint.

It does NOT:
- Write to `matching.city_scores` directly (Database §1.4 — only the matching service has INSERT/UPDATE on the matching schema).
- Sit on any HTTP ingress path. It's a worker process.

## Inputs

| Env var | Required | Purpose |
|---|---|---|
| `INGESTION_DATABASE_URL` | Yes | Connection string for the `ingestion_service` PostgreSQL role (SELECT on `matching.*`, R/W on `ingestion.*`). |
| `INGESTION_TARGET_URL` | Production | Base URL of the matching service, e.g. `http://matching:3000`. |
| `INGESTION_TARGET_TOKEN` | Production | Bearer token shared with the matching service's internal endpoint. |
| `INGESTION_CRON` | No | Standard 5-field `node-cron` expression. Default `0 3 1 * *` (03:00 UTC on the 1st of every month). |
| `INGESTION_DISABLED` | No | Set to `1` to exit immediately without arming the cron (useful in dev / tests). |

## Outputs

- HTTP `PUT` calls to `${INGESTION_TARGET_URL}/api/internal/cities/:slug/scores` for each `(city, dimension, score, sub_scores)` triple.
- Rows written to `ingestion.pipeline_logs` (one row per city per pass + one final update with completion status).
- stdout logs: `[ingestion-service] scheduled pass complete: updated=N skipped=M durationMs=D` on every cron tick.

## Directory layout

```
ingestion-service/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
├── Dockerfile
├── README.md
├── src/
│   ├── server.ts           # entrypoint: arms the cron
│   ├── cli.ts              # `tsx src/cli.ts` — ad-hoc single pass
│   ├── db/
│   │   ├── pool.ts         # getIngestionPool factory
│   │   └── cities.seed.ts  # copy of the curated seed (for fetchMilitarySafety)
│   └── jobs/
│       ├── ingestion.ts    # orchestrator + httpScoresWriter + defaultScoresWriter
│       └── scheduler.ts    # legacy export kept for test compatibility
└── test/
    ├── ingestion.test.ts
    └── scheduler.test.ts
```

## Setup / test / build

```bash
npm ci

# Typecheck
npm -w @relocatewise/ingestion-service run typecheck

# Tests (testcontainers-based; requires Docker)
npm -w @relocatewise/ingestion-service test

# Build
npm -w @relocatewise/ingestion-service run build

# Single ad-hoc pass
npm -w @relocatewise/ingestion-service run ingest
npm -w @relocatewise/ingestion-service run ingest -- --city=lisbon-pt

# Dev (cron + watcher)
INGESTION_DATABASE_URL=postgres://ingestion_service:ingestion_service@localhost:5432/relocatewise \
INGESTION_TARGET_URL=http://localhost:3000 \
INGESTION_TARGET_TOKEN=local-dev-secret \
npm -w @relocatewise/ingestion-service run dev
```

## Known limitations

1. The default behaviour when `INGESTION_TARGET_URL` is unset is to fall back to `noopScoresWriter` — useful for staging environments where the matching service is not reachable, but it means the orchestrator never refreshes scores in those envs. The startup log line explicitly states which writer is in use so this is observable.
2. Per-city HTTP writes happen serially within a single pass; the orchestrator is intentionally single-threaded to keep determinism and to avoid hammering the matching service under tight cron ticks. A future version can parallelise per-city writes if the matching service ever becomes the bottleneck (Database §5 "Update DB via API" is the only path, so this would be a non-trivial refactor).