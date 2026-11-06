# libavif is built once and shared by dev/check/runtime. Keep the versions pinned.
FROM node:24.22.1-bookworm AS libavif

ARG LIBAAVIF_VERSION=v1.4.2

RUN unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy && \
    apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake git nasm pkg-config ca-certificates \
    libxml2-dev libjpeg-dev libpng-dev zlib1g-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /src
RUN unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy && \
    git clone --depth 1 --branch "${LIBAAVIF_VERSION}" https://github.com/AOMediaCodec/libavif.git
RUN unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy && \
    cmake -S libavif -B libavif/build \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_SHARED_LIBS=OFF \
    -DAVIF_CODEC_AOM=LOCAL \
    -DAVIF_BUILD_APPS=ON \
    -DAVIF_LIBXML2=SYSTEM \
    -DAVIF_LIBYUV=OFF \
 && cmake --build libavif/build -j"$(nproc)" \
 && mkdir -p /out \
 && cp libavif/build/avifenc libavif/build/avifdec libavif/build/avifgainmaputil /out/

FROM node:24.22.1-bookworm-slim AS base

RUN unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy && \
    apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libpng16-16 libjpeg62-turbo libxml2 libstdc++6 zlib1g libicu72 \
 && rm -rf /var/lib/apt/lists/* \
 && unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy \
 && npm install -g pnpm@10.24.0

COPY --from=libavif /out/avifenc /out/avifdec /out/avifgainmaputil /usr/local/bin/

WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy && \
    pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build && pnpm prune --prod

FROM deps AS dev
COPY . .
CMD ["pnpm", "dev"]

FROM deps AS check
COPY . .
RUN pnpm typecheck && pnpm lint && pnpm test && pnpm build

FROM base AS runtime

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
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.HTTP_PORT||7001)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server/index.js"]
