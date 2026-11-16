"""Worker entrypoint.

Exposes /healthz on WORKER_HEALTH_PORT so Kubernetes probes and the e2e harness
can check it the same way as the TypeScript services. The job loop (Kafka
consumer) plugs in at `run_jobs`.
"""

from __future__ import annotations

import json
import logging
import os
import signal
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

SERVICE = "__name__"
VERSION = os.environ.get("AIP_VERSION", "0.0.0-dev")


class JsonFormatter(logging.Formatter):
    """One JSON object per line, matching the TS logger's Datadog field names."""

    def format(self, record: logging.LogRecord) -> str:
        out: dict[str, Any] = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "status": record.levelname.lower(),
            "service": SERVICE,
            "version": VERSION,
            "message": record.getMessage(),
        }
        if record.exc_info:
            out["error"] = {"stack": self.formatException(record.exc_info)}
        return json.dumps(out)


def configure_logging() -> logging.Logger:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(os.environ.get("LOG_LEVEL", "INFO").upper())
    return logging.getLogger(SERVICE)


class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802 - stdlib naming
        if self.path in ("/healthz", "/readyz"):
            body = json.dumps({"status": "ok"}).encode()
            code = 200
        elif self.path == "/version":
            body = json.dumps({"version": VERSION}).encode()
            code = 200
        else:
            body, code = b"{}", 404
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
        return  # probes are noisy; request logging is off for health endpoints


def make_health_server(port: int) -> ThreadingHTTPServer:
    return ThreadingHTTPServer(("0.0.0.0", port), HealthHandler)  # noqa: S104 - container bind


def run_jobs(stop: threading.Event, log: logging.Logger) -> None:
    log.info("job loop started")
    while not stop.wait(timeout=5):
        pass
    log.info("job loop stopped")


def main() -> None:
    log = configure_logging()
    stop = threading.Event()
    server = make_health_server(int(os.environ.get("WORKER_HEALTH_PORT", "8081")))
    threading.Thread(target=server.serve_forever, daemon=True).start()

    def _shutdown(signum: int, _frame: object) -> None:
        log.info("shutting down", extra={"signal": signum})
        stop.set()

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)
    run_jobs(stop, log)
    server.shutdown()


if __name__ == "__main__":
    main()
