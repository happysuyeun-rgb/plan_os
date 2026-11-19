"""
PlanOS Tool Registry (PR-B).

Logical allowlist for worker capabilities. Not every entry is a CrewAI BaseTool
yet — the registry is the contract for which tools a skill may invoke.
OpenHands/OpenClaw tools stay out until Phase 4 + sandbox approval.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

ToolRuntime = Literal[
    "prompt_only",
    "crewai_builtin",
    "liner_http",
    "supabase_rpc",
    "deferred_sandbox",
]


@dataclass(frozen=True)
class ToolDefinition:
    id: str
    display_name: str
    description: str
    runtime: ToolRuntime
    """Who may call this tool (skill ids). Empty = role wiring decides."""
    default_for_skills: tuple[str, ...] = field(default_factory=tuple)
    requires_secret: tuple[str, ...] = field(default_factory=tuple)
    paid_risk: bool = False
    notes: str = ""


MANIFEST_DOCUMENT_READER = ToolDefinition(
    id="manifest_document_reader",
    display_name="Manifest document reader",
    description=(
        "Read only owner-selected project documents from the run manifest. "
        "No arbitrary filesystem or cross-project access."
    ),
    runtime="prompt_only",
    default_for_skills=(
        "gap_detection",
        "contradiction_check",
        "testability_check",
        "cite_source_spans",
        "flow_coverage",
        "state_matrix",
        "a11y_risks",
        "write_prd",
        "write_ia",
        "clarify_non_goals",
    ),
    notes="Bundle is built in Python before the LLM call.",
)

STRUCTURED_FINDING_EMITTER = ToolDefinition(
    id="structured_finding_emitter",
    display_name="Structured finding emitter",
    description=(
        "Emit findings as requirements_audit_report_v1 JSON "
        "(severity/category/summary/rationale/sourceRefs)."
    ),
    runtime="prompt_only",
    default_for_skills=(
        "gap_detection",
        "contradiction_check",
        "testability_check",
        "cite_source_spans",
        "write_test",
        "defect_report",
    ),
)

CITATION_SPAN_EXTRACTOR = ToolDefinition(
    id="citation_span_extractor",
    display_name="Citation span extractor",
    description="Attach short quoted spans + documentType to each finding.",
    runtime="prompt_only",
    default_for_skills=("cite_source_spans", "citation_check"),
)

BUDGET_GATE_PROBE = ToolDefinition(
    id="budget_gate_probe",
    display_name="Budget / approval gate probe",
    description=(
        "Check that plan.approved ≠ paid enqueue and that consent/budget "
        "states remain distinct. Never invent ₩0 charges."
    ),
    runtime="prompt_only",
    default_for_skills=("budget_gate_check", "task_decomposition", "specialist_handoff"),
    paid_risk=False,
)

LINER_CHAT_COMPLETION = ToolDefinition(
    id="liner_chat_completion",
    display_name="Liner Router chat",
    description="Model chat via Liner Router (credit/free tier only).",
    runtime="liner_http",
    default_for_skills=(),
    requires_secret=("LINER_API_KEY",),
    paid_risk=False,
    notes="Gate C paid path stays closed. Dry-run when key missing.",
)

LINER_WEB_SEARCH = ToolDefinition(
    id="liner_web_search",
    display_name="Liner Search / Web",
    description="Public-web market research search. No outbound email/posting.",
    runtime="liner_http",
    default_for_skills=(
        "web_market_scan",
        "competitor_compare",
        "pricing_feature_matrix",
        "citation_check",
        "opportunity_risk_brief",
    ),
    requires_secret=("LINER_API_KEY",),
)

CLAIM_CREWAI_RUN = ToolDefinition(
    id="claim_crewai_ai_run",
    display_name="Claim CrewAI ai_run",
    description="Supabase RPC claim_crewai_ai_run for queued runs (local/Preview allowlist).",
    runtime="supabase_rpc",
    requires_secret=("SUPABASE_SERVICE_ROLE_KEY",),
)

COMPLETE_CREWAI_RUN = ToolDefinition(
    id="complete_crewai_ai_run",
    display_name="Complete CrewAI ai_run",
    description="Supabase RPC complete_crewai_ai_run with report + usage JSON.",
    runtime="supabase_rpc",
    requires_secret=("SUPABASE_SERVICE_ROLE_KEY",),
)

OPENHANDS_SANDBOX_EXEC = ToolDefinition(
    id="openhands_sandbox_exec",
    display_name="OpenHands sandbox exec (deferred)",
    description="Phase 4 only — isolated code execution after explicit approval.",
    runtime="deferred_sandbox",
    default_for_skills=("write_code", "run_tests", "diff_report", "run_test"),
    paid_risk=False,
    notes="Not wired. Do not enable without sandbox + owner consent.",
)

TOOL_REGISTRY: dict[str, ToolDefinition] = {
    t.id: t
    for t in (
        MANIFEST_DOCUMENT_READER,
        STRUCTURED_FINDING_EMITTER,
        CITATION_SPAN_EXTRACTOR,
        BUDGET_GATE_PROBE,
        LINER_CHAT_COMPLETION,
        LINER_WEB_SEARCH,
        CLAIM_CREWAI_RUN,
        COMPLETE_CREWAI_RUN,
        OPENHANDS_SANDBOX_EXEC,
    )
}


def get_tool(tool_id: str) -> ToolDefinition:
    try:
        return TOOL_REGISTRY[tool_id]
    except KeyError as exc:
        raise KeyError(f"Unknown PlanOS tool id: {tool_id}") from exc


def tools_for_skill(skill_id: str) -> tuple[ToolDefinition, ...]:
    return tuple(
        t for t in TOOL_REGISTRY.values() if skill_id in t.default_for_skills
    )
