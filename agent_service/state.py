# Snapshot-Persistenz für den Agent-Service.
# Atomic write via tmp+rename + flock, plus scaffold_from_layout um
# eine leere aber typisierte Initialstruktur zu erzeugen.

import fcntl
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

SNAPSHOT_PATH = Path(
    os.environ.get("AGENT_STATE_PATH")
    or Path(__file__).parent.parent / "frontend" / "public" / "agent_state.json"
)
SCHEMA_VERSION = 1

SUPPLIER_DB_TO_NODE = {
    "SUP-01": "sup-01",
    "SUP-02": "sup-02",
    "SUP-03": "sup-03",
    "SUP-04": "sup-04",
}

SUPPLIER_NAME_TO_NODE = {
    "ElektroParts GmbH": "sup-01",
    "Mechanik-Werk AG": "sup-02",
    "TechSupply Europe": "sup-03",
    "PartStream Industries": "sup-04",
}

FACTORY_DB_TO_NODE = {
    "FAC-00001": "fac-aug",
    "FAC-00002": "fac-dre",
}

TOP_LEVEL_NODE_IDS = {
    "sup-01", "sup-02", "sup-03", "sup-04",
    "fac-aug", "fac-dre",
    "field", "articles",
}


def empty_snapshot() -> dict:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": None,
        "model": None,
        "runId": None,
        "summary": None,
        "nodes": {},
        "supplierDetails": {},
        "factoryDetails": {},
        "articleCatalog": [],
        "fieldClaims": [],
        "atRiskProducts": [],
        "investigations": [],
        "analytics": None,
    }


def load_snapshot() -> dict:
    if not SNAPSHOT_PATH.exists():
        return empty_snapshot()
    try:
        with open(SNAPSHOT_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict) or data.get("schemaVersion") != SCHEMA_VERSION:
            return empty_snapshot()
        for key in empty_snapshot().keys():
            data.setdefault(key, empty_snapshot()[key])
        return data
    except (json.JSONDecodeError, OSError):
        return empty_snapshot()


def write_snapshot_atomic(snapshot: dict) -> None:
    SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    snapshot["generatedAt"] = datetime.now(timezone.utc).isoformat()
    snapshot["schemaVersion"] = SCHEMA_VERSION

    fd, tmp_path = tempfile.mkstemp(
        prefix=".agent_state.", suffix=".json.tmp",
        dir=str(SNAPSHOT_PATH.parent),
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            json.dump(snapshot, f, ensure_ascii=False, indent=2, default=str)
            f.flush()
            os.fsync(f.fileno())
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)
        os.replace(tmp_path, SNAPSHOT_PATH)
    except Exception:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise


def scaffold_from_layout(layout: dict) -> dict:
    """Build an empty-but-typed snapshot from a layout skeleton.

    `layout` shape:
        {
          "factories": [{"factory_id", "name", "country", "site_code", "lines": [{...sections}]}],
          "articles":  [{"article_id", "name", "bom_id", "bom_version", "assemblies": [{...components}]}],
          "suppliers": [{"supplier_id", "supplier_name", "country"}],
        }
    """
    snap = empty_snapshot()

    for node_id in TOP_LEVEL_NODE_IDS:
        snap["nodes"][node_id] = {"errorCount": 0, "subtitle": None}

    for sup in layout.get("suppliers", []):
        node_id = SUPPLIER_DB_TO_NODE.get(sup["supplier_id"]) \
            or SUPPLIER_NAME_TO_NODE.get(sup["supplier_name"])
        if not node_id:
            continue
        snap["supplierDetails"][node_id] = {
            "supplierId": sup["supplier_id"],
            "supplierName": sup["supplier_name"],
            "country": sup.get("country"),
            "partMasters": [],
            "batches": [],
        }

    for fac in layout.get("factories", []):
        node_id = FACTORY_DB_TO_NODE.get(fac["factory_id"])
        if not node_id:
            continue
        snap["factoryDetails"][node_id] = {
            "factoryId": fac["factory_id"],
            "name": fac["name"],
            "country": fac.get("country"),
            "siteCode": fac.get("site_code"),
            "lines": [
                {
                    "lineId": line["line_id"],
                    "name": line["name"],
                    "lineType": line["line_type"],
                    "area": line["area"],
                    "sections": [
                        {
                            "sectionId": s["section_id"],
                            "name": s["name"],
                            "sectionType": s["section_type"],
                            "sequenceNo": s["sequence_no"],
                            "testCount": s.get("test_count", 0),
                            "caseFlag": None,
                        }
                        for s in line.get("sections", [])
                    ],
                }
                for line in fac.get("lines", [])
            ],
        }

    for art in layout.get("articles", []):
        snap["articleCatalog"].append({
            "articleId": art["article_id"],
            "name": art["name"],
            "emojiCode": art.get("emoji_code", "1f4e6"),
            "bomId": art["bom_id"],
            "bomVersion": art.get("bom_version", "1.0"),
            "assemblies": [
                {
                    "bomNodeId": asm["bom_node_id"],
                    "name": asm["name"],
                    "components": [
                        {
                            "bomNodeId": c["bom_node_id"],
                            "findNumber": c["find_number"],
                            "partNumber": c["part_number"],
                            "partTitle": c.get("part_title", c["part_number"]),
                            "commodity": c.get("commodity", "part"),
                            "qty": c.get("qty", 1),
                            "flag": None,
                        }
                        for c in asm.get("components", [])
                    ],
                }
                for asm in art.get("assemblies", [])
            ],
        })

    return snap


def collect_valid_ids(snapshot: dict) -> dict:
    """Return sets of valid IDs the agent's write tools may reference."""
    ids = {
        "node_ids": set(TOP_LEVEL_NODE_IDS),
        "supplier_node_ids": set(snapshot.get("supplierDetails", {}).keys()),
        "factory_node_ids": set(snapshot.get("factoryDetails", {}).keys()),
        "batch_ids_by_supplier": {},
        "section_ids_by_factory": {},
        "article_ids": set(),
        "bom_node_ids_by_article": {},
    }

    for sid, sup in snapshot.get("supplierDetails", {}).items():
        ids["batch_ids_by_supplier"][sid] = {b["batchId"] for b in sup.get("batches", [])}

    for fid, fac in snapshot.get("factoryDetails", {}).items():
        ids["section_ids_by_factory"][fid] = {
            s["sectionId"]
            for line in fac.get("lines", [])
            for s in line.get("sections", [])
        }

    for art in snapshot.get("articleCatalog", []):
        ids["article_ids"].add(art["articleId"])
        ids["bom_node_ids_by_article"][art["articleId"]] = {
            c["bomNodeId"]
            for asm in art.get("assemblies", [])
            for c in asm.get("components", [])
        }

    return ids
