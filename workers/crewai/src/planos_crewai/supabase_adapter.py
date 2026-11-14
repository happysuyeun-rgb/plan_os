"""
Supabase REST adapter for PlanOS ai_runs queue.

Uses SERVICE_ROLE against loopback (or explicitly allow-listed) API URL only.
Does NOT call process_mock_ai_run — that path stays Mock-only in TS/SQL.

Real transitions use local_only RPCs:
  - claim_crewai_ai_run(p_run_id)
  - complete_crewai_ai_run(p_run_id, p_result_json, p_error_code, p_error_message, p_usage_json)
"""

from __future__ import annotations

import os
import re
from typing import Any

import httpx

LOOPBACK = re.compile(r"^https?://(127\.0\.0\.1|localhost)(:\d+)?(/.*)?$", re.I)


class SupabaseAdapterError(RuntimeError):
    pass


class SupabaseAdapter:
    def __init__(
        self,
        api_url: str | None = None,
        service_key: str | None = None,
        *,
        allow_non_loopback: bool = False,
    ) -> None:
        self.api_url = (api_url or os.environ.get("PLANOS_LOCAL_API_URL") or "").rstrip("/")
        self.service_key = service_key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
        if not self.api_url or not self.service_key:
            raise SupabaseAdapterError(
                "PLANOS_LOCAL_API_URL and SUPABASE_SERVICE_ROLE_KEY are required"
            )
        if not allow_non_loopback and not LOOPBACK.match(self.api_url):
            raise SupabaseAdapterError(
                f"Refusing non-loopback API URL for CrewAI worker: {self.api_url}"
            )

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def rpc(self, name: str, payload: dict[str, Any]) -> Any:
        url = f"{self.api_url}/rest/v1/rpc/{name}"
        with httpx.Client(timeout=60.0) as client:
            res = client.post(url, headers=self._headers(), json=payload)
        if res.status_code >= 400:
            raise SupabaseAdapterError(f"RPC {name} failed: {res.status_code} {res.text}")
        if not res.content:
            return None
        return res.json()

    def list_queued_runs(self, limit: int = 5) -> list[dict[str, Any]]:
        url = (
            f"{self.api_url}/rest/v1/ai_runs"
            f"?status=eq.queued&order=created_at.asc&limit={limit}"
            f"&select=id,project_id,contract_id,manifest_id,status,version,created_at"
        )
        with httpx.Client(timeout=30.0) as client:
            res = client.get(url, headers=self._headers())
        if res.status_code >= 400:
            raise SupabaseAdapterError(f"list queued failed: {res.status_code} {res.text}")
        return res.json()

    def fetch_contract(self, contract_id: str) -> dict[str, Any]:
        url = (
            f"{self.api_url}/rest/v1/agent_contracts"
            f"?id=eq.{contract_id}&select=*&limit=1"
        )
        with httpx.Client(timeout=30.0) as client:
            res = client.get(url, headers=self._headers())
        if res.status_code >= 400:
            raise SupabaseAdapterError(f"contract fetch failed: {res.status_code} {res.text}")
        rows = res.json()
        if not rows:
            raise SupabaseAdapterError(f"contract not found: {contract_id}")
        return rows[0]

    def fetch_manifest_documents(self, manifest_id: str) -> list[dict[str, Any]]:
        """Load documents listed in audit_source_manifests.sources[].documentId."""
        url = (
            f"{self.api_url}/rest/v1/audit_source_manifests"
            f"?id=eq.{manifest_id}&select=id,project_id,sources&limit=1"
        )
        with httpx.Client(timeout=30.0) as client:
            res = client.get(url, headers=self._headers())
        if res.status_code >= 400:
            raise SupabaseAdapterError(f"manifest fetch failed: {res.status_code} {res.text}")
        rows = res.json()
        if not rows:
            return []
        sources = rows[0].get("sources") or []
        doc_ids = [
            s.get("documentId")
            for s in sources
            if isinstance(s, dict) and s.get("documentId")
        ]
        if not doc_ids:
            return []
        ids = ",".join(str(i) for i in doc_ids)
        docs_url = (
            f"{self.api_url}/rest/v1/documents"
            f"?id=in.({ids})&select=id,type,content,project_id"
        )
        with httpx.Client(timeout=30.0) as client:
            docs = client.get(docs_url, headers=self._headers())
        if docs.status_code >= 400:
            raise SupabaseAdapterError(f"documents fetch failed: {docs.status_code} {docs.text}")
        return docs.json()

    def claim_run(self, run_id: str) -> dict[str, Any]:
        return self.rpc("claim_crewai_ai_run", {"p_run_id": run_id})

    def complete_run(
        self,
        run_id: str,
        *,
        result_json: dict[str, Any] | None = None,
        error_code: str | None = None,
        error_message: str | None = None,
        usage_json: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return self.rpc(
            "complete_crewai_ai_run",
            {
                "p_run_id": run_id,
                "p_result_json": result_json,
                "p_error_code": error_code,
                "p_error_message": error_message,
                "p_usage_json": usage_json or {},
            },
        )
