"""CLI entrypoints: smoke-llm | poll | audit-local."""

from __future__ import annotations

import argparse
import json
import logging
import sys

from planos_crewai.crews.market_researcher import run_market_research
from planos_crewai.crews.requirements_auditor import run_requirements_audit
from planos_crewai.llm import load_llm_config, smoke_chat
from planos_crewai.roles import ROLE_REGISTRY
from planos_crewai.worker import poll_once


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(prog="planos-crewai-worker")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("roles", help="Print PlanOS Agent Definition registry")

    p_smoke = sub.add_parser("smoke-llm", help="One cheap Liner/OpenAI call (or dry-run)")
    p_smoke.add_argument(
        "--prompt",
        default="Reply with exactly: planos-crewai-ok",
    )

    p_poll = sub.add_parser("poll", help="Claim queued ai_runs and run CrewAI auditor")
    p_poll.add_argument("--limit", type=int, default=3)

    p_local = sub.add_parser(
        "audit-local",
        help="Run auditor on inline text without Supabase (dev)",
    )
    p_local.add_argument("--task", default="검수: 로그인 후 대시보드 진입 요구사항")
    p_local.add_argument("--acceptance", default="누락·모순·개선안 JSON 보고")
    p_local.add_argument(
        "--doc",
        action="append",
        default=[],
        help="document text; repeatable. Format type:content",
    )

    p_mr = sub.add_parser(
        "research-local",
        help="Run market research via Liner Search/Web (no Supabase)",
    )
    p_mr.add_argument(
        "--target",
        default="반려동물 예약 서비스 경쟁시장 조사 (공개 정보만)",
    )
    p_mr.add_argument("--region", default="KR", choices=["KR", "US", "GLOBAL"])
    p_mr.add_argument("--depth", default="standard", choices=["standard", "deep"])
    p_mr.add_argument("--lang", default="ko")
    p_mr.add_argument(
        "--task",
        default="공개 웹 기준으로 경쟁사·가격·기능·고객문제를 조사하세요.",
    )
    p_mr.add_argument(
        "--acceptance",
        default="출처 URL이 포함된 구조화 시장조사 보고서",
    )

    args = parser.parse_args(argv)

    if args.cmd == "roles":
        payload = {
            slug: {
                "display_name": d.display_name,
                "role": d.role,
                "skills": list(d.skills),
                "metagpt_refs": list(d.metagpt_refs),
            }
            for slug, d in ROLE_REGISTRY.items()
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    if args.cmd == "smoke-llm":
        cfg = load_llm_config()
        out = smoke_chat(cfg, args.prompt)
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 0 if out.get("output_text") else 1

    if args.cmd == "poll":
        results = poll_once(limit=args.limit)
        print(json.dumps(results, ensure_ascii=False, indent=2, default=str))
        return 0

    if args.cmd == "audit-local":
        cfg = load_llm_config()
        docs = []
        for i, raw in enumerate(args.doc or []):
            if ":" in raw:
                typ, content = raw.split(":", 1)
            else:
                typ, content = "prd", raw
            docs.append({"id": f"local-{i}", "type": typ, "content": content})
        if not docs:
            docs = [
                {
                    "id": "local-0",
                    "type": "prd",
                    "content": "사용자는 로그인 후 대시보드에 진입한다. 결제 흐름은 없다.",
                },
                {
                    "id": "local-1",
                    "type": "policy",
                    "content": "개인정보 보관 기간은 1년이다.",
                },
            ]
        out = run_requirements_audit(
            cfg=cfg,
            project_id="00000000-0000-4000-8000-000000000001",
            run_id="00000000-0000-4000-8000-000000000002",
            contract_id="00000000-0000-4000-8000-000000000003",
            manifest_id="00000000-0000-4000-8000-000000000004",
            task=args.task,
            acceptance_criteria=args.acceptance,
            documents=docs,
        )
        print(json.dumps(out, ensure_ascii=False, indent=2, default=str))
        return 0

    if args.cmd == "research-local":
        cfg = load_llm_config()
        out = run_market_research(
            cfg=cfg,
            project_id="00000000-0000-4000-8000-000000000011",
            run_id="00000000-0000-4000-8000-000000000012",
            contract_id="00000000-0000-4000-8000-000000000013",
            manifest_id="00000000-0000-4000-8000-000000000014",
            task=args.task,
            acceptance_criteria=args.acceptance,
            research_target=args.target,
            region=args.region,
            research_depth=args.depth,
            lang=args.lang,
            documents=[],
        )
        print(json.dumps(out, ensure_ascii=False, indent=2, default=str))
        report = out.get("report") or {}
        if report.get("dryRun"):
            return 1
        if not report.get("rawLinerAnswer") and not report.get("sources"):
            return 1
        return 0

    return 2


if __name__ == "__main__":
    sys.exit(main())
