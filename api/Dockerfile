FROM node:24.22.1-bookworm-slim AS build

WORKDIR /app
RUN npm install -g pnpm@10.24.0

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json tsup.config.ts ./
COPY src ./src
RUN pnpm build && pnpm prune --prod

FROM node:24.22.1-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    APP_ENV=production \
    HTTP_HOST=0.0.0.0 \
    HTTP_PORT=7001 \
    STORAGE_PATH=/data

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
USER node

EXPOSE 7001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const base=(process.env.API_BASE_PATH||'/').replace(/\/+$/,''); fetch('http://127.0.0.1:'+(process.env.HTTP_PORT||7001)+base+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
