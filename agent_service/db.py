# Postgres-Adapter für den Agent-Service.
# Stellt named queries (extrahiert aus agent/analyze.py), eine Allowlist-SQL-Funktion
# für den query_db-Tool sowie healthcheck und audit-INSERT bereit.

import os
import re
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

DB_URL = os.environ.get("MANEX_DB_URL")

NAMED_QUERIES: dict[str, dict] = {
    "story1_supplier_solder_cold": {
        "description": "Story 1 — Lieferantencharge (ElektroParts, PM-00008) → SOLDER_COLD Defekte gruppiert nach Batch",
        "sql": """
            SELECT sb.batch_id, sb.supplier_name,
                   pm.part_number, pm.title AS part_title,
                   COUNT(DISTINCT d.defect_id)  AS defect_count,
                   COUNT(DISTINCT d.product_id) AS affected_products,
                   array_agg(DISTINCT d.product_id ORDER BY d.product_id) AS product_ids,
                   MIN(d.ts)::date AS first_seen,
                   MAX(d.ts)::date AS last_seen
            FROM defect d
            JOIN product p              ON d.product_id   = p.product_id
            JOIN product_part_install ppi ON p.product_id = ppi.product_id
            JOIN part pt                ON ppi.part_id    = pt.part_id
            JOIN supplier_batch sb      ON pt.batch_id    = sb.batch_id
            JOIN part_master pm         ON sb.part_number = pm.part_number
            WHERE d.defect_code = 'SOLDER_COLD'
              AND d.notes NOT ILIKE '%false positive%'
            GROUP BY sb.batch_id, sb.supplier_name, pm.part_number, pm.title
            ORDER BY defect_count DESC
        """,
    },
    "story1_field_claims_pm00008": {
        "description": "Story 1 — Field-Claims auf PM-00008 mit Build-Alter und Beschwerdetexten",
        "sql": """
            SELECT fc.field_claim_id, fc.product_id, p.article_id,
                   fc.claim_ts::date AS claim_date,
                   p.build_ts::date  AS build_date,
                   EXTRACT(DAY FROM (fc.claim_ts - p.build_ts))::int AS days_since_build,
                   fc.market, fc.complaint_text, fc.reported_part_number
            FROM field_claim fc
            JOIN product p ON fc.product_id = p.product_id
            WHERE fc.reported_part_number = 'PM-00008'
            ORDER BY fc.claim_ts
        """,
    },
    "story1_at_risk_products_sb_batch": {
        "description": "Story 1 — Produkte mit PM-00008 aus auffälligen ElektroParts-Chargen ohne bisherigen Claim",
        "sql": """
            SELECT p.product_id, p.article_id, sb.batch_id, p.build_ts::date AS build_date,
                   EXTRACT(DAY FROM (NOW() - p.build_ts))::int AS days_since_build
            FROM product_part_install ppi
            JOIN product p          ON ppi.product_id = p.product_id
            JOIN part pt            ON ppi.part_id    = pt.part_id
            JOIN supplier_batch sb  ON pt.batch_id    = sb.batch_id
            WHERE sb.part_number = 'PM-00008'
              AND sb.supplier_name = 'ElektroParts GmbH'
              AND NOT EXISTS (SELECT 1 FROM defect d WHERE d.product_id = p.product_id)
              AND NOT EXISTS (SELECT 1 FROM field_claim fc WHERE fc.product_id = p.product_id)
            ORDER BY p.build_ts DESC
            LIMIT 30
        """,
    },
    "story2_vib_fail_by_section_week": {
        "description": "Story 2 — VIB_FAIL Defekte nach Sektion und KW",
        "sql": """
            SELECT s.section_id, s.name AS section,
                   TO_CHAR(DATE_TRUNC('week', d.ts), 'IYYY-IW') AS kw,
                   DATE_TRUNC('week', d.ts)::date AS week,
                   COUNT(*) AS defects
            FROM defect d
            JOIN section s ON d.occurrence_section_id = s.section_id
            WHERE d.defect_code = 'VIB_FAIL'
            GROUP BY s.section_id, s.name, DATE_TRUNC('week', d.ts)
            ORDER BY week, defects DESC
        """,
    },
    "story2_vib_test_results": {
        "description": "Story 2 — VIB_TEST Pass/Marginal/Fail nach Sektion und KW",
        "sql": """
            SELECT s.section_id, s.name AS section,
                   TO_CHAR(DATE_TRUNC('week', tr.ts), 'IYYY-IW') AS kw,
                   COUNT(*) FILTER (WHERE tr.overall_result = 'FAIL')     AS fail,
                   COUNT(*) FILTER (WHERE tr.overall_result = 'MARGINAL') AS marginal,
                   COUNT(*) AS total
            FROM test_result tr
            JOIN section s ON tr.section_id = s.section_id
            WHERE tr.test_key = 'VIB_TEST'
            GROUP BY s.section_id, s.name, DATE_TRUNC('week', tr.ts)
            HAVING COUNT(*) FILTER (WHERE tr.overall_result IN ('FAIL','MARGINAL')) > 0
            ORDER BY DATE_TRUNC('week', tr.ts), section
        """,
    },
    "story3_field_claims_no_factory_defect": {
        "description": "Story 3 — Field-Claims auf ART-00001 OHNE in-factory Defekt (Design-Leak)",
        "sql": """
            SELECT fc.field_claim_id, fc.product_id, fc.reported_part_number,
                   pm.title AS part_title, fc.market,
                   fc.complaint_text,
                   fc.claim_ts::date AS claim_date,
                   p.build_ts::date  AS build_date,
                   EXTRACT(DAY FROM (fc.claim_ts - p.build_ts))::int AS days_since_build
            FROM field_claim fc
            JOIN product p          ON fc.product_id  = p.product_id
            LEFT JOIN part_master pm ON fc.reported_part_number = pm.part_number
            WHERE p.article_id = 'ART-00001'
              AND NOT EXISTS (SELECT 1 FROM defect d WHERE d.product_id = fc.product_id)
            ORDER BY fc.claim_ts
        """,
    },
    "story3_at_risk_pm00015_in_age_window": {
        "description": "Story 3 — ART-00001 Produkte im 8-12 Wochen Build-Alter-Risiko-Fenster ohne bisherigen Claim",
        "sql": """
            SELECT p.product_id, p.article_id, p.build_ts::date AS build_date,
                   EXTRACT(WEEK FROM (NOW() - p.build_ts))::int AS weeks_since_build
            FROM product p
            WHERE p.article_id = 'ART-00001'
              AND p.build_ts BETWEEN NOW() - INTERVAL '12 weeks' AND NOW() - INTERVAL '8 weeks'
              AND NOT EXISTS (SELECT 1 FROM field_claim fc WHERE fc.product_id = p.product_id)
            ORDER BY p.build_ts
            LIMIT 30
        """,
    },
    "story4_cosmetic_defects_by_operator": {
        "description": "Story 4 — Kosmetik-Defekte nach Order und Operator (via rework.user_id)",
        "sql": """
            SELECT p.order_id, r.user_id, d.defect_code, COUNT(*) AS defects
            FROM defect d
            JOIN product p ON d.product_id = p.product_id
            JOIN rework r  ON r.defect_id  = d.defect_id
            WHERE d.defect_code IN ('VISUAL_SCRATCH', 'LABEL_MISALIGN')
              AND d.severity = 'low'
            GROUP BY p.order_id, r.user_id, d.defect_code
            ORDER BY defects DESC
        """,
    },
    "story4_user042_section": {
        "description": "Story 4 — An welchen Sections arbeitet user_042 hauptsächlich (für caseFlag-Section)",
        "sql": """
            SELECT installed_section_id AS section_id, COUNT(*) AS install_count
            FROM product_part_install
            WHERE user_id = 'user_042'
            GROUP BY installed_section_id
            ORDER BY install_count DESC
            LIMIT 5
        """,
    },
    "factories_lines_sections": {
        "description": "Layout-Skeleton — alle Factories mit Lines und Sections",
        "sql": """
            SELECT f.factory_id, f.name AS factory_name, f.country, f.site_code,
                   l.line_id, l.name AS line_name, l.line_type, l.area,
                   s.section_id, s.name AS section_name, s.section_type, s.sequence_no
            FROM factory f
            JOIN line l    ON l.factory_id = f.factory_id
            JOIN section s ON s.line_id    = l.line_id
            ORDER BY f.factory_id, l.line_id, s.sequence_no
        """,
    },
    "tests_per_section": {
        "description": "Test-Definitionen pro Section (für testCount-Badges)",
        "sql": """
            SELECT section_id, COUNT(*) AS test_count
            FROM test
            WHERE section_id IS NOT NULL
            GROUP BY section_id
        """,
    },
    "supplier_batches_full": {
        "description": "Alle Supplier mit ihren Batches und Part-Masters",
        "sql": """
            SELECT sb.supplier_id, sb.supplier_name, sb.batch_id, sb.batch_number,
                   sb.part_number, pm.title AS part_title, pm.commodity,
                   sb.received_date, sb.qty
            FROM supplier_batch sb
            JOIN part_master pm ON sb.part_number = pm.part_number
            ORDER BY sb.supplier_id, sb.received_date
        """,
    },
    "articles_with_boms": {
        "description": "Layout-Skeleton — Articles mit BOM-Trees (Assemblies + Components)",
        "sql": """
            SELECT a.article_id, a.name AS article_name,
                   b.bom_id, b.bom_version,
                   asm.bom_node_id AS assembly_id, asm.find_number AS assembly_name,
                   bn.bom_node_id AS component_id,
                   bn.find_number, bn.part_number, bn.qty,
                   pm.title AS part_title, pm.commodity
            FROM article a
            JOIN bom b           ON b.article_id = a.article_id
            JOIN bom_node asm    ON asm.bom_id   = b.bom_id AND asm.parent_bom_node_id IS NULL
            JOIN bom_node bn     ON bn.parent_bom_node_id = asm.bom_node_id
            JOIN part_master pm  ON pm.part_number = bn.part_number
            ORDER BY a.article_id, asm.bom_node_id, bn.bom_node_id
        """,
    },
    "field_claims_all": {
        "description": "Alle Field-Claims mit Build-Alter und Article-Zuordnung",
        "sql": """
            SELECT fc.field_claim_id, fc.product_id, p.article_id,
                   fc.complaint_text, fc.market, fc.reported_part_number,
                   fc.claim_ts::date AS claim_date,
                   p.build_ts::date  AS build_date,
                   EXTRACT(WEEK FROM (fc.claim_ts - p.build_ts))::int AS weeks_since_build
            FROM field_claim fc
            JOIN product p ON fc.product_id = p.product_id
            ORDER BY fc.claim_ts DESC
        """,
    },
}


def connect():
    if not DB_URL:
        raise RuntimeError("MANEX_DB_URL is not set in .env")
    return psycopg2.connect(DB_URL)


def healthcheck() -> dict:
    try:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM defect")
                defects = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*) FROM field_claim")
                claims = cur.fetchone()[0]
        return {"reachable": True, "defects": defects, "field_claims": claims}
    except Exception as exc:
        return {"reachable": False, "error": str(exc)}


def run_named(name: str, limit: int = 200) -> list[dict]:
    if name not in NAMED_QUERIES:
        raise KeyError(f"unknown query name: {name}")
    sql = NAMED_QUERIES[name]["sql"]
    with connect() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql)
            return [dict(r) for r in cur.fetchmany(limit)]


SELECT_ONLY = re.compile(r"^\s*(WITH\b|SELECT\b)", re.IGNORECASE)
FORBIDDEN = re.compile(r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|CREATE)\b", re.IGNORECASE)


def run_freeform(sql: str, limit: int = 200) -> list[dict]:
    if not SELECT_ONLY.match(sql):
        raise ValueError("query must start with SELECT or WITH")
    if FORBIDDEN.search(sql):
        raise ValueError("query contains forbidden keyword (writes are not allowed)")
    with connect() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql)
            return [dict(r) for r in cur.fetchmany(limit)]


def ensure_audit_table() -> None:
    sql = """
        CREATE TABLE IF NOT EXISTS public.agent_run (
            run_id        TEXT PRIMARY KEY,
            started_at    TIMESTAMPTZ NOT NULL,
            finished_at   TIMESTAMPTZ NOT NULL,
            model         TEXT,
            tool_calls    JSONB,
            summary       TEXT
        )
    """
    try:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
                conn.commit()
    except Exception:
        pass


def insert_audit(run_id: str, started_at: datetime, finished_at: datetime,
                 model: str, tool_calls: list, summary: str) -> None:
    try:
        ensure_audit_table()
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.agent_run (run_id, started_at, finished_at, model, tool_calls, summary)
                    VALUES (%s, %s, %s, %s, %s::jsonb, %s)
                    ON CONFLICT (run_id) DO NOTHING
                    """,
                    (run_id, started_at, finished_at, model,
                     psycopg2.extras.Json(tool_calls), summary),
                )
                conn.commit()
    except Exception:
        pass


def next_run_id() -> str:
    try:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT run_id FROM public.agent_run ORDER BY started_at DESC LIMIT 1"
                )
                row = cur.fetchone()
                if row and row[0].startswith("RUN-"):
                    n = int(row[0][4:]) + 1
                    return f"RUN-{n:05d}"
    except Exception:
        pass
    return f"RUN-{int(datetime.now(timezone.utc).timestamp()) % 100000:05d}"
