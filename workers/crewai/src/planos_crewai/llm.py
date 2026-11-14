"""
Model adapters for the CrewAI worker.

- Liner Router API: OpenAI-compatible base_url https://platform.liner.com/api/v1
  Env: LINER_API_KEY (server secret only — never VITE_*)
- Optional Gemini via OPENAI-compatible shim is out of scope here; PlanOS TS BFF
  keeps GEMINI_API_KEY for document generation.

CrewAI LLM uses litellm-compatible model strings. For Liner we point OpenAI
client base_url and set OPENAI_API_KEY=LINER_API_KEY when invoking.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

from openai import OpenAI


LINER_BASE_URL = "https://platform.liner.com/api/v1"
DEFAULT_LINER_MODEL = "liner-gemini-router"


@dataclass(frozen=True)
class LlmConfig:
    provider: str
    model: str
    base_url: str | None
    api_key_env: str
    monthly_call_cap: int
    dry_run: bool


def load_llm_config() -> LlmConfig:
    provider = (os.environ.get("PLANOS_CREWAI_PROVIDER") or "liner").strip().lower()
    dry = (os.environ.get("PLANOS_CREWAI_DRY_RUN") or "").strip().lower() in {
        "1",
        "true",
        "yes",
    }
    cap = int(os.environ.get("PLANOS_CREWAI_MAX_CALLS_PER_RUN") or "8")
    if provider == "liner":
        return LlmConfig(
            provider="liner",
            model=os.environ.get("PLANOS_LINER_MODEL") or DEFAULT_LINER_MODEL,
            base_url=os.environ.get("PLANOS_LINER_BASE_URL") or LINER_BASE_URL,
            api_key_env="LINER_API_KEY",
            monthly_call_cap=cap,
            dry_run=dry or not bool(os.environ.get("LINER_API_KEY")),
        )
    if provider == "openai":
        return LlmConfig(
            provider="openai",
            model=os.environ.get("PLANOS_OPENAI_MODEL") or "gpt-4o-mini",
            base_url=os.environ.get("OPENAI_BASE_URL"),
            api_key_env="OPENAI_API_KEY",
            monthly_call_cap=cap,
            dry_run=dry or not bool(os.environ.get("OPENAI_API_KEY")),
        )
    raise ValueError(f"Unsupported PLANOS_CREWAI_PROVIDER={provider}")


def openai_client(cfg: LlmConfig) -> OpenAI:
    key = os.environ.get(cfg.api_key_env)
    if not key:
        raise RuntimeError(
            f"Missing server secret {cfg.api_key_env}. "
            "Set it in the worker environment (never commit; never VITE_*)."
        )
    kwargs: dict[str, Any] = {"api_key": key}
    if cfg.base_url:
        kwargs["base_url"] = cfg.base_url
    return OpenAI(**kwargs)


def crewai_llm_kwargs(cfg: LlmConfig) -> dict[str, Any]:
    """
    Map PlanOS provider config into CrewAI LLM constructor kwargs.
    Liner is OpenAI-compatible — use openai provider with custom base_url.
    """
    key = os.environ.get(cfg.api_key_env)
    if not key and not cfg.dry_run:
        raise RuntimeError(f"Missing {cfg.api_key_env}")
    # Ensure CrewAI/litellm see the key under OPENAI_API_KEY when using Liner.
    if cfg.provider == "liner" and key:
        os.environ.setdefault("OPENAI_API_KEY", key)
        if cfg.base_url:
            os.environ.setdefault("OPENAI_API_BASE", cfg.base_url)
            os.environ.setdefault("OPENAI_BASE_URL", cfg.base_url)
    return {
        "model": cfg.model if cfg.provider != "liner" else f"openai/{cfg.model}",
        "api_key": key,
        "base_url": cfg.base_url,
    }


def smoke_chat(cfg: LlmConfig, prompt: str) -> dict[str, Any]:
    """Single cheap call for gateway verification. Records usage.cost when present."""
    if cfg.dry_run:
        return {
            "dry_run": True,
            "model": cfg.model,
            "provider": cfg.provider,
            "output_text": (
                "[dry-run] No LINER_API_KEY / provider key — skipped live call. "
                "Set LINER_API_KEY to enable real responses."
            ),
            "usage": {"input_tokens": 0, "output_tokens": 0, "cost": 0},
        }
    client = openai_client(cfg)
    # Prefer Chat Completions for widest SDK compatibility with routers.
    resp = client.chat.completions.create(
        model=cfg.model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=256,
    )
    choice = resp.choices[0].message.content or ""
    usage = getattr(resp, "usage", None)
    usage_dict: dict[str, Any] = {
        "input_tokens": getattr(usage, "prompt_tokens", None) if usage else None,
        "output_tokens": getattr(usage, "completion_tokens", None) if usage else None,
        "cost": getattr(usage, "cost", None) if usage else None,
        "raw_model": getattr(resp, "model", cfg.model),
    }
    return {
        "dry_run": False,
        "model": cfg.model,
        "provider": cfg.provider,
        "output_text": choice,
        "usage": usage_dict,
    }
