# syntax=docker/dockerfile:1.7
# Build from the repo root:  docker build -f apps/__name__/Dockerfile .
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/telemetry/package.json packages/telemetry/
COPY apps/__name__/package.json apps/__name__/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @aip/__name__...
COPY packages/telemetry packages/telemetry
COPY apps/__name__ apps/__name__
RUN pnpm --filter @aip/__name__... run build \
 && pnpm deploy --filter @aip/__name__ --prod --legacy /out

# Distroless: no shell, no package manager, runs as non-root (uid 65532).
FROM gcr.io/distroless/nodejs${NODE_VERSION}-debian12:nonroot
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
COPY --from=build /repo/apps/__name__/dist ./dist
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
USER 65532:65532
CMD ["dist/main.js"]
