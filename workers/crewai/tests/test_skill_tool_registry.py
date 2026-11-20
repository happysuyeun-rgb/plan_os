"""PR-B: Agent Definition ↔ Skill ↔ Tool registry integrity."""

from __future__ import annotations

from planos_crewai.roles import ROLE_REGISTRY, REQUIREMENTS_AUDITOR, validate_role_registry
from planos_crewai.skills import SKILL_REGISTRY, get_skill
from planos_crewai.tools_registry import TOOL_REGISTRY, get_tool


def test_validate_role_registry_ok() -> None:
    validate_role_registry()


def test_every_role_skill_is_registered() -> None:
    for slug, role in ROLE_REGISTRY.items():
        for sid in role.skills:
            assert sid in SKILL_REGISTRY, f"{slug} missing skill {sid}"


def test_requirements_auditor_contract_has_core_skills_and_tools() -> None:
    contract = REQUIREMENTS_AUDITOR.skill_tool_contract()
    skill_ids = {s["id"] for s in contract["skills"]}
    assert skill_ids == {
        "gap_detection",
        "contradiction_check",
        "testability_check",
        "cite_source_spans",
    }
    tool_ids = {t["id"] for t in contract["tools"]}
    assert "manifest_document_reader" in tool_ids
    assert "structured_finding_emitter" in tool_ids
    assert "citation_span_extractor" in tool_ids
    assert "liner_chat_completion" in tool_ids
    assert "openhands_sandbox_exec" not in tool_ids
    assert contract["executable_crew"] == "crews.requirements_auditor"


def test_deferred_sandbox_tools_not_executable_today() -> None:
    write_code = get_skill("write_code")
    assert write_code.executable_today is False
    tools = write_code.resolve_tools()
    assert tools[0].id == "openhands_sandbox_exec"
    assert tools[0].runtime == "deferred_sandbox"


def test_tool_lookup() -> None:
    assert get_tool("manifest_document_reader").runtime == "prompt_only"
    assert "liner_web_search" in TOOL_REGISTRY
