# RelocateWise Ingestion Service — Node 20, ESM, production build.
#
# The ingestion service runs the node-cron scheduler that periodically
# calls `runIngestion()`. It connects to the database as the
# `ingestion_service` role (SELECT on `matching.*`, R/W on `ingestion.*`)
# and writes per-dimension scores to the matching service's internal
# PUT endpoint over HTTP.
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY api/matching-service/package.json ./api/matching-service/
COPY api/ingestion-service/package.json ./api/ingestion-service/
COPY api/gateway/package.json ./api/gateway/
COPY web/package.json ./web/
RUN npm ci --include=dev

COPY shared/ ./shared/
COPY api/ingestion-service/ ./api/ingestion-service/
RUN npm run -w @relocatewise/shared build
RUN npm run -w @relocatewise/ingestion-service build

RUN npm prune --omit=dev

# ---------------------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/api/ingestion-service/package.json ./api/ingestion-service/package.json
COPY --from=build /app/api/ingestion-service/dist ./api/ingestion-service/dist

WORKDIR /app/api/ingestion-service

# The ingestion service has no HTTP listener (it's a cron worker).
# The orchestrator / Docker Compose stack monitors the container via
# `docker ps`; liveness is inferred from the cron task not crashing.
# We expose no port.

CMD ["node", "dist/server.js"]