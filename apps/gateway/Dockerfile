FROM oven/bun:1.3.3-slim

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/gateway/package.json apps/gateway/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/chain/package.json packages/chain/package.json
COPY scripts/package.json scripts/package.json
RUN bun install --frozen-lockfile --production --filter '@bellaso/gateway'

COPY packages packages
COPY apps/gateway/src apps/gateway/src

ENV NODE_ENV=production
USER bun
EXPOSE 8080
CMD ["bun", "apps/gateway/src/server.ts"]
