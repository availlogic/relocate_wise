# RelocateWise API Gateway — Node 20, ESM, production build.
#
# The gateway is the only service that listens on the public ingress
# (Cloudflare Tunnel → gateway:3000 → matching-service:3000). It is
# stateless — no database, no persistent state, no auth of its own
# beyond the optional shared-secret gate.
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
COPY api/gateway/ ./api/gateway/
RUN npm run -w @relocatewise/shared build
RUN npm run -w @relocatewise/gateway build

RUN npm prune --omit=dev

# ---------------------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/api/gateway/package.json ./api/gateway/package.json
COPY --from=build /app/api/gateway/dist ./api/gateway/dist

WORKDIR /app/api/gateway
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "dist/server.js"]