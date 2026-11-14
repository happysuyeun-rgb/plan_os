"""
Poll/claim/complete loop for CrewAI / Liner Platform runs.

process_mock_ai_run is never invoked here.
Routes by agent_contracts.agent_slug / scope_json.agentSlug.
"""

from __future__ import annotations

import logging
from typing import Any

from planos_crewai.crews.market_researcher import run_market_research
from planos_crewai.crews.requirements_auditor import run_requirements_audit
from planos_crewai.llm import load_llm_config
from planos_crewai.roles import MARKET_RESEARCHER, REQUIREMENTS_AUDITOR
from planos_crewai.supabase_adapter import SupabaseAdapter, SupabaseAdapterError

log = logging.getLogger("planos.crewai.worker")


def _agent_slug(contract: dict[str, Any]) -> str:
    scope = contract.get("scope_json") or {}
    return str(
        contract.get("agent_slug")
        or scope.get("agentSlug")
        or REQUIREMENTS_AUDITOR.slug
    )


def process_one_run(adapter: SupabaseAdapter, run: dict[str, Any]) -> dict[str, Any]:
    run_id = run["id"]
    claimed = None
    try:
        log.info("claiming run %s", run_id)
        claimed = adapter.claim_run(run_id)
        contract = adapter.fetch_contract(claimed["contract_id"])
        scope = contract.get("scope_json") or {}
        task = str(scope.get("task") or "")
        acceptance = str(scope.get("acceptanceCriteria") or "")
        docs = adapter.fetch_manifest_documents(claimed["manifest_id"])
        cfg = load_llm_config()
        slug = _agent_slug(contract)

        # Refuse to mark dry-run as a successful live model result.
        if cfg.dry_run and slug == REQUIREMENTS_AUDITOR.slug:
            return adapter.complete_run(
                run_id,
                error_code="CREWAI_DRY_RUN",
                error_message="LINER_API_KEY missing or PLANOS_CREWAI_DRY_RUN=true — refusing live success",
                usage_json={"dry_run": True, "provider": cfg.provider, "model": cfg.model},
            )

        if slug == MARKET_RESEARCHER.slug:
            research_target = str(
                scope.get("researchTarget") or scope.get("research_target") or task
            )
            region = str(scope.get("region") or "KR")
            depth = str(scope.get("researchDepth") or scope.get("research_depth") or "standard")
            lang = str(scope.get("lang") or "ko")
            out = run_market_research(
                cfg=cfg,
                project_id=claimed["project_id"],
                run_id=run_id,
                contract_id=claimed["contract_id"],
                manifest_id=claimed["manifest_id"],
                task=task,
                acceptance_criteria=acceptance,
                research_target=research_target,
                region=region,
                research_depth=depth,
                lang=lang,
                documents=docs,
            )
            if out.get("report", {}).get("dryRun") is True:
                return adapter.complete_run(
                    run_id,
                    error_code="LINER_DRY_RUN",
                    error_message="Market research dryRun — refusing mock:false success",
                    usage_json=out.get("usage") or {},
                )
            completed = adapter.complete_run(
                run_id,
                result_json=out["report"],
                usage_json=out["usage"],
            )
            log.info("run %s market research completed engine=%s", run_id, out.get("engine"))
            return completed

        if slug != REQUIREMENTS_AUDITOR.slug:
            return adapter.complete_run(
                run_id,
                error_code="UNSUPPORTED_AGENT_SLUG",
                error_message=f"Worker has no live crew for agent_slug={slug}",
                usage_json={"agentSlug": slug},
            )

        out = run_requirements_audit(
            cfg=cfg,
            project_id=claimed["project_id"],
            run_id=run_id,
            contract_id=claimed["contract_id"],
            manifest_id=claimed["manifest_id"],
            task=task,
            acceptance_criteria=acceptance,
            documents=docs,
        )
        if out.get("report", {}).get("dryRun") is True:
            return adapter.complete_run(
                run_id,
                error_code="CREWAI_DRY_RUN",
                error_message="Auditor returned dryRun — refusing mock:false success",
                usage_json=out.get("usage") or {},
            )
        completed = adapter.complete_run(
            run_id,
            result_json=out["report"],
            usage_json=out["usage"],
        )
        log.info("run %s completed engine=%s", run_id, out.get("engine"))
        return completed
    except Exception as exc:  # noqa: BLE001
        log.exception("run %s failed", run_id)
        if claimed is not None:
            try:
                return adapter.complete_run(
                    run_id,
                    error_code="CREWAI_WORKER_ERROR",
                    error_message=str(exc)[:2000],
                    usage_json={"error": str(exc)[:500]},
                )
            except Exception as complete_exc:  # noqa: BLE001
                log.exception("failed to mark run %s as failed: %s", run_id, complete_exc)
        raise


def poll_once(limit: int = 3) -> list[dict[str, Any]]:
    adapter = SupabaseAdapter()
    queued = adapter.list_queued_runs(limit=limit)
    results: list[dict[str, Any]] = []
    for run in queued:
        try:
            results.append(process_one_run(adapter, run))
        except SupabaseAdapterError as exc:
            # Skip already-claimed / racing runs; continue the batch.
            log.warning("skip run %s: %s", run.get("id"), exc)
            results.append({"id": run.get("id"), "skipped": True, "error": str(exc)})
        except Exception as exc:  # noqa: BLE001
            log.exception("skip run %s after unexpected error", run.get("id"))
            results.append({"id": run.get("id"), "skipped": True, "error": str(exc)})
    return results
