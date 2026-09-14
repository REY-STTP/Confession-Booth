# T1-025/T1G: image API dari root monorepo (workspace @booth/shared ikut ter-resolve).
# Build context HARUS repo root (lihat docker-compose.yml / CI):
#   docker build -f apps/api/Dockerfile .
# Base node:22 (local dev v22 + cookie@2 butuh >=22).
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace @booth/api --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build --workspace @booth/api

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
# --ignore-scripts: jangan jalankan root `prepare` (husky) tanpa devDeps.
RUN npm ci --omit=dev --ignore-scripts --workspace @booth/api --include-workspace-root \
  && rm -rf /root/.npm
# Artefak build + migrasi SQL (dibutuhkan scripts/db/migrate.mjs) + seed.
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/scripts ./apps/api/scripts
COPY --from=build /repo/apps/api/src/db/migrations ./apps/api/src/db/migrations
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist
RUN addgroup -S booth && adduser -S booth -G booth && chown -R booth:booth /app
USER booth
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1
CMD ["node", "./dist/index.js"]
