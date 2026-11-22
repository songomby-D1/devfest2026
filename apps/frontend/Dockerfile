# syntax=docker/dockerfile:1
# Frontend image: the Vite build served by nginx, which also relays /api to the gateway on
# the Compose network, so the browser keeps a single origin (D06). Build from the root (D14):
#   docker build -f apps/frontend/Dockerfile .
# Exclusions: apps/frontend/Dockerfile.dockerignore. Node patch pinned under D15.
ARG NODE_IMAGE=node:22.23.5-slim
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.29-alpine

FROM ${NODE_IMAGE} AS build
WORKDIR /repo
COPY . .
# VITE_API_MODE stays unset: the production bundle calls the real gateway through /api.
RUN --mount=type=cache,id=npm,target=/root/.npm npm ci --prefer-offline --workspace apps/frontend --include-workspace-root=false --no-audit --no-fund
RUN npm run build --workspace apps/frontend

# Unprivileged nginx: runs as a non-root user and listens on 8080.
FROM ${NGINX_IMAGE} AS runtime
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/frontend/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
