# syntax=docker/dockerfile:1.7
# Build from the repo root:  docker build -f apps/worker/Dockerfile .
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS build
WORKDIR /repo
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
COPY pyproject.toml uv.lock ./
COPY apps/worker apps/worker
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-editable --package aip-worker

# Same CPython minor as the build stage so compiled wheels and the venv match.
FROM python:3.15-slim-bookworm
RUN groupadd --gid 65532 app && useradd --uid 65532 --gid app --no-create-home --shell /usr/sbin/nologin app
WORKDIR /app
COPY --from=build --chown=65532:65532 /repo/.venv /app/.venv
ENV PATH=/app/.venv/bin:$PATH PYTHONUNBUFFERED=1 WORKER_HEALTH_PORT=8081
EXPOSE 8081
USER 65532:65532
ENTRYPOINT ["python", "-m", "worker.main"]
