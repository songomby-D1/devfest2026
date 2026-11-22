# syntax=docker/dockerfile:1

# Content & Verification service image.
# Build context: the repository root, for tsconfig.base.json (D14).
#   docker build -f apps/backend/content/Dockerfile --target runtime .
# Exclusions: apps/backend/content/Dockerfile.dockerignore
# The service is a standalone npm project until the root workspace lands.

ARG NODE_IMAGE=node:22-alpine

# All dependencies, including development tools and the Prisma CLI.
FROM ${NODE_IMAGE} AS deps
WORKDIR /repo/apps/backend/content
COPY apps/backend/content/package.json apps/backend/content/package-lock.json apps/backend/content/.npmrc ./
RUN npm ci --no-audit --no-fund

# Local development: applies migrations, then recompiles on change.
FROM deps AS development
COPY tsconfig.base.json /repo/
COPY apps/backend/content/ ./
RUN npx prisma generate && chown -R node:node /repo/apps/backend/content
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/health" > /dev/null || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start:dev"]

# Generates the Prisma client and compiles the service to dist/.
FROM deps AS build
COPY tsconfig.base.json /repo/
COPY apps/backend/content/ ./
RUN npm run build

# Production dependencies only. The Prisma CLI stays for `migrate deploy`.
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /repo/apps/backend/content
COPY apps/backend/content/package.json apps/backend/content/package-lock.json apps/backend/content/.npmrc ./
RUN npm ci --omit=dev --no-audit --no-fund

# Runtime image: production dependencies, compiled code, non-root user.
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /repo/apps/backend/content/package.json ./
COPY --from=prod-deps /repo/apps/backend/content/node_modules ./node_modules
COPY --from=build /repo/apps/backend/content/dist ./dist
COPY apps/backend/content/prisma ./prisma
COPY apps/backend/content/prisma.config.ts apps/backend/content/docker-entrypoint.sh ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/health" > /dev/null || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
