# Deterministische DB-Refresh-Phase.
# Liest Suppliers, Factories+Sections, Articles+BOMs, Field-Claims live aus
# Manex und befüllt den Snapshot ohne LLM. Agent-Decisions (Flags, Investigations)
# aus dem vorherigen Snapshot werden via merge_with_prev übernommen.

import sys
from collections import defaultdict
from pathlib import Path

import psycopg2
import psycopg2.extras

from . import db
from . import state

COMMODITY_EMOJI = {
    "capacitor": "1f50b",
    "resistor": "1f4a1",
    "diode": "1f538",
    "ic": "1f9e0",
    "connector": "1f50c",
    "housing": "1f4e6",
    "fastener": "1f529",
    "consumable": "1f9f4",
    "pcb": "1f7e9",
    "relay": "1f504",
    "fuse": "1f4a5",
    "display": "1f4fa",
    "input": "2328",
    "part": "1f9e9",
}

ARTICLE_EMOJI = {
    "ART-00001": "1f699",
    "ART-00002": "1f4e1",
    "ART-00003": "26a1",
    "ART-00004": "1f5a5",
    "ART-00005": "1f4e1",
}


def _emoji_for_commodity(commodity: str | None) -> str:
    return COMMODITY_EMOJI.get((commodity or "").lower(), COMMODITY_EMOJI["part"])


def _fetch_suppliers(cur) -> dict:
    cur.execute(db.NAMED_QUERIES["supplier_batches_full"]["sql"])
    rows = cur.fetchall()
    suppliers: dict = {}
    pm_seen: dict[str, dict] = defaultdict(dict)

    for r in rows:
        node_id = state.SUPPLIER_DB_TO_NODE.get(r["supplier_id"]) \
            or state.SUPPLIER_NAME_TO_NODE.get(r["supplier_name"])
        if not node_id:
            continue
        sup = suppliers.setdefault(node_id, {
            "supplierId": r["supplier_id"],
            "supplierName": r["supplier_name"],
            "country": None,
            "partMasters": [],
            "batches": [],
        })
        sup["batches"].append({
            "batchId": r["batch_id"],
            "batchNumber": r.get("batch_number") or "",
            "partNumber": r["part_number"],
            "partTitle": r.get("part_title") or r["part_number"],
            "receivedDate": str(r.get("received_date")) if r.get("received_date") else "",
            "qty": int(r.get("qty") or 0),
            "status": "ok",
            "events": 0,
        })
        pm_key = (node_id, r["part_number"])
        if pm_key not in pm_seen:
            pm_seen[pm_key] = {
                "partNumber": r["part_number"],
                "title": r.get("part_title") or r["part_number"],
                "commodity": r.get("commodity") or "part",
                "emojiCode": _emoji_for_commodity(r.get("commodity")),
            }

    for (node_id, _), pm in pm_seen.items():
        suppliers[node_id]["partMasters"].append(pm)

    return suppliers


def _fetch_factories(cur) -> dict:
    cur.execute(db.NAMED_QUERIES["factories_lines_sections"]["sql"])
    layout_rows = cur.fetchall()

    cur.execute(db.NAMED_QUERIES["tests_per_section"]["sql"])
    tests_per_section = {r["section_id"]: int(r["test_count"]) for r in cur.fetchall()}

    factories: dict = {}
    line_index: dict = {}

    for r in layout_rows:
        node_id = state.FACTORY_DB_TO_NODE.get(r["factory_id"])
        if not node_id:
            continue

        fac = factories.setdefault(node_id, {
            "factoryId": r["factory_id"],
            "name": r["factory_name"],
            "country": r.get("country"),
            "siteCode": r.get("site_code"),
            "lines": [],
        })

        line_key = (node_id, r["line_id"])
        if line_key not in line_index:
            line_obj = {
                "lineId": r["line_id"],
                "name": r["line_name"],
                "lineType": r["line_type"],
                "area": r.get("area"),
                "sections": [],
            }
            fac["lines"].append(line_obj)
            line_index[line_key] = line_obj

        line_index[line_key]["sections"].append({
            "sectionId": r["section_id"],
            "name": r["section_name"],
            "sectionType": r["section_type"],
            "sequenceNo": int(r["sequence_no"]),
            "testCount": tests_per_section.get(r["section_id"], 0),
            "caseFlag": None,
        })

    return factories


def _fetch_articles(cur) -> list:
    cur.execute(db.NAMED_QUERIES["articles_with_boms"]["sql"])
    rows = cur.fetchall()

    articles: dict = {}
    asm_index: dict = {}

    for r in rows:
        art = articles.setdefault(r["article_id"], {
            "articleId": r["article_id"],
            "name": r["article_name"],
            "emojiCode": ARTICLE_EMOJI.get(r["article_id"], "1f4e6"),
            "bomId": r["bom_id"],
            "bomVersion": r.get("bom_version") or "1.0",
            "assemblies": [],
        })

        asm_key = (r["article_id"], r["assembly_id"])
        if asm_key not in asm_index:
            asm_obj = {
                "bomNodeId": r["assembly_id"],
                "name": r["assembly_name"],
                "components": [],
            }
            art["assemblies"].append(asm_obj)
            asm_index[asm_key] = asm_obj

        asm_index[asm_key]["components"].append({
            "bomNodeId": r["component_id"],
            "findNumber": r["find_number"],
            "partNumber": r["part_number"],
            "partTitle": r.get("part_title") or r["part_number"],
            "commodity": r.get("commodity") or "part",
            "qty": float(r.get("qty") or 1),
            "flag": None,
        })

    return list(articles.values())


def _fetch_field_claims(cur, limit: int = 100) -> list:
    cur.execute(db.NAMED_QUERIES["field_claims_all"]["sql"])
    rows = cur.fetchmany(limit)
    return [
        {
            "claimId": r["field_claim_id"],
            "productId": r["product_id"],
            "articleId": r.get("article_id") or "",
            "complaintText": r.get("complaint_text") or "",
            "market": r.get("market") or "—",
            "buildAgeWeeks": int(r["weeks_since_build"]) if r.get("weeks_since_build") is not None else 0,
            "reportedPart": r.get("reported_part_number") or "",
        }
        for r in rows
    ]


def refresh_from_db() -> dict:
    """Pure-SQL refresh — populates content fields, leaves flags/agent entities empty."""
    snap = state.empty_snapshot()
    with db.connect() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            snap["supplierDetails"] = _fetch_suppliers(cur)
            snap["factoryDetails"] = _fetch_factories(cur)
            snap["articleCatalog"] = _fetch_articles(cur)
            snap["fieldClaims"] = _fetch_field_claims(cur)
    return snap


def merge_with_prev(fresh: dict, prev: dict) -> dict:
    """Carry over agent decisions onto a freshly-refreshed snapshot."""
    if not prev or not prev.get("generatedAt"):
        return fresh

    for sup_id, sup in fresh.get("supplierDetails", {}).items():
        prev_sup = (prev.get("supplierDetails") or {}).get(sup_id, {})
        prev_batch = {
            b["batchId"]: (b.get("status"), b.get("events"))
            for b in prev_sup.get("batches", [])
        }
        for b in sup.get("batches", []):
            prev_st = prev_batch.get(b["batchId"])
            if prev_st:
                if prev_st[0]:
                    b["status"] = prev_st[0]
                if prev_st[1] is not None:
                    b["events"] = int(prev_st[1])

    for fac_id, fac in fresh.get("factoryDetails", {}).items():
        prev_fac = (prev.get("factoryDetails") or {}).get(fac_id, {})
        prev_section_flag = {}
        for line in prev_fac.get("lines", []):
            for s in line.get("sections", []):
                prev_section_flag[s["sectionId"]] = s.get("caseFlag")
        for line in fac.get("lines", []):
            for s in line.get("sections", []):
                if prev_section_flag.get(s["sectionId"]):
                    s["caseFlag"] = prev_section_flag[s["sectionId"]]

    prev_articles = {a["articleId"]: a for a in prev.get("articleCatalog", [])}
    for art in fresh.get("articleCatalog", []):
        prev_art = prev_articles.get(art["articleId"])
        if not prev_art:
            continue
        prev_comp_flag = {}
        for asm in prev_art.get("assemblies", []):
            for c in asm.get("components", []):
                if c.get("flag"):
                    prev_comp_flag[c["bomNodeId"]] = c["flag"]
        for asm in art.get("assemblies", []):
            for c in asm.get("components", []):
                if c["bomNodeId"] in prev_comp_flag:
                    c["flag"] = prev_comp_flag[c["bomNodeId"]]

    fresh["atRiskProducts"] = prev.get("atRiskProducts", [])
    fresh["investigations"] = prev.get("investigations", [])
    fresh["nodes"] = prev.get("nodes", {})

    return fresh


if __name__ == "__main__":
    fresh = refresh_from_db()
    prev = state.load_snapshot()
    merged = merge_with_prev(fresh, prev)
    state.write_snapshot_atomic(merged)
    print(
        f"refreshed: {len(merged['supplierDetails'])} suppliers, "
        f"{len(merged['factoryDetails'])} factories, "
        f"{len(merged['articleCatalog'])} articles, "
        f"{len(merged['fieldClaims'])} field claims",
        file=sys.stderr,
    )
