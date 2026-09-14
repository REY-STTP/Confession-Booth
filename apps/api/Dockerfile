FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev 2>/dev/null || npm install --omit=dev
COPY dist ./dist
COPY scripts ./scripts
RUN addgroup -S booth && adduser -S booth -G booth && chown -R booth:booth /app
USER booth
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1
CMD ["node", "./dist/index.js"]
