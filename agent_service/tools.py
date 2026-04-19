# Tool-Definitionen + Executor-Dispatch für den Anthropic Tool-Use Loop.
# Read-Tools sind Side-Effect-frei, Write-Tools mutieren das in-memory `draft`.
# Alle Write-Tools validieren IDs gegen das Layout-Skeleton.

import json
import sys
from pathlib import Path

from . import db
from . import rag_tool
from . import state

REPO_ROOT = Path(__file__).parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

VALID_FLAG_KINDS = {"process", "operator"}
VALID_BOM_FLAGS = {"design-issue", "supply-issue"}
VALID_BATCH_STATUS = {"ok", "suspect", "bad"}
VALID_RISK_REASON = {"supply", "design"}
VALID_INV_SEVERITY = {"critical", "high", "low"}


TOOL_DEFS: list[dict] = [
    {
        "name": "list_known_queries",
        "description": "Lists named SQL queries available via run_known_query. Always call this first to see what's available.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "run_known_query",
        "description": "Executes a named SQL query and returns rows (max 200). Prefer this over query_db.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Name from list_known_queries"},
            },
            "required": ["name"],
        },
    },
    {
        "name": "query_db",
        "description": "Executes a free-form SELECT query against Manex Postgres. Allowlist: must start with SELECT or WITH, no writes.",
        "input_schema": {
            "type": "object",
            "properties": {"sql": {"type": "string"}},
            "required": ["sql"],
        },
    },
    {
        "name": "rag_search",
        "description": "Semantic search over indexed documents (Qdrant). Returns up to top_k chunks.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "top_k": {"type": "integer", "default": 5, "minimum": 1, "maximum": 10},
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_current_state",
        "description": "Returns the previous snapshot. Use it to diff your current understanding against the last run.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "verify_consistency",
        "description": "Runs deterministic SQL consistency rules from agent/verify.py. Returns rule violations.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },

    {
        "name": "set_node_error_count",
        "description": "Sets the error badge count on a top-level canvas node (sup-01, fac-aug, field, articles, etc.).",
        "input_schema": {
            "type": "object",
            "properties": {
                "nodeId": {"type": "string"},
                "count": {"type": "integer", "minimum": 0},
            },
            "required": ["nodeId", "count"],
        },
    },
    {
        "name": "set_node_subtitle",
        "description": "Sets the subtitle string under a top-level canvas node.",
        "input_schema": {
            "type": "object",
            "properties": {
                "nodeId": {"type": "string"},
                "subtitle": {"type": "string"},
            },
            "required": ["nodeId", "subtitle"],
        },
    },
    {
        "name": "set_batch_severity",
        "description": "Marks a supplier batch as ok/suspect/bad. The batch is auto-populated by the DB-refresh phase; you only mark severity.",
        "input_schema": {
            "type": "object",
            "properties": {
                "supplierNodeId": {"type": "string"},
                "batchId": {"type": "string"},
                "status": {"type": "string", "enum": ["ok", "suspect", "bad"]},
                "events": {"type": "integer", "minimum": 0},
            },
            "required": ["supplierNodeId", "batchId", "status"],
        },
    },
    {
        "name": "set_section_case_flag",
        "description": "Flags or un-flags a factory section as the locus of a process or operator issue. Pass null/omit flag to clear.",
        "input_schema": {
            "type": "object",
            "properties": {
                "factoryNodeId": {"type": "string"},
                "sectionId": {"type": "string"},
                "flag": {
                    "type": ["object", "null"],
                    "properties": {
                        "kind": {"type": "string", "enum": ["process", "operator"]},
                        "title": {"type": "string"},
                        "detail": {"type": "string"},
                    },
                    "required": ["kind", "title", "detail"],
                },
            },
            "required": ["factoryNodeId", "sectionId"],
        },
    },
    {
        "name": "set_bom_component_flag",
        "description": "Flags a BOM component as design-issue or supply-issue. Pass null to clear.",
        "input_schema": {
            "type": "object",
            "properties": {
                "articleId": {"type": "string"},
                "bomNodeId": {"type": "string"},
                "flag": {
                    "type": ["string", "null"],
                    "enum": ["design-issue", "supply-issue", None],
                },
            },
            "required": ["articleId", "bomNodeId"],
        },
    },
    {
        "name": "upsert_at_risk_product",
        "description": "Adds or updates an at-risk product (latent population, no claim yet but flagged for proactive action).",
        "input_schema": {
            "type": "object",
            "properties": {
                "productId": {"type": "string"},
                "articleId": {"type": "string"},
                "reason": {"type": "string", "enum": ["supply", "design"]},
                "reasonDetail": {"type": "string"},
                "buildAgeWeeks": {"type": "integer"},
                "market": {"type": "string"},
            },
            "required": ["productId", "articleId", "reason", "reasonDetail"],
        },
    },
    {
        "name": "upsert_investigation",
        "description": "Adds or replaces an investigation entry (the dashboard list + detail view).",
        "input_schema": {
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "e.g. INV-001"},
                "severity": {"type": "string", "enum": ["critical", "high", "low"]},
                "title": {"type": "string"},
                "source": {"type": "string"},
                "summary": {"type": "string"},
                "defects": {"type": "integer"},
                "claims": {"type": "integer"},
                "risk": {"type": "number"},
                "status": {"type": "string"},
                "age": {"type": "string"},
                "rootCause": {"type": "string"},
                "timeline": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "date": {"type": "string"},
                            "event": {"type": "string"},
                            "type": {"type": "string", "enum": ["defect", "claim", "action", "detection"]},
                        },
                        "required": ["date", "event", "type"],
                    },
                },
                "affectedProducts": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "name": {"type": "string"},
                        },
                        "required": ["id", "name"],
                    },
                },
                "suggestedActions": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["id", "severity", "title", "source", "summary",
                         "defects", "claims", "risk", "status", "age",
                         "rootCause", "timeline", "affectedProducts", "suggestedActions"],
        },
    },
    {
        "name": "delete_investigation",
        "description": "Removes an investigation that's no longer active (e.g. self-corrected drift).",
        "input_schema": {
            "type": "object",
            "properties": {"id": {"type": "string"}},
            "required": ["id"],
        },
    },
    {
        "name": "commit_snapshot",
        "description": "Finalizes the snapshot with a summary string. Must be called as the last tool to end the loop.",
        "input_schema": {
            "type": "object",
            "properties": {"summary": {"type": "string"}},
            "required": ["summary"],
        },
    },
]


def _ok(message: str = "ok", **extra) -> str:
    return json.dumps({"ok": True, "message": message, **extra}, default=str)


def _err(message: str) -> str:
    return json.dumps({"ok": False, "error": message})


def execute_tool(name: str, arguments: dict, draft: dict, prev: dict) -> str:
    """Execute one tool call against the in-memory draft. Returns a JSON string."""

    if name == "list_known_queries":
        return json.dumps([
            {"name": k, "description": v["description"]}
            for k, v in db.NAMED_QUERIES.items()
        ])

    if name == "run_known_query":
        try:
            rows = db.run_named(arguments["name"])
            return json.dumps({"rows": rows, "count": len(rows)}, default=str)
        except KeyError as exc:
            return _err(str(exc))
        except Exception as exc:
            return _err(f"db error: {exc}")

    if name == "query_db":
        try:
            rows = db.run_freeform(arguments["sql"])
            return json.dumps({"rows": rows, "count": len(rows)}, default=str)
        except (ValueError, Exception) as exc:
            return _err(str(exc))

    if name == "rag_search":
        try:
            chunks = rag_tool.search(arguments["query"], int(arguments.get("top_k", 5)))
            return json.dumps({"chunks": chunks})
        except Exception as exc:
            return _err(f"rag error: {exc}")

    if name == "get_current_state":
        if not prev:
            return json.dumps({})
        summary = {
            "generatedAt": prev.get("generatedAt"),
            "summary": prev.get("summary"),
            "investigations": prev.get("investigations", []),
            "atRiskProducts": prev.get("atRiskProducts", []),
            "nodes": prev.get("nodes", {}),
            "flaggedSections": [
                {"factoryId": fid, "sectionId": s["sectionId"], "flag": s["caseFlag"]}
                for fid, fac in prev.get("factoryDetails", {}).items()
                for line in fac.get("lines", [])
                for s in line.get("sections", [])
                if s.get("caseFlag")
            ],
            "flaggedBomComponents": [
                {"articleId": art["articleId"], "bomNodeId": c["bomNodeId"], "flag": c["flag"]}
                for art in prev.get("articleCatalog", [])
                for asm in art.get("assemblies", [])
                for c in asm.get("components", [])
                if c.get("flag")
            ],
            "badBatches": [
                {"supplierNodeId": sid, "batchId": b["batchId"], "status": b["status"]}
                for sid, sup in prev.get("supplierDetails", {}).items()
                for b in sup.get("batches", [])
                if b.get("status") in ("suspect", "bad")
            ],
        }
        return json.dumps(summary, default=str)

    if name == "verify_consistency":
        try:
            from agent import verify as verify_mod
            import psycopg2
            import psycopg2.extras
            conn = psycopg2.connect(db.DB_URL)
            try:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    results = [verify_mod.run_rule(cur, r, 3) for r in verify_mod.RULES]
                return json.dumps({
                    "violations": [r for r in results if r["count"] > 0]
                }, default=str)
            finally:
                conn.close()
        except Exception as exc:
            return _err(f"verify error: {exc}")

    if name == "set_node_error_count":
        nid = arguments["nodeId"]
        if nid not in state.TOP_LEVEL_NODE_IDS:
            return _err(f"unknown nodeId '{nid}'. Valid: {sorted(state.TOP_LEVEL_NODE_IDS)}")
        draft.setdefault("nodes", {}).setdefault(nid, {})["errorCount"] = int(arguments["count"])
        return _ok()

    if name == "set_node_subtitle":
        nid = arguments["nodeId"]
        if nid not in state.TOP_LEVEL_NODE_IDS:
            return _err(f"unknown nodeId '{nid}'.")
        draft.setdefault("nodes", {}).setdefault(nid, {})["subtitle"] = arguments["subtitle"]
        return _ok()

    if name == "set_batch_severity":
        sid = arguments["supplierNodeId"]
        bid = arguments["batchId"]
        status_val = arguments["status"]
        if status_val not in VALID_BATCH_STATUS:
            return _err(f"status must be one of {sorted(VALID_BATCH_STATUS)}")
        det = draft.get("supplierDetails", {}).get(sid)
        if not det:
            return _err(f"unknown supplierNodeId '{sid}' or no batches yet — call upsert_supplier_batches first")
        for b in det.get("batches", []):
            if b["batchId"] == bid:
                b["status"] = status_val
                if "events" in arguments:
                    b["events"] = int(arguments["events"])
                return _ok()
        return _err(f"batch '{bid}' not in supplier '{sid}'")

    if name == "set_section_case_flag":
        fid = arguments["factoryNodeId"]
        sec_id = arguments["sectionId"]
        flag = arguments.get("flag")
        if fid not in state.FACTORY_DB_TO_NODE.values():
            return _err(f"unknown factoryNodeId '{fid}'. Valid: {sorted(state.FACTORY_DB_TO_NODE.values())}")
        fac = draft.get("factoryDetails", {}).get(fid)
        if not fac:
            return _err(f"factory '{fid}' not yet scaffolded")
        if flag is not None:
            if flag.get("kind") not in VALID_FLAG_KINDS:
                return _err(f"flag.kind must be one of {sorted(VALID_FLAG_KINDS)}")
        for line in fac.get("lines", []):
            for s in line.get("sections", []):
                if s["sectionId"] == sec_id:
                    s["caseFlag"] = flag
                    return _ok()
        return _err(f"section '{sec_id}' not in factory '{fid}'")

    if name == "set_bom_component_flag":
        aid = arguments["articleId"]
        bn_id = arguments["bomNodeId"]
        flag = arguments.get("flag")
        if flag is not None and flag not in VALID_BOM_FLAGS:
            return _err(f"flag must be one of {sorted(VALID_BOM_FLAGS)} or null")
        for art in draft.get("articleCatalog", []):
            if art["articleId"] != aid:
                continue
            for asm in art.get("assemblies", []):
                for c in asm.get("components", []):
                    if c["bomNodeId"] == bn_id:
                        c["flag"] = flag
                        return _ok()
            return _err(f"bomNodeId '{bn_id}' not in article '{aid}'")
        return _err(f"unknown articleId '{aid}'")

    if name == "upsert_at_risk_product":
        if arguments.get("reason") not in VALID_RISK_REASON:
            return _err(f"reason must be one of {sorted(VALID_RISK_REASON)}")
        pid = arguments["productId"]
        lst = draft.setdefault("atRiskProducts", [])
        for i, ar in enumerate(lst):
            if ar.get("productId") == pid:
                lst[i] = {**ar, **arguments}
                return _ok(updated=True)
        lst.append({
            "productId": pid,
            "articleId": arguments["articleId"],
            "reason": arguments["reason"],
            "reasonDetail": arguments["reasonDetail"],
            "buildAgeWeeks": arguments.get("buildAgeWeeks", 0),
            "market": arguments.get("market", "—"),
        })
        return _ok(added=True)

    if name == "upsert_investigation":
        sev = arguments.get("severity")
        if sev not in VALID_INV_SEVERITY:
            return _err(f"severity must be one of {sorted(VALID_INV_SEVERITY)}")
        lst = draft.setdefault("investigations", [])
        for i, inv in enumerate(lst):
            if inv.get("id") == arguments["id"]:
                lst[i] = arguments
                return _ok(updated=True)
        lst.append(arguments)
        return _ok(added=True)

    if name == "delete_investigation":
        iid = arguments["id"]
        lst = draft.get("investigations", [])
        before = len(lst)
        draft["investigations"] = [inv for inv in lst if inv.get("id") != iid]
        if len(draft["investigations"]) == before:
            return _err(f"no investigation with id '{iid}'")
        return _ok(removed=True)

    if name == "commit_snapshot":
        draft["summary"] = arguments["summary"]
        return _ok(committed=True)

    return _err(f"unknown tool '{name}'")
