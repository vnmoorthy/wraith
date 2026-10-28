"""The UI route must never serve files outside wraith/static (e.g. .env)."""
from fastapi.testclient import TestClient

from wraith.server import app


def test_no_path_traversal():
    client = TestClient(app)
    for path in ("/..%2F..%2F.env", "/..%2F..%2FREADME.md", "/%2e%2e/%2e%2e/.env", "/../../.env"):
        res = client.get(path)
        assert "YDC_API_KEY" not in res.text and "# WRAITH" not in res.text, path
