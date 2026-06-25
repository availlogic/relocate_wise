# RelocateWise Matching Service — Node 20, ESM, production build.
#
# Build context is the repo root (matches the base Docker Compose
# service). The runtime container only needs `dist/`, the migration
# SQL, and the seed JSON.
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
COPY api/matching-service/ ./api/matching-service/
COPY db/ ./db/
RUN npm run -w @relocatewise/shared build
RUN npm run -w @relocatewise/matching-service build

RUN npm prune --omit=dev

# ---------------------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/api/matching-service/package.json ./api/matching-service/package.json
COPY --from=build /app/api/matching-service/dist ./api/matching-service/dist
COPY --from=build /app/db ./db

WORKDIR /app/api/matching-service
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "dist/server.js"]