# T1G: image web dari root monorepo (tsconfig.base.json ikut ter-resolve).
# Build context HARUS repo root (lihat docker-compose.yml / CI):
#   docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @booth/web --include-workspace-root
COPY tsconfig.base.json ./
COPY apps/web apps/web
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CHAIN_ID=11155111
ENV NEXT_PUBLIC_CHAIN_ID=$NEXT_PUBLIC_CHAIN_ID
ARG NEXT_PUBLIC_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
ENV NEXT_PUBLIC_CONTRACT_ADDRESS=$NEXT_PUBLIC_CONTRACT_ADDRESS
RUN npm run build --workspace @booth/web

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
# --ignore-scripts: jangan jalankan root `prepare` (husky) tanpa devDeps.
RUN npm ci --omit=dev --ignore-scripts --workspace @booth/web --include-workspace-root \
  && rm -rf /root/.npm
COPY --from=build /repo/apps/web/.next ./apps/web/.next
COPY --from=build /repo/apps/web/next.config.mjs ./apps/web/next.config.mjs
COPY --from=build /repo/apps/web/package.json ./apps/web/package.json
RUN addgroup -S booth && adduser -S booth -G booth && chown -R booth:booth /app
USER booth
WORKDIR /app/apps/web
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:3000/ || exit 1
CMD ["npm", "start"]
