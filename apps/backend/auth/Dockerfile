# syntax=docker/dockerfile:1
# Auth service image. Build from the repository root (D14) so that the root lockfile is used:
#   docker build -f apps/backend/auth/Dockerfile .
# Exclusions: apps/backend/auth/Dockerfile.dockerignore. Node patch pinned under D15.
ARG NODE_IMAGE=node:22.23.5-slim

# Workspace manifests, the root lockfile and this service's sources only.
FROM ${NODE_IMAGE} AS sources
WORKDIR /repo
COPY . .

# Development dependencies, Prisma client generation and compilation.
FROM sources AS build
RUN npm ci --workspace apps/backend/auth --include-workspace-root=false --no-audit --no-fund
RUN npm run build --workspace apps/backend/auth

# Production dependencies only, including the Prisma CLI for migrations at startup.
FROM sources AS prod-deps
RUN npm ci --workspace apps/backend/auth --include-workspace-root=false --omit=dev --no-audit --no-fund

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=prod-deps /repo ./
COPY --from=build /repo/apps/backend/auth/dist ./apps/backend/auth/dist
WORKDIR /repo/apps/backend/auth
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then((r)=>process.exit(r.ok?0:1),()=>process.exit(1))"
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
