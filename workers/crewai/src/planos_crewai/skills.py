"""
PlanOS Skill Registry (PR-B).

Skill ids are the strings listed on AgentDefinition.skills in roles.py.
Each skill declares allowed tools from tools_registry — no extra OSS packages.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from planos_crewai.tools_registry import TOOL_REGISTRY, ToolDefinition, tools_for_skill


@dataclass(frozen=True)
class SkillDefinition:
    id: str
    display_name: str
    description: str
    """Explicit tool allowlist. If empty, derived from ToolDefinition.default_for_skills."""
    tool_ids: tuple[str, ...] = field(default_factory=tuple)
    executable_today: bool = True
    notes: str = ""

    def resolve_tools(self) -> tuple[ToolDefinition, ...]:
        if self.tool_ids:
            missing = [tid for tid in self.tool_ids if tid not in TOOL_REGISTRY]
            if missing:
                raise KeyError(f"Skill {self.id} references unknown tools: {missing}")
            return tuple(TOOL_REGISTRY[tid] for tid in self.tool_ids)
        return tools_for_skill(self.id)


def _skill(
    id_: str,
    display_name: str,
    description: str,
    *,
    tool_ids: tuple[str, ...] = (),
    executable_today: bool = True,
    notes: str = "",
) -> SkillDefinition:
    return SkillDefinition(
        id=id_,
        display_name=display_name,
        description=description,
        tool_ids=tool_ids,
        executable_today=executable_today,
        notes=notes,
    )


# --- requirements_auditor_v1 (first specialist; PR-B focus) ---
GAP_DETECTION = _skill(
    "gap_detection",
    "Gap detection",
    "Find missing requirements, flows, and acceptance criteria in manifest docs.",
    tool_ids=(
        "manifest_document_reader",
        "structured_finding_emitter",
        "liner_chat_completion",
    ),
)
CONTRADICTION_CHECK = _skill(
    "contradiction_check",
    "Contradiction check",
    "Flag conflicting statements across selected documents.",
    tool_ids=(
        "manifest_document_reader",
        "structured_finding_emitter",
        "liner_chat_completion",
    ),
)
TESTABILITY_CHECK = _skill(
    "testability_check",
    "Testability check",
    "Mark vague or untestable requirements that cannot be verified.",
    tool_ids=(
        "manifest_document_reader",
        "structured_finding_emitter",
        "liner_chat_completion",
    ),
)
CITE_SOURCE_SPANS = _skill(
    "cite_source_spans",
    "Cite source spans",
    "Every finding must quote a short excerpt + documentType.",
    tool_ids=(
        "manifest_document_reader",
        "citation_span_extractor",
        "structured_finding_emitter",
        "liner_chat_completion",
    ),
)

# --- AI PM ---
TASK_DECOMPOSITION = _skill(
    "task_decomposition",
    "Task decomposition",
    "Break owner goals into ordered tasks without auto-enqueue paid runs.",
    tool_ids=("budget_gate_probe", "liner_chat_completion"),
)
ACCEPTANCE_CRITERIA = _skill(
    "acceptance_criteria",
    "Acceptance criteria",
    "Write measurable acceptance criteria for each task.",
    tool_ids=("liner_chat_completion",),
)
SPECIALIST_HANDOFF = _skill(
    "specialist_handoff",
    "Specialist handoff",
    "Assign a staff slug and brief; plan.approved ≠ execution queued.",
    tool_ids=("budget_gate_probe", "liner_chat_completion"),
)
BUDGET_GATE_CHECK = _skill(
    "budget_gate_check",
    "Budget gate check",
    "Refuse unpaid success claims; keep consent/budget/execution distinct.",
    tool_ids=("budget_gate_probe",),
)

# --- service planner ---
WRITE_PRD = _skill(
    "write_prd",
    "Write PRD",
    "Structure PRD-style requirements from owner intent.",
    tool_ids=("manifest_document_reader", "liner_chat_completion"),
    executable_today=False,
    notes="Definition only until dedicated crew ships.",
)
WRITE_IA = _skill(
    "write_ia",
    "Write IA",
    "Propose information architecture outline.",
    tool_ids=("manifest_document_reader", "liner_chat_completion"),
    executable_today=False,
)
CLARIFY_NON_GOALS = _skill(
    "clarify_non_goals",
    "Clarify non-goals",
    "Explicitly list out-of-scope items.",
    tool_ids=("manifest_document_reader", "liner_chat_completion"),
    executable_today=False,
)

# --- UX auditor ---
FLOW_COVERAGE = _skill(
    "flow_coverage",
    "Flow coverage",
    "Check primary user flows for missing steps.",
    tool_ids=("manifest_document_reader", "structured_finding_emitter"),
    executable_today=False,
)
STATE_MATRIX = _skill(
    "state_matrix",
    "State matrix",
    "Empty/error/permission UI states coverage.",
    tool_ids=("manifest_document_reader", "structured_finding_emitter"),
    executable_today=False,
)
A11Y_RISKS = _skill(
    "a11y_risks",
    "Accessibility risks",
    "Flag obvious a11y gaps without claiming audit certification.",
    tool_ids=("manifest_document_reader", "structured_finding_emitter"),
    executable_today=False,
)

# --- developer / QA (sandbox deferred) ---
WRITE_CODE = _skill(
    "write_code",
    "Write code",
    "Implement approved tasks in an isolated workspace.",
    tool_ids=("openhands_sandbox_exec",),
    executable_today=False,
    notes="Phase 4 OpenHands.",
)
RUN_TESTS = _skill(
    "run_tests",
    "Run tests",
    "Execute project tests inside sandbox.",
    tool_ids=("openhands_sandbox_exec",),
    executable_today=False,
)
DIFF_REPORT = _skill(
    "diff_report",
    "Diff report",
    "Summarize file diffs from sandbox work.",
    tool_ids=("openhands_sandbox_exec",),
    executable_today=False,
)
WRITE_TEST = _skill(
    "write_test",
    "Write test",
    "Author tests from acceptance criteria.",
    tool_ids=("structured_finding_emitter", "openhands_sandbox_exec"),
    executable_today=False,
)
RUN_TEST = _skill(
    "run_test",
    "Run test",
    "Run authored tests and capture failures.",
    tool_ids=("openhands_sandbox_exec",),
    executable_today=False,
)
DEFECT_REPORT = _skill(
    "defect_report",
    "Defect report",
    "Open defects with repro steps.",
    tool_ids=("structured_finding_emitter",),
    executable_today=False,
)

# --- market researcher ---
WEB_MARKET_SCAN = _skill(
    "web_market_scan",
    "Web market scan",
    "Public-web scan via Liner Search/Web.",
    tool_ids=("liner_web_search", "liner_chat_completion"),
)
COMPETITOR_COMPARE = _skill(
    "competitor_compare",
    "Competitor compare",
    "Compare 3–5 competitors with citations.",
    tool_ids=("liner_web_search", "liner_chat_completion", "citation_span_extractor"),
)
PRICING_FEATURE_MATRIX = _skill(
    "pricing_feature_matrix",
    "Pricing / feature matrix",
    "Tabulate pricing and features from public sources.",
    tool_ids=("liner_web_search", "liner_chat_completion"),
)
CITATION_CHECK = _skill(
    "citation_check",
    "Citation check",
    "Keep facts tied to source URLs; label opinions.",
    tool_ids=("liner_web_search", "citation_span_extractor"),
)
OPPORTUNITY_RISK_BRIEF = _skill(
    "opportunity_risk_brief",
    "Opportunity / risk brief",
    "Short opportunity and risk summary for the owner.",
    tool_ids=("liner_web_search", "liner_chat_completion"),
)

SKILL_REGISTRY: dict[str, SkillDefinition] = {
    s.id: s
    for s in (
        GAP_DETECTION,
        CONTRADICTION_CHECK,
        TESTABILITY_CHECK,
        CITE_SOURCE_SPANS,
        TASK_DECOMPOSITION,
        ACCEPTANCE_CRITERIA,
        SPECIALIST_HANDOFF,
        BUDGET_GATE_CHECK,
        WRITE_PRD,
        WRITE_IA,
        CLARIFY_NON_GOALS,
        FLOW_COVERAGE,
        STATE_MATRIX,
        A11Y_RISKS,
        WRITE_CODE,
        RUN_TESTS,
        DIFF_REPORT,
        WRITE_TEST,
        RUN_TEST,
        DEFECT_REPORT,
        WEB_MARKET_SCAN,
        COMPETITOR_COMPARE,
        PRICING_FEATURE_MATRIX,
        CITATION_CHECK,
        OPPORTUNITY_RISK_BRIEF,
    )
}


def get_skill(skill_id: str) -> SkillDefinition:
    try:
        return SKILL_REGISTRY[skill_id]
    except KeyError as exc:
        raise KeyError(f"Unknown PlanOS skill id: {skill_id}") from exc


def skills_payload(skill_ids: tuple[str, ...]) -> list[dict]:
    out: list[dict] = []
    for sid in skill_ids:
        skill = get_skill(sid)
        tools = skill.resolve_tools()
        out.append(
            {
                "id": skill.id,
                "display_name": skill.display_name,
                "description": skill.description,
                "executable_today": skill.executable_today,
                "tools": [
                    {
                        "id": t.id,
                        "runtime": t.runtime,
                        "paid_risk": t.paid_risk,
                    }
                    for t in tools
                ],
                "notes": skill.notes,
            }
        )
    return out
