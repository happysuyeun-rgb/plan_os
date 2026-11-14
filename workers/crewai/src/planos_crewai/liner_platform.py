"""
Liner Platform APIs for PlanOS market research (server secret only).

Docs:
  - Search Agent:   POST /api/v1/agents/search
  - Web Search:     POST /api/v1/tools/search/web
  - Deep Research:  POST /api/v1/agents/deep-research

Never import from Vite/client bundles. LINER_API_KEY must stay server-side.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

import httpx

DEFAULT_BASE_URL = "https://platform.liner.com/api/v1"


@dataclass
class LinerCallRecord:
    endpoint: str
    ok: bool
    status_code: int | None
    latency_ms: int
    request_id: str | None = None
    error: str | None = None
    estimated_cost_usd: float | None = None
    usage: dict[str, Any] = field(default_factory=dict)


@dataclass
class CallBudget:
    """Hard stop for hackathon credit: max calls + soft USD ceiling."""

    max_calls: int = 4
    max_usd: float = 5.0
    calls: list[LinerCallRecord] = field(default_factory=list)

    @property
    def call_count(self) -> int:
        return len(self.calls)

    @property
    def estimated_usd(self) -> float:
        return sum(c.estimated_cost_usd or 0.0 for c in self.calls)

    def assert_can_call(self) -> None:
        if self.call_count >= self.max_calls:
            raise RuntimeError(
                f"LINER_CALL_BUDGET_EXCEEDED: calls={self.call_count}/{self.max_calls}"
            )
        if self.estimated_usd >= self.max_usd:
            raise RuntimeError(
                f"LINER_USD_BUDGET_EXCEEDED: ~${self.estimated_usd:.4f} >= ${self.max_usd}"
            )

    def to_usage(self) -> dict[str, Any]:
        return {
            "maxCalls": self.max_calls,
            "maxUsd": self.max_usd,
            "callCount": self.call_count,
            "estimatedUsd": round(self.estimated_usd, 6),
            "calls": [
                {
                    "endpoint": c.endpoint,
                    "ok": c.ok,
                    "statusCode": c.status_code,
                    "latencyMs": c.latency_ms,
                    "requestId": c.request_id,
                    "error": c.error,
                    "estimatedCostUsd": c.estimated_cost_usd,
                    "usage": c.usage,
                }
                for c in self.calls
            ],
        }


def load_platform_config() -> dict[str, Any]:
    api_key = (os.environ.get("LINER_API_KEY") or "").strip()
    base = (os.environ.get("PLANOS_LINER_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
    max_calls = int(os.environ.get("PLANOS_MARKET_RESEARCH_MAX_CALLS") or "4")
    max_usd = float(os.environ.get("PLANOS_MARKET_RESEARCH_BUDGET_USD") or "5")
    dry = (os.environ.get("PLANOS_CREWAI_DRY_RUN") or "").strip().lower() in {
        "1",
        "true",
        "yes",
    } or not api_key
    timeout = float(os.environ.get("PLANOS_LINER_TIMEOUT_SEC") or "320")
    return {
        "api_key": api_key,
        "base_url": base,
        "dry_run": dry,
        "timeout": timeout,
        "max_calls": max(1, max_calls),
        "max_usd": max(0.1, max_usd),
    }


def _headers(api_key: str) -> dict[str, str]:
    return {
        "x-api-key": api_key,
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def validate_source_url(url: str) -> dict[str, Any]:
    """Syntactic + scheme check. Does not fetch content (cost/latency)."""
    raw = (url or "").strip()
    parsed = urlparse(raw)
    ok = parsed.scheme in {"http", "https"} and bool(parsed.netloc)
    return {
        "url": raw,
        "valid": ok,
        "hostname": parsed.hostname or "",
        "reason": None if ok else "invalid_url_scheme_or_host",
    }


class LinerPlatformClient:
    def __init__(self, budget: CallBudget | None = None) -> None:
        cfg = load_platform_config()
        self.api_key = cfg["api_key"]
        self.base_url = cfg["base_url"]
        self.dry_run = cfg["dry_run"]
        self.timeout = cfg["timeout"]
        self.budget = budget or CallBudget(
            max_calls=cfg["max_calls"], max_usd=cfg["max_usd"]
        )

    def _post(
        self,
        path: str,
        body: dict[str, Any],
        *,
        accept: str | None = None,
        estimated_cost_usd: float | None = None,
    ) -> dict[str, Any]:
        self.budget.assert_can_call()
        endpoint = path
        if self.dry_run:
            rec = LinerCallRecord(
                endpoint=endpoint,
                ok=False,
                status_code=None,
                latency_ms=0,
                error="dry_run",
                estimated_cost_usd=0.0,
            )
            self.budget.calls.append(rec)
            raise RuntimeError("LINER_DRY_RUN: LINER_API_KEY missing or DRY_RUN=true")

        url = f"{self.base_url}{path}"
        headers = _headers(self.api_key)
        if accept:
            headers["Accept"] = accept
        started = time.perf_counter()
        try:
            with httpx.Client(timeout=self.timeout) as client:
                res = client.post(url, headers=headers, json=body)
            latency = int((time.perf_counter() - started) * 1000)
            text = res.text
            request_id = res.headers.get("x-request-id") or res.headers.get(
                "x-liner-request-id"
            )
            if res.status_code >= 400:
                rec = LinerCallRecord(
                    endpoint=endpoint,
                    ok=False,
                    status_code=res.status_code,
                    latency_ms=latency,
                    request_id=request_id,
                    error=text[:800],
                    estimated_cost_usd=0.0,
                )
                self.budget.calls.append(rec)
                raise RuntimeError(
                    f"Liner {endpoint} failed: {res.status_code} {text[:500]}"
                )
            data = res.json() if text else {}
            if isinstance(data, dict):
                request_id = (
                    data.get("requestId")
                    or data.get("request_id")
                    or request_id
                )
            usage = {}
            if isinstance(data, dict) and isinstance(data.get("usage"), dict):
                usage = data["usage"]
                if usage.get("cost") is not None:
                    try:
                        estimated_cost_usd = float(usage["cost"])
                    except (TypeError, ValueError):
                        pass
            rec = LinerCallRecord(
                endpoint=endpoint,
                ok=True,
                status_code=res.status_code,
                latency_ms=latency,
                request_id=str(request_id) if request_id else None,
                estimated_cost_usd=estimated_cost_usd,
                usage=usage,
            )
            self.budget.calls.append(rec)
            return data if isinstance(data, dict) else {"raw": data}
        except RuntimeError:
            raise
        except Exception as exc:  # noqa: BLE001
            latency = int((time.perf_counter() - started) * 1000)
            rec = LinerCallRecord(
                endpoint=endpoint,
                ok=False,
                status_code=None,
                latency_ms=latency,
                error=str(exc)[:800],
                estimated_cost_usd=0.0,
            )
            self.budget.calls.append(rec)
            raise

    def search_agent(
        self,
        query: str,
        *,
        lang: str = "ko",
        mode: str = "general",
        request_id: str | None = None,
        stream: bool = False,
    ) -> dict[str, Any]:
        """Primary research engine. Prefer stream=false for first integration."""
        body: dict[str, Any] = {
            "messages": [{"role": "user", "content": query}],
            "model": None,
            "lang": lang,
            "mode": mode,
            "stream": stream,
        }
        if request_id:
            body["request_id"] = request_id
        return self._post("/agents/search", body, estimated_cost_usd=0.05)

    def web_search(
        self,
        query: str,
        *,
        country_code: str | None = None,
        lang: str = "ko",
        max_results: int = 8,
        date_range: str | None = None,
    ) -> dict[str, Any]:
        """Source URLs only — include_knowledge=false to keep $1/1k pricing."""
        body: dict[str, Any] = {
            "query": query,
            "lang": lang,
            "max_results": max(1, min(20, max_results)),
            "include_knowledge": False,
        }
        if country_code:
            body["country_code"] = country_code
        if date_range:
            body["date_range"] = date_range
        # Rough estimate: $1 / 1000 → $0.001 per call
        return self._post("/tools/search/web", body, estimated_cost_usd=0.001)

    def deep_research(
        self,
        query: str,
        *,
        lang: str = "ko",
        request_id: str | None = None,
        stream: bool = False,
    ) -> dict[str, Any]:
        """User-opt-in only. Higher cost — never auto-loop."""
        body: dict[str, Any] = {
            "messages": [{"role": "user", "content": query}],
            "lang": lang,
            "stream": stream,
        }
        if request_id:
            body["request_id"] = request_id
        return self._post(
            "/agents/deep-research",
            body,
            accept="application/json" if not stream else "text/event-stream",
            estimated_cost_usd=0.5,
        )


def normalize_references(raw: Any) -> list[dict[str, Any]]:
    refs: list[dict[str, Any]] = []
    if not isinstance(raw, list):
        return refs
    for item in raw:
        if not isinstance(item, dict):
            continue
        url = str(item.get("url") or "").strip()
        check = validate_source_url(url)
        refs.append(
            {
                "title": str(item.get("title") or "") or None,
                "url": url,
                "hostname": item.get("hostname") or check.get("hostname"),
                "description": item.get("description") or None,
                "publishedDate": item.get("date") or item.get("publishedDate") or None,
                "urlValid": check["valid"],
                "validationReason": check.get("reason"),
                "kind": "liner_reference",
            }
        )
    return refs


def build_research_prompt(
    *,
    research_target: str,
    region: str,
    task: str,
    acceptance: str,
) -> str:
    return (
        "You are PlanOS AI market researcher. Produce a grounded market research "
        "answer with inline citations where possible.\n\n"
        f"Research target: {research_target}\n"
        f"Region focus: {region}\n"
        f"Owner task: {task}\n"
        f"Acceptance criteria: {acceptance}\n\n"
        "Cover: market overview, 3-5 competitors, feature/pricing comparison when "
        "publicly available, customer problems / unmet needs, recent trends, "
        "differentiation opportunities, risks, and explicitly list unverified items.\n"
        "Use only public information. Do not invent URLs. Separate facts from analysis."
    )
