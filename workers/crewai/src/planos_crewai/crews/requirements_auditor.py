"""
Crew for requirements_auditor_v1 — real execution path.

Keeps PlanOS staff slug stable. Separated from SQL process_mock_ai_run.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any

from planos_crewai.llm import LlmConfig, crewai_llm_kwargs, smoke_chat
from planos_crewai.roles import REQUIREMENTS_AUDITOR, AI_PM


FINDING_SCHEMA_HINT = """
Return ONLY valid JSON with this shape:
{
  "kind": "requirements_audit_report_v1",
  "mock": false,
  "paidLlmUsed": true,
  "agentSlug": "requirements_auditor_v1",
  "findings": [
    {
      "severity": "info|warning|blocker",
      "category": "missing|inconsistent|untestable|permission_or_approval|failure_recovery",
      "summary": "short title",
      "rationale": "why",
      "sourceRefs": [{"documentType": "prd|policy|wireframe|...", "excerpt": "quoted span"}]
    }
  ],
  "improvements": ["actionable suggestion"]
}
"""


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            raise
        return json.loads(match.group(0))


def build_document_bundle(docs: list[dict[str, Any]], max_chars: int = 12000) -> str:
    parts: list[str] = []
    used = 0
    for doc in docs:
        chunk = f"### type={doc.get('type')} id={doc.get('id')}\n{doc.get('content') or ''}\n"
        if used + len(chunk) > max_chars:
            remain = max_chars - used
            if remain > 200:
                parts.append(chunk[:remain] + "\n…[truncated]")
            break
        parts.append(chunk)
        used += len(chunk)
    return "\n".join(parts) if parts else "(no documents)"


def run_requirements_audit(
    *,
    cfg: LlmConfig,
    project_id: str,
    run_id: str,
    contract_id: str,
    manifest_id: str,
    task: str,
    acceptance_criteria: str,
    documents: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Prefer full CrewAI Agent/Task/Crew when installed + key present.
    Falls back to a single structured chat call (still real LLM) if Crew
    import fails — never silently returns mock:true.
    """
    bundle = build_document_bundle(documents)
    pm_brief = (
        f"AI PM ({AI_PM.slug}) handoff for project={project_id} run={run_id}:\n"
        f"Task: {task}\nAcceptance: {acceptance_criteria}\n"
        f"Assign specialist {REQUIREMENTS_AUDITOR.slug}."
    )
    auditor_prompt = (
        f"{REQUIREMENTS_AUDITOR.role}: {REQUIREMENTS_AUDITOR.goal}\n"
        f"Backstory: {REQUIREMENTS_AUDITOR.backstory}\n"
        f"Skills: {', '.join(REQUIREMENTS_AUDITOR.skills)}\n\n"
        f"{pm_brief}\n\nDocuments:\n{bundle}\n\n{FINDING_SCHEMA_HINT}"
    )

    usage_acc: dict[str, Any] = {
        "provider": cfg.provider,
        "model": cfg.model,
        "calls": [],
        "dry_run": cfg.dry_run,
    }

    if cfg.dry_run:
        report = {
            "kind": "requirements_audit_report_v1",
            "mock": False,
            "paidLlmUsed": False,
            "dryRun": True,
            "agentSlug": REQUIREMENTS_AUDITOR.slug,
            "contractId": contract_id,
            "manifestId": manifest_id,
            "projectId": project_id,
            "runId": run_id,
            "task": task,
            "acceptanceCriteria": acceptance_criteria,
            "findings": [
                {
                    "severity": "warning",
                    "category": "permission_or_approval",
                    "summary": "Dry-run: LINER_API_KEY not configured",
                    "rationale": (
                        "Worker executed without a live model call. "
                        "Set LINER_API_KEY in the worker env to enable real analysis."
                    ),
                    "sourceRefs": [],
                }
            ],
            "improvements": ["Configure LINER_API_KEY and re-enqueue the run."],
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "engine": "crewai-worker-dry-run",
        }
        usage_acc["calls"].append({"dry_run": True})
        return {"report": report, "usage": usage_acc, "engine": "dry-run"}

    engine = "openai-chat"
    raw_text = ""
    try:
        from crewai import Agent, Crew, Process, Task
        from crewai import LLM

        llm_kwargs = crewai_llm_kwargs(cfg)
        llm = LLM(**{k: v for k, v in llm_kwargs.items() if v is not None})

        pm = Agent(
            role=AI_PM.role,
            goal=AI_PM.goal,
            backstory=AI_PM.backstory,
            llm=llm,
            verbose=False,
            allow_delegation=False,
        )
        auditor = Agent(
            role=REQUIREMENTS_AUDITOR.role,
            goal=REQUIREMENTS_AUDITOR.goal,
            backstory=REQUIREMENTS_AUDITOR.backstory,
            llm=llm,
            verbose=False,
            allow_delegation=False,
        )
        plan_task = Task(
            description=(
                f"Produce a one-paragraph specialist brief for {REQUIREMENTS_AUDITOR.slug}. "
                f"Owner task: {task}. Acceptance: {acceptance_criteria}."
            ),
            expected_output="Short handoff brief for the requirements auditor.",
            agent=pm,
        )
        audit_task = Task(
            description=auditor_prompt,
            expected_output="JSON requirements_audit_report_v1 only.",
            agent=auditor,
            context=[plan_task],
        )
        crew = Crew(
            agents=[pm, auditor],
            tasks=[plan_task, audit_task],
            process=Process.sequential,
            verbose=False,
        )
        result = crew.kickoff()
        raw_text = str(result)
        engine = "crewai"
        usage_acc["calls"].append({"engine": "crewai", "chars": len(raw_text)})
    except Exception as crew_err:  # noqa: BLE001 — fall back to direct chat
        usage_acc["crew_fallback_error"] = str(crew_err)
        chat = smoke_chat(cfg, auditor_prompt)
        raw_text = chat["output_text"]
        usage_acc["calls"].append(chat.get("usage") or {})
        engine = "openai-chat-fallback"

    try:
        parsed = _extract_json(raw_text)
    except Exception:
        parsed = {
            "kind": "requirements_audit_report_v1",
            "findings": [
                {
                    "severity": "warning",
                    "category": "untestable",
                    "summary": "Model returned non-JSON; raw text preserved",
                    "rationale": raw_text[:2000],
                    "sourceRefs": [],
                }
            ],
            "improvements": [],
        }

    report = {
        **parsed,
        "kind": "requirements_audit_report_v1",
        "mock": False,
        "paidLlmUsed": not cfg.dry_run,
        "agentSlug": REQUIREMENTS_AUDITOR.slug,
        "contractId": contract_id,
        "manifestId": manifest_id,
        "projectId": project_id,
        "runId": run_id,
        "task": task,
        "acceptanceCriteria": acceptance_criteria,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "engine": engine,
        "rawPreview": raw_text[:1500],
    }
    if "findings" not in report or not isinstance(report["findings"], list):
        report["findings"] = []
    return {"report": report, "usage": usage_acc, "engine": engine}
