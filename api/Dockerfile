# RelocateWise API — Node 20, ESM, production build.
#
# Build context is the repo root so we can copy `shared/`, `db/migrations/`,
# and `db/seeds/cities.json` into the image. The runtime container only
# needs `dist/`, the migration SQL, and the seed JSON.
FROM node:20-alpine AS build
WORKDIR /app

# Install only the api workspace's deps. We use the npm workspace
# `npm ci` at the repo root, so we copy package-lock + the three
# package.json files.
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY api/package.json ./api/
COPY web/package.json ./web/
RUN npm ci --include=dev

# Build the shared types and the api.
COPY shared/ ./shared/
COPY api/ ./api/
COPY db/ ./db/
RUN npm run -w @relocatewise/shared build
RUN npm run -w @relocatewise/api build

# Prune dev deps for a smaller runtime image.
RUN npm prune --omit=dev

# ---------------------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy the pruned prod tree.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/api/dist ./api/dist
COPY --from=build /app/api/package.json ./api/package.json
COPY --from=build /app/db ./db

WORKDIR /app/api
EXPOSE 3000

# Healthcheck hits the same port the app listens on. Caddy fronts the
# container in production, so this check is for the in-container probe.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "dist/server.js"]
