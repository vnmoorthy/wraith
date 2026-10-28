"""You.com grounding: Web Search (with highlights) and Contents.

Auth is the X-API-Key header, not a bearer token. Every response carries
X-RateLimit-Remaining / X-RateLimit-Reset; a 429 carries Retry-After, which we honour.
"""
from __future__ import annotations

import asyncio
import time

import httpx

from . import config

SEARCH_URL = "https://ydc-index.io/v1/search"
CONTENTS_URL = "https://ydc-index.io/v1/contents"


class YouError(RuntimeError):
    pass


_client: httpx.AsyncClient | None = None
_lock = asyncio.Semaphore(6)  # stay well under 10 req/s per endpoint


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0))
    return _client


async def _post(url: str, body: dict, attempts: int = 3) -> dict:
    if not config.YDC_API_KEY:
        raise YouError("YDC_API_KEY is not set")
    headers = {"X-API-Key": config.YDC_API_KEY, "Content-Type": "application/json"}
    delay = 1.0
    for attempt in range(attempts):
        async with _lock:
            res = await _http().post(url, json=body, headers=headers)
        if res.status_code == 429 and attempt < attempts - 1:
            wait = float(res.headers.get("Retry-After") or delay)
            await asyncio.sleep(min(wait, 8.0))
            delay *= 2
            continue
        if res.status_code >= 400:
            raise YouError(f"You.com {url.rsplit('/', 1)[-1]} answered {res.status_code}: {res.text[:200]}")
        return res.json()
    raise YouError("You.com rate limit persisted")


def _flatten(results: dict) -> list[dict]:
    hits = []
    for bucket in ("news", "web"):
        for h in results.get(bucket) or []:
            url = h.get("url")
            if not url:
                continue
            snippets = h.get("snippets") or []
            highlights = (h.get("contents") or {}).get("highlights") or h.get("highlights") or []
            hits.append({
                "kind": bucket,
                "title": h.get("title") or url,
                "url": url,
                "description": h.get("description") or "",
                "snippets": [s for s in (highlights or snippets) if isinstance(s, str)][:3],
                "page_age": h.get("page_age") or h.get("age") or "",
                "favicon": h.get("favicon_url") or "",
            })
    return hits


async def search(query: str, count: int = 6, highlights: bool = True) -> dict:
    """Live web + news results for a query, with answer passages when highlights=True."""
    t0 = time.perf_counter()
    body: dict = {"query": query, "count": min(count, 50)}
    if highlights:
        # Query-relevant passages instead of whole pages keeps each agent's context small.
        body["extraction"] = {"extraction_mode": "highlights", "highlights": {"total_max_tokens": 2048}}
    try:
        data = await _post(SEARCH_URL, body)
    except YouError as exc:
        if not highlights or "422" not in str(exc):
            raise
        body.pop("extraction")
        data = await _post(SEARCH_URL, body)
    hits = _flatten(data.get("results") or {})
    return {
        "query": query,
        "hits": hits,
        "latency_ms": int((time.perf_counter() - t0) * 1000),
        "search_uuid": (data.get("metadata") or {}).get("search_uuid"),
    }


async def contents(urls: list[str], fmt: str = "markdown", max_chars: int = 2500) -> list[dict]:
    """Clean page content for URLs we already know."""
    if not urls:
        return []
    data = await _post(CONTENTS_URL, {"urls": urls[:10], "formats": [fmt]})
    pages = data if isinstance(data, list) else data.get("results") or data.get("contents") or []
    out = []
    for p in pages:
        text = p.get(fmt) or p.get("markdown") or p.get("html") or p.get("text") or ""
        out.append({"url": p.get("url"), "title": p.get("title") or "", "text": (text or "")[:max_chars]})
    return out
