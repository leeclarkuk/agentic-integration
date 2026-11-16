import json
import threading
import urllib.request

from worker.main import make_health_server


def test_healthz_and_version() -> None:
    server = make_health_server(0)
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/healthz") as r:  # noqa: S310
            assert json.load(r) == {"status": "ok"}
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/version") as r:  # noqa: S310
            assert "version" in json.load(r)
    finally:
        server.shutdown()
