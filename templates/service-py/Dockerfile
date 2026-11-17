# syntax=docker/dockerfile:1.7
# Build from the repo root:  docker build -f apps/__name__/Dockerfile .
FROM ghcr.io/astral-sh/uv:python3.15-trixie-slim AS build
WORKDIR /repo
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
COPY pyproject.toml uv.lock ./
COPY apps/__name__ apps/__name__
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-editable --package aip-__name__

# Same CPython minor and Debian release as the build stage so compiled wheels,
# the venv and glibc all match.
FROM python:3.15-slim-trixie
RUN groupadd --gid 65532 app && useradd --uid 65532 --gid app --no-create-home --shell /usr/sbin/nologin app
WORKDIR /app
COPY --from=build --chown=65532:65532 /repo/.venv /app/.venv
ENV PATH=/app/.venv/bin:$PATH PYTHONUNBUFFERED=1 WORKER_HEALTH_PORT=8081
EXPOSE 8081
USER 65532:65532
ENTRYPOINT ["python", "-m", "__module__.main"]
