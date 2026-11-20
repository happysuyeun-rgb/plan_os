"""
Job-role Agent Definitions for PlanOS.

MetaGPT reference (MIT, https://github.com/FoundationAgents/MetaGPT):
  - metagpt/roles/product_manager.py — PRD / requirement structuring
  - metagpt/roles/architect.py — system design handoff
  - metagpt/roles/engineer.py — implementation
  - metagpt/roles/qa_engineer.py — test / defect loop
  - metagpt/roles/project_manager.py — task decomposition & assignment
  - metagpt/actions/* — WritePRD, WriteDesign, WriteCode, WriteTest, RunCode

PlanOS maps those procedures into durable Agent Definitions below.
Prompts alone are not "done" — crews in crews/*.py bind these defs to Tasks.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from planos_crewai.skills import SkillDefinition
    from planos_crewai.tools_registry import ToolDefinition


@dataclass(frozen=True)
class AgentDefinition:
    """Stable PlanOS staff identity — slug must match catalog / contract scope."""

    slug: str
    display_name: str
    role: str
    goal: str
    backstory: str
    skills: tuple[str, ...] = field(default_factory=tuple)
    metagpt_refs: tuple[str, ...] = field(default_factory=tuple)
    """Crew module that can execute this role today (empty = definition only)."""
    executable_crew: str = ""

    def resolved_skills(self) -> tuple["SkillDefinition", ...]:
        from planos_crewai.skills import get_skill

        return tuple(get_skill(sid) for sid in self.skills)

    def allowed_tools(self) -> tuple["ToolDefinition", ...]:
        seen: dict[str, "ToolDefinition"] = {}
        for skill in self.resolved_skills():
            for tool in skill.resolve_tools():
                seen[tool.id] = tool
        return tuple(seen.values())

    def skill_tool_contract(self) -> dict:
        from planos_crewai.skills import skills_payload

        return {
            "slug": self.slug,
            "executable_crew": self.executable_crew,
            "skills": skills_payload(self.skills),
            "tools": [
                {
                    "id": t.id,
                    "display_name": t.display_name,
                    "runtime": t.runtime,
                    "paid_risk": t.paid_risk,
                    "requires_secret": list(t.requires_secret),
                }
                for t in self.allowed_tools()
            ],
        }


AI_PM = AgentDefinition(
    slug="ai_pm_v1",
    display_name="AI PM",
    role="AI Project Manager",
    goal=(
        "Decompose owner goals into ordered review/execution tasks with "
        "acceptance criteria, without spending budget or calling specialists "
        "until the owner explicitly approves."
    ),
    backstory=(
        "You follow PlanOS TF-13/14: plan draft is free of paid execution. "
        "You assign specialists by job slug and never claim a plan.approved "
        "state means a paid run is queued."
    ),
    skills=(
        "task_decomposition",
        "acceptance_criteria",
        "specialist_handoff",
        "budget_gate_check",
    ),
    metagpt_refs=(
        "metagpt/roles/project_manager.py",
        "metagpt/actions/project_management.py",
    ),
    executable_crew="crews.requirements_auditor (PM handoff agent only)",
)

SERVICE_PLANNER = AgentDefinition(
    slug="service_planner_v1",
    display_name="서비스 기획자",
    role="Service Product Planner",
    goal="Produce coherent PRD/IA style requirements from owner intent and prior docs.",
    backstory=(
        "You mirror MetaGPT ProductManager WritePRD discipline: clarify users, "
        "flows, constraints, and non-goals before any engineer work."
    ),
    skills=("write_prd", "write_ia", "clarify_non_goals"),
    metagpt_refs=(
        "metagpt/roles/product_manager.py",
        "metagpt/actions/write_prd.py",
    ),
    executable_crew="",
)

REQUIREMENTS_AUDITOR = AgentDefinition(
    slug="requirements_auditor_v1",
    display_name="기획 검수 전문가",
    role="Requirements Auditor",
    goal=(
        "Find missing, contradictory, untestable, and approval-gated requirements "
        "in selected project documents and return a structured audit report."
    ),
    backstory=(
        "You are PlanOS first specialist (STAFF). You only analyze provided "
        "manifest documents. You never invent unpaid LLM success or hide gaps."
    ),
    skills=(
        "gap_detection",
        "contradiction_check",
        "testability_check",
        "cite_source_spans",
    ),
    metagpt_refs=(
        "metagpt/roles/qa_engineer.py",
        "metagpt/actions/write_test.py",
    ),
    executable_crew="crews.requirements_auditor",
)

UX_AUDITOR = AgentDefinition(
    slug="ux_ui_auditor_v1",
    display_name="UX/UI 검수 전문가",
    role="UX/UI Auditor",
    goal="Review IA/wireframe consistency, empty/error/permission states, and a11y risks.",
    backstory="You extend MetaGPT QA review toward interaction and visual contract checks.",
    skills=("flow_coverage", "state_matrix", "a11y_risks"),
    metagpt_refs=("metagpt/roles/qa_engineer.py",),
    executable_crew="",
)

DEVELOPER = AgentDefinition(
    slug="developer_v1",
    display_name="개발자",
    role="Implementation Engineer",
    goal="Implement approved tasks in an isolated workspace and report file diffs.",
    backstory=(
        "Mapped from MetaGPT Engineer WriteCode/RunCode. OpenHands may later "
        "host the sandbox; this definition stays stable."
    ),
    skills=("write_code", "run_tests", "diff_report"),
    metagpt_refs=(
        "metagpt/roles/engineer.py",
        "metagpt/actions/write_code.py",
        "metagpt/actions/run_code.py",
    ),
    executable_crew="",
)

QA_ENGINEER = AgentDefinition(
    slug="qa_engineer_v1",
    display_name="QA 엔지니어",
    role="QA Engineer",
    goal="Design and execute tests against acceptance criteria; open defects with repro steps.",
    backstory="Direct MetaGPT QAEngineer loop: WriteTest → RunCode → report failures.",
    skills=("write_test", "run_test", "defect_report"),
    metagpt_refs=(
        "metagpt/roles/qa_engineer.py",
        "metagpt/actions/write_test.py",
        "metagpt/actions/run_code.py",
    ),
    executable_crew="",
)

MARKET_RESEARCHER = AgentDefinition(
    slug="ai_market_researcher_v1",
    display_name="AI 시장조사·리서치 전문가",
    role="Market Research Analyst",
    goal=(
        "Run public-web market research via Liner Search/Web APIs, compare 3–5 "
        "competitors, and produce a citation-backed report. No external posting, "
        "email, or arbitrary file edits."
    ),
    backstory=(
        "You are a PlanOS specialist staff role. You only use owner-approved "
        "Liner Platform search tools. Facts must stay tied to source URLs; "
        "analysis opinions must be labeled separately."
    ),
    skills=(
        "web_market_scan",
        "competitor_compare",
        "pricing_feature_matrix",
        "citation_check",
        "opportunity_risk_brief",
    ),
    metagpt_refs=(
        "metagpt/roles/product_manager.py",
        "metagpt/actions/write_prd.py",
    ),
    executable_crew="crews.market_researcher",
)

ROLE_REGISTRY: dict[str, AgentDefinition] = {
    d.slug: d
    for d in (
        AI_PM,
        SERVICE_PLANNER,
        REQUIREMENTS_AUDITOR,
        UX_AUDITOR,
        DEVELOPER,
        QA_ENGINEER,
        MARKET_RESEARCHER,
    )
}


def get_role(slug: str) -> AgentDefinition:
    try:
        return ROLE_REGISTRY[slug]
    except KeyError as exc:
        raise KeyError(f"Unknown PlanOS agent slug: {slug}") from exc


def validate_role_registry() -> None:
    """Fail fast if any role skill is missing from SKILL_REGISTRY."""
    from planos_crewai.skills import SKILL_REGISTRY

    for slug, role in ROLE_REGISTRY.items():
        missing = [sid for sid in role.skills if sid not in SKILL_REGISTRY]
        if missing:
            raise KeyError(f"Role {slug} has unregistered skills: {missing}")
        # Force tool resolution (raises on bad tool ids)
        for skill in role.resolved_skills():
            skill.resolve_tools()


validate_role_registry()
