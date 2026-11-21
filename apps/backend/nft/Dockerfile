# syntax=docker/dockerfile:1

# NFT service image (nft_context.md §9.10).
# Build context: the repository root, for tsconfig.base.json.
#   docker build -f apps/backend/nft/Dockerfile .
# Exclusions: apps/backend/nft/Dockerfile.dockerignore
# The service is a standalone npm project until the root workspace lands.

ARG NODE_IMAGE=node:22-alpine

# All dependencies, including development tools.
FROM ${NODE_IMAGE} AS deps
WORKDIR /repo/apps/backend/nft
COPY apps/backend/nft/package.json apps/backend/nft/package-lock.json apps/backend/nft/.npmrc ./
RUN npm ci --no-audit --no-fund

# Local development: recompiles on change with `nest start --watch`.
FROM deps AS development
COPY tsconfig.base.json /repo/
COPY apps/backend/nft/ ./
RUN mkdir -p /data/media && chown node:node /repo/apps/backend/nft
USER node
EXPOSE 3005
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3005}/health" > /dev/null || exit 1
CMD ["npm", "run", "start:dev"]

# Compiles the service to dist/.
FROM deps AS build
COPY tsconfig.base.json /repo/
COPY apps/backend/nft/ ./
RUN npm run build

# Production dependencies only.
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /repo/apps/backend/nft
COPY apps/backend/nft/package.json apps/backend/nft/package-lock.json apps/backend/nft/.npmrc ./
RUN npm ci --omit=dev --no-audit --no-fund

# Runtime image: production dependencies, compiled code, non-root user.
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /repo/apps/backend/nft/package.json ./
COPY --from=prod-deps /repo/apps/backend/nft/node_modules ./node_modules
COPY --from=build /repo/apps/backend/nft/dist ./dist
RUN mkdir -p /data/media
USER node
EXPOSE 3005
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3005}/health" > /dev/null || exit 1
CMD ["node", "dist/main.js"]
