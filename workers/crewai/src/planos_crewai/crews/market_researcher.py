"""
Crew / pipeline for ai_market_researcher_v1.

Primary engines: Liner Search Agent + Web Search (+ optional Deep Research).
Structures a citation-backed market research report for PlanOS artifacts.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from planos_crewai.liner_platform import (
    CallBudget,
    LinerPlatformClient,
    build_research_prompt,
    load_platform_config,
    normalize_references,
)
from planos_crewai.llm import LlmConfig, smoke_chat
from planos_crewai.roles import MARKET_RESEARCHER


REGION_COUNTRY = {
    "KR": "kr",
    "US": "us",
    "GLOBAL": None,
}


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _fact_vs_analysis(answer: str) -> dict[str, str]:
    """Lightweight split: Liner answer = grounded facts; short note = analysis frame."""
    text = (answer or "").strip()
    return {
        "factsFromLiner": text,
        "analysisNote": (
            "아래 구조화 섹션의 해석·제안은 Liner 검색 근거를 PlanOS가 정리한 분석 의견입니다. "
            "원문 출처 URL과 교차 확인하세요."
        ),
    }


def _structure_report(
    *,
    research_target: str,
    region: str,
    depth: str,
    task: str,
    acceptance: str,
    answer: str,
    references: list[dict[str, Any]],
    web_results: list[dict[str, Any]],
    run_id: str,
    engine: str,
) -> dict[str, Any]:
    valid_sources = [r for r in references if r.get("urlValid")]
    invalid_sources = [r for r in references if not r.get("urlValid")]
    web_sources = []
    for w in web_results:
        url = str(w.get("url") or "")
        parsed = urlparse(url)
        web_sources.append(
            {
                "title": w.get("title"),
                "url": url,
                "hostname": w.get("hostname") or parsed.hostname,
                "description": w.get("description"),
                "publishedDate": w.get("date"),
                "urlValid": parsed.scheme in {"http", "https"} and bool(parsed.netloc),
                "kind": "web_search",
            }
        )

    split = _fact_vs_analysis(answer)
    unverified: list[str] = []
    if not valid_sources and not web_sources:
        unverified.append("유효한 원문 출처 URL이 응답에 없습니다.")
    if invalid_sources:
        unverified.append(f"형식 오류 출처 {len(invalid_sources)}건 제외됨.")
    if "가격" not in answer and "pricing" not in answer.lower():
        unverified.append("공개 가격 정보가 답변에서 명확히 확인되지 않을 수 있습니다.")

    return {
        "kind": "market_research_report_v1",
        "mock": False,
        "paidLlmUsed": True,
        "agentSlug": MARKET_RESEARCHER.slug,
        "engine": engine,
        "engineFamily": "liner_platform",
        "runId": run_id,
        "asOfDate": _today(),
        "researchTarget": research_target,
        "region": region,
        "researchDepth": depth,
        "goalAndScope": {
            "goal": research_target,
            "ownerTask": task,
            "acceptanceCriteria": acceptance,
            "allowedActions": ["web_search", "report_write"],
            "forbiddenActions": ["external_post", "email_send", "arbitrary_file_edit"],
        },
        "marketOverview": answer[:4000] if answer else None,
        "competitorComparison": {
            "note": "경쟁사·기능·가격 비교는 Liner 답변과 출처를 기준으로 합니다.",
            "fromAnswer": answer,
        },
        "customerProblems": {
            "note": "고객 문제·미충족 수요는 검색 근거 기반 해석입니다.",
            "fromAnswer": answer,
        },
        "opportunitiesAndRisks": {
            "note": "시장 기회·위험은 분석 의견이며 투자 자문이 아닙니다.",
            "fromAnswer": answer,
        },
        "differentiationSuggestions": {
            "note": "차별화 제안은 분석 의견입니다.",
            "fromAnswer": answer,
        },
        "factVsAnalysis": split,
        "sources": valid_sources + [s for s in web_sources if s.get("urlValid")],
        "invalidSources": invalid_sources,
        "unverifiedOrWeakEvidence": unverified,
        "rawLinerAnswer": answer,
    }


def run_market_research(
    *,
    cfg: LlmConfig,
    project_id: str,
    run_id: str,
    contract_id: str,
    manifest_id: str,
    task: str,
    acceptance_criteria: str,
    research_target: str,
    region: str = "KR",
    research_depth: str = "standard",
    lang: str = "ko",
    documents: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Execute real Liner Search (+ optional web / deep research).
    Never returns mock:true success.
    """
    platform_cfg = load_platform_config()
    budget = CallBudget(
        max_calls=platform_cfg["max_calls"],
        max_usd=platform_cfg["max_usd"],
    )
    client = LinerPlatformClient(budget=budget)

    target = (research_target or task or "").strip()
    if len(target) < 4:
        raise ValueError("research_target too short")

    depth = (research_depth or "standard").strip().lower()
    if depth not in {"standard", "deep"}:
        depth = "standard"

    region_key = (region or "KR").strip().upper()
    country = REGION_COUNTRY.get(region_key)

    prompt = build_research_prompt(
        research_target=target,
        region=region_key,
        task=task,
        acceptance=acceptance_criteria,
    )
    if documents:
        brief_bits = []
        for d in documents[:4]:
            brief_bits.append(f"- {d.get('type')}: {(d.get('content') or '')[:400]}")
        prompt += "\n\nProject context docs:\n" + "\n".join(brief_bits)

    usage: dict[str, Any] = {
        "provider": "liner_platform",
        "routerModel": cfg.model,
        "projectId": project_id,
        "contractId": contract_id,
        "manifestId": manifest_id,
        "dryRun": client.dry_run,
    }

    if client.dry_run:
        return {
            "report": {
                "kind": "market_research_report_v1",
                "mock": False,
                "dryRun": True,
                "agentSlug": MARKET_RESEARCHER.slug,
                "error": "LINER_API_KEY missing or DRY_RUN",
            },
            "usage": {**usage, "budget": budget.to_usage()},
            "engine": "liner_search_agent",
        }

    answer = ""
    references: list[dict[str, Any]] = []
    engine = "liner_search_agent"

    if depth == "deep":
        deep = client.deep_research(
            prompt,
            lang=lang,
            request_id=f"planos-mr-deep-{run_id[:8]}",
            stream=False,
        )
        answer = str(deep.get("answer") or "")
        references = normalize_references(deep.get("references") or [])
        engine = "liner_deep_research"
    else:
        search = client.search_agent(
            prompt,
            lang=lang,
            mode="general",
            request_id=f"planos-mr-{run_id[:8]}",
            stream=False,
        )
        answer = str(search.get("answer") or "")
        references = normalize_references(search.get("references") or [])

    web_results: list[dict[str, Any]] = []
    # One cheap web search for extra public source URLs (no premium knowledge).
    if budget.call_count < budget.max_calls and budget.estimated_usd < budget.max_usd:
        web_query = f"{target} competitors pricing features {region_key}"
        try:
            web = client.web_search(
                web_query,
                country_code=country,
                lang=lang,
                max_results=6,
            )
            raw_results = web.get("results") if isinstance(web, dict) else None
            if isinstance(raw_results, list):
                web_results = [r for r in raw_results if isinstance(r, dict)]
        except Exception as web_exc:  # noqa: BLE001
            usage["webSearchError"] = str(web_exc)[:400]

    if not answer.strip() and not references and not web_results:
        raise RuntimeError("LINER_EMPTY_RESPONSE: no answer or sources")

    # Optional cheap router call to tighten Korean section labels — skipped if budget tight.
    structure_hint = None
    if (
        budget.call_count < budget.max_calls
        and budget.estimated_usd < budget.max_usd * 0.8
        and not cfg.dry_run
    ):
        try:
            structure_hint = smoke_chat(
                cfg,
                (
                    "Summarize in Korean bullets (시장현황/경쟁/가격기능/고객문제/기회위험/차별화) "
                    "without inventing sources. Text:\n"
                    + answer[:2500]
                ),
            )
            usage["structureHint"] = {
                "dryRun": structure_hint.get("dry_run"),
                "usage": structure_hint.get("usage"),
            }
        except Exception as struct_exc:  # noqa: BLE001
            usage["structureHintError"] = str(struct_exc)[:400]

    report = _structure_report(
        research_target=target,
        region=region_key,
        depth=depth,
        task=task,
        acceptance=acceptance_criteria,
        answer=answer,
        references=references,
        web_results=web_results,
        run_id=run_id,
        engine=engine,
    )
    if structure_hint and structure_hint.get("output_text"):
        report["structuredSummaryKo"] = structure_hint["output_text"]

    usage["budget"] = budget.to_usage()
    return {"report": report, "usage": usage, "engine": engine}
