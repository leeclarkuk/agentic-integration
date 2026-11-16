# syntax=docker/dockerfile:1.7
# Build from the repo root:  docker build -f apps/api/Dockerfile .
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/telemetry/package.json packages/telemetry/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @aip/api...
COPY packages/telemetry packages/telemetry
COPY apps/api apps/api
RUN pnpm --filter @aip/api... run build \
 && pnpm deploy --filter @aip/api --prod --legacy /out

# Distroless: no shell, no package manager, runs as non-root (uid 65532).
FROM gcr.io/distroless/nodejs${NODE_VERSION}-debian12:nonroot
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
COPY --from=build /repo/apps/api/dist ./dist
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
USER 65532:65532
CMD ["dist/main.js"]
