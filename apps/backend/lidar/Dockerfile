# Build from the repository root (D14): docker build -f apps/backend/lidar/Dockerfile .
# Node 22 patch pinned under D15.
FROM node:22.23.5-slim AS build
WORKDIR /app/apps/backend/lidar
COPY tsconfig.base.json /app/
COPY apps/backend/lidar/package.json apps/backend/lidar/package-lock.json ./
RUN npm ci
COPY apps/backend/lidar/ ./
RUN npx prisma generate && npm run build && npm prune --omit=dev

FROM node:22.23.5-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/apps/backend/lidar/package.json /app/apps/backend/lidar/prisma.config.ts ./
COPY --from=build /app/apps/backend/lidar/node_modules ./node_modules
COPY --from=build /app/apps/backend/lidar/prisma ./prisma
COPY --from=build /app/apps/backend/lidar/dist ./dist
COPY --from=build /app/apps/backend/lidar/docker-entrypoint.sh ./
USER node
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
