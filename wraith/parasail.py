"""Parasail: the second brain. OpenAI-compatible inference, streaming, schema-locked JSON, embeddings."""
from __future__ import annotations

import asyncio
import json
import re
from typing import AsyncIterator

from openai import AsyncOpenAI, APIStatusError

from . import config


class ParasailError(RuntimeError):
    pass


_client: AsyncOpenAI | None = None


def client() -> AsyncOpenAI:
    global _client
    if not config.PARASAIL_API_KEY:
        raise ParasailError("PARASAIL_API_KEY is not set")
    if _client is None:
        _client = AsyncOpenAI(base_url=config.PARASAIL_BASE_URL, api_key=config.PARASAIL_API_KEY,
                              max_retries=0, timeout=120)
    return _client


async def _retry(fn, attempts: int = 4):
    delay = 2.0
    for i in range(attempts):
        try:
            return await fn()
        except APIStatusError as exc:
            if exc.status_code in (429, 502, 503, 504) and i < attempts - 1:
                retry_after = exc.response.headers.get("retry-after") if exc.response is not None else None
                await asyncio.sleep(min(float(retry_after or delay), 15))
                delay *= 2
                continue
            raise ParasailError(f"Parasail {exc.status_code}: {str(exc.message)[:240]}") from exc


async def list_models() -> list[str]:
    res = await _retry(lambda: client().models.list())
    return sorted(m.id for m in res.data)


async def chat(messages: list[dict], model: str | None = None, max_tokens: int = 1200,
               temperature: float = 0.3, schema: dict | None = None, schema_name: str = "out") -> str:
    kwargs: dict = {}
    if config.fast_body(model or config.MODEL_SWARM):
        kwargs["extra_body"] = config.fast_body(model or config.MODEL_SWARM)
    if schema is not None:
        kwargs["response_format"] = {"type": "json_schema",
                                     "json_schema": {"name": schema_name, "schema": schema, "strict": True}}
    res = await _retry(lambda: client().chat.completions.create(
        model=model or config.MODEL_SWARM, messages=messages, max_tokens=max_tokens,
        temperature=temperature, **kwargs))
    return res.choices[0].message.content or ""


async def chat_json(messages: list[dict], schema: dict, model: str | None = None, max_tokens: int = 1500,
                    temperature: float = 0.2, schema_name: str = "out") -> dict:
    text = await chat(messages, model=model, max_tokens=max_tokens, temperature=temperature,
                      schema=schema, schema_name=schema_name)
    return parse_json(text)


async def stream(messages: list[dict], model: str | None = None, max_tokens: int = 2500,
                 temperature: float = 0.4, schema: dict | None = None,
                 schema_name: str = "manifest") -> AsyncIterator[str]:
    """Yield content deltas as the model writes them (SSE under the hood)."""
    kwargs: dict = {}
    if config.fast_body(model or config.MODEL_COMPILER):
        kwargs["extra_body"] = config.fast_body(model or config.MODEL_COMPILER)
    if schema is not None:
        kwargs["response_format"] = {"type": "json_schema",
                                     "json_schema": {"name": schema_name, "schema": schema, "strict": True}}
    res = await _retry(lambda: client().chat.completions.create(
        model=model or config.MODEL_COMPILER, messages=messages, max_tokens=max_tokens,
        temperature=temperature, stream=True, **kwargs))
    async for chunk in res:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        piece = getattr(delta, "content", None)
        if piece:
            yield piece


async def embed(texts: list[str], model: str | None = None) -> list[list[float]]:
    out: list[list[float]] = []
    for i in range(0, len(texts), 32):
        batch = texts[i:i + 32]
        res = await _retry(lambda: client().embeddings.create(model=model or config.MODEL_EMBED, input=batch))
        out.extend(d.embedding for d in sorted(res.data, key=lambda d: d.index))
    return out


_TYPO = str.maketrans({"\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2212": "-", "\u202f": " ", "\u2009": " ", "\u00a0": " "})


def clean(text: str) -> str:
    """Models love non-breaking hyphens and narrow spaces; display fonts render them badly."""
    return (text or "").translate(_TYPO)


def parse_json(text: str) -> dict:
    """Parse a JSON object out of a reply, tolerating fences, think-blocks or text around it."""
    text = clean(re.sub(r"<think>.*?</think>", "", text or "", flags=re.S)).strip()
    fence = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.S)
    if fence:
        text = fence.group(1)
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        if start < 0:
            raise ParasailError(f"model did not return JSON: {text[:160]!r}") from None
        # A stray comma or truncated tail must not cost the whole manifest: repair, keep what is complete.
        from json_repair import repair_json
        value = json.loads(repair_json(text[start:]))
    if not isinstance(value, dict):
        raise ParasailError("expected a JSON object")
    return value
