# Deterministische Datenverifikation für Manex-Qualitätsdaten.
# Prüft harte Konsistenzregeln ausschließlich per SQL (ohne LLM).
# Gibt Verletzungen mit Severity, Count und Beispieldatensätzen aus.

import argparse
import json
import os
from dataclasses import dataclass
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

DB_URL = os.environ["MANEX_DB_URL"]


@dataclass(frozen=True)
class Rule:
    rule_id: str
    severity: str
    title: str
    sql: str


RULES: list[Rule] = [
    Rule(
        rule_id="field_claim_before_build",
        severity="critical",
        title="Field claim timestamp liegt vor Produkt-Bauzeitpunkt",
        sql="""
            SELECT fc.field_claim_id, fc.product_id, fc.claim_ts, p.build_ts
            FROM field_claim fc
            JOIN product p ON p.product_id = fc.product_id
            WHERE fc.claim_ts IS NOT NULL
              AND p.build_ts IS NOT NULL
              AND fc.claim_ts < p.build_ts
        """,
    ),
    Rule(
        rule_id="defect_before_build",
        severity="critical",
        title="Defektzeitpunkt liegt vor Produkt-Bauzeitpunkt",
        sql="""
            SELECT d.defect_id, d.product_id, d.ts AS defect_ts, p.build_ts
            FROM defect d
            JOIN product p ON p.product_id = d.product_id
            WHERE d.ts IS NOT NULL
              AND p.build_ts IS NOT NULL
              AND d.ts < p.build_ts
        """,
    ),
    Rule(
        rule_id="test_before_build",
        severity="critical",
        title="Testergebnis liegt vor Produkt-Bauzeitpunkt",
        sql="""
            SELECT tr.test_result_id, tr.product_id, tr.ts AS test_ts, p.build_ts
            FROM test_result tr
            JOIN product p ON p.product_id = tr.product_id
            WHERE tr.ts IS NOT NULL
              AND p.build_ts IS NOT NULL
              AND tr.ts < p.build_ts
        """,
    ),
    Rule(
        rule_id="rework_before_defect",
        severity="critical",
        title="Nacharbeit liegt zeitlich vor zugehörigem Defekt",
        sql="""
            SELECT r.rework_id, r.product_id, r.defect_id, r.ts AS rework_ts, d.ts AS defect_ts
            FROM rework r
            JOIN defect d ON d.defect_id = r.defect_id
            WHERE r.ts IS NOT NULL
              AND d.ts IS NOT NULL
              AND r.ts < d.ts
        """,
    ),
    Rule(
        rule_id="rework_product_mismatch",
        severity="critical",
        title="Nacharbeit verweist auf Defekt eines anderen Produkts",
        sql="""
            SELECT r.rework_id, r.product_id AS rework_product_id, d.product_id AS defect_product_id, r.defect_id
            FROM rework r
            JOIN defect d ON d.defect_id = r.defect_id
            WHERE r.product_id <> d.product_id
        """,
    ),
    Rule(
        rule_id="product_action_product_mismatch",
        severity="high",
        title="Product action verweist auf Defekt eines anderen Produkts",
        sql="""
            SELECT pa.action_id, pa.product_id AS action_product_id, d.product_id AS defect_product_id, pa.defect_id
            FROM product_action pa
            JOIN defect d ON d.defect_id = pa.defect_id
            WHERE pa.defect_id IS NOT NULL
              AND pa.product_id <> d.product_id
        """,
    ),
    Rule(
        rule_id="field_claim_mapped_defect_mismatch",
        severity="high",
        title="Field claim mapped_defect_id gehört zu anderem Produkt",
        sql="""
            SELECT fc.field_claim_id, fc.product_id AS claim_product_id, d.product_id AS defect_product_id, fc.mapped_defect_id
            FROM field_claim fc
            JOIN defect d ON d.defect_id = fc.mapped_defect_id
            WHERE fc.mapped_defect_id IS NOT NULL
              AND fc.product_id <> d.product_id
        """,
    ),
    Rule(
        rule_id="defect_detected_test_result_mismatch",
        severity="high",
        title="Defekt referenziert Testergebnis eines anderen Produkts",
        sql="""
            SELECT d.defect_id, d.product_id AS defect_product_id, tr.product_id AS test_product_id, d.detected_test_result_id
            FROM defect d
            JOIN test_result tr ON tr.test_result_id = d.detected_test_result_id
            WHERE d.detected_test_result_id IS NOT NULL
              AND d.product_id <> tr.product_id
        """,
    ),
    Rule(
        rule_id="test_pass_outside_limits",
        severity="high",
        title="Testergebnis PASS, obwohl Messwert außerhalb Limits liegt",
        sql="""
            SELECT tr.test_result_id, tr.product_id, tr.test_id, tr.test_value, t.lower_limit, t.upper_limit, tr.overall_result
            FROM test_result tr
            JOIN test t ON t.test_id = tr.test_id
            WHERE tr.overall_result = 'PASS'
              AND tr.test_value ~ '^-?[0-9]+([.][0-9]+)?$'
              AND (
                  (t.lower_limit IS NOT NULL AND tr.test_value::numeric < t.lower_limit)
                  OR
                  (t.upper_limit IS NOT NULL AND tr.test_value::numeric > t.upper_limit)
              )
        """,
    ),
    Rule(
        rule_id="test_fail_inside_limits",
        severity="medium",
        title="Testergebnis FAIL, obwohl Messwert innerhalb Limits liegt",
        sql="""
            SELECT tr.test_result_id, tr.product_id, tr.test_id, tr.test_value, t.lower_limit, t.upper_limit, tr.overall_result
            FROM test_result tr
            JOIN test t ON t.test_id = tr.test_id
            WHERE tr.overall_result = 'FAIL'
              AND tr.test_value ~ '^-?[0-9]+([.][0-9]+)?$'
              AND (t.lower_limit IS NOT NULL OR t.upper_limit IS NOT NULL)
              AND (t.lower_limit IS NULL OR tr.test_value::numeric >= t.lower_limit)
              AND (t.upper_limit IS NULL OR tr.test_value::numeric <= t.upper_limit)
        """,
    ),
    Rule(
        rule_id="negative_or_zero_durations",
        severity="medium",
        title="Zeit-/Mengenwerte mit unplausiblen negativen oder null Werten",
        sql="""
            SELECT 'test_result' AS source, tr.test_result_id AS row_id, tr.test_time_ms::text AS value
            FROM test_result tr
            WHERE tr.test_time_ms IS NOT NULL AND tr.test_time_ms <= 0
            UNION ALL
            SELECT 'rework' AS source, r.rework_id AS row_id, r.time_minutes::text AS value
            FROM rework r
            WHERE r.time_minutes IS NOT NULL AND r.time_minutes <= 0
            UNION ALL
            SELECT 'product_part_install' AS source, ppi.install_id AS row_id, ppi.qty::text AS value
            FROM product_part_install ppi
            WHERE ppi.qty IS NOT NULL AND ppi.qty <= 0
            UNION ALL
            SELECT 'supplier_batch' AS source, sb.batch_id AS row_id, sb.qty::text AS value
            FROM supplier_batch sb
            WHERE sb.qty IS NOT NULL AND sb.qty <= 0
        """,
    ),
    Rule(
        rule_id="negative_costs",
        severity="medium",
        title="Kosten mit negativem Wert",
        sql="""
            SELECT 'defect' AS source, d.defect_id AS row_id, d.cost::text AS cost
            FROM defect d
            WHERE d.cost IS NOT NULL AND d.cost < 0
            UNION ALL
            SELECT 'field_claim' AS source, fc.field_claim_id AS row_id, fc.cost::text AS cost
            FROM field_claim fc
            WHERE fc.cost IS NOT NULL AND fc.cost < 0
            UNION ALL
            SELECT 'rework' AS source, r.rework_id AS row_id, r.cost::text AS cost
            FROM rework r
            WHERE r.cost IS NOT NULL AND r.cost < 0
        """,
    ),
    Rule(
        rule_id="product_order_article_mismatch",
        severity="high",
        title="Produkt-Artikel passt nicht zum Artikel des Auftrags",
        sql="""
            SELECT p.product_id, p.order_id, p.article_id AS product_article_id, po.article_id AS order_article_id
            FROM product p
            JOIN production_order po ON po.order_id = p.order_id
            WHERE p.order_id IS NOT NULL
              AND p.article_id <> po.article_id
        """,
    ),
    Rule(
        rule_id="product_order_configuration_mismatch",
        severity="medium",
        title="Produkt-Konfiguration passt nicht zur Konfiguration des Auftrags",
        sql="""
            SELECT p.product_id, p.order_id, p.configuration_id AS product_cfg_id, po.configuration_id AS order_cfg_id
            FROM product p
            JOIN production_order po ON po.order_id = p.order_id
            WHERE p.order_id IS NOT NULL
              AND p.configuration_id IS NOT NULL
              AND po.configuration_id IS NOT NULL
              AND p.configuration_id <> po.configuration_id
        """,
    ),
    Rule(
        rule_id="part_batch_part_number_mismatch",
        severity="high",
        title="Part part_number passt nicht zum verknüpften Supplier-Batch",
        sql="""
            SELECT p.part_id, p.part_number AS part_part_number, p.batch_id, sb.part_number AS batch_part_number
            FROM part p
            JOIN supplier_batch sb ON sb.batch_id = p.batch_id
            WHERE p.batch_id IS NOT NULL
              AND p.part_number <> sb.part_number
        """,
    ),
    Rule(
        rule_id="install_bom_mismatch",
        severity="high",
        title="Installiertes BOM-Node gehört nicht zur BOM des Produkts",
        sql="""
            SELECT ppi.install_id, ppi.product_id, p.bom_id AS product_bom_id, ppi.bom_node_id, bn.bom_id AS bom_node_bom_id
            FROM product_part_install ppi
            JOIN product p ON p.product_id = ppi.product_id
            JOIN bom_node bn ON bn.bom_node_id = ppi.bom_node_id
            WHERE ppi.bom_node_id IS NOT NULL
              AND p.bom_id IS NOT NULL
              AND bn.bom_id <> p.bom_id
        """,
    ),
    Rule(
        rule_id="install_before_part_creation",
        severity="medium",
        title="Part wurde laut Daten nach seiner Installation erzeugt",
        sql="""
            SELECT ppi.install_id, ppi.part_id, ppi.installed_ts, p.created_ts
            FROM product_part_install ppi
            JOIN part p ON p.part_id = ppi.part_id
            WHERE ppi.installed_ts IS NOT NULL
              AND p.created_ts IS NOT NULL
              AND ppi.installed_ts < p.created_ts
        """,
    ),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deterministische Datenverifikation für Manex")
    parser.add_argument("--sample-limit", type=int, default=5, help="Beispielzeilen pro Regel")
    parser.add_argument("--only", action="append", default=[], help="Nur bestimmte rule_id ausführen")
    parser.add_argument("--json-out", type=str, default="", help="Optionaler JSON-Reportpfad")
    return parser.parse_args()


def select_rules(only_ids: list[str]) -> list[Rule]:
    if not only_ids:
        return RULES
    wanted = set(only_ids)
    selected = [rule for rule in RULES if rule.rule_id in wanted]
    missing = sorted(wanted - {rule.rule_id for rule in selected})
    if missing:
        missing_str = ", ".join(missing)
        raise ValueError(f"Unbekannte rule_id: {missing_str}")
    return selected


def run_rule(cur: psycopg2.extensions.cursor, rule: Rule, sample_limit: int) -> dict:
    # Eine Regel ist nur dann "ohne Widerspruch", wenn die SQL in `violations`
    # keine Zeile liefert (violation_count == 0). Jede gefundene Zeile ist ein Verstoß.
    query = f"""
        WITH violations AS (
            {rule.sql}
        )
        SELECT
            (SELECT COUNT(*) FROM violations) AS violation_count,
            (
                SELECT COALESCE(json_agg(v), '[]'::json)
                FROM (SELECT * FROM violations LIMIT %s) v
            ) AS samples
    """
    cur.execute(query, (sample_limit,))
    row = cur.fetchone()
    return {
        "rule_id": rule.rule_id,
        "severity": rule.severity,
        "title": rule.title,
        "count": int(row["violation_count"]),
        "samples": row["samples"] or [],
    }


def format_console_report(results: list[dict]) -> str:
    lines = []
    for item in results:
        marker = "OK" if item["count"] == 0 else "ISSUE"
        lines.append(
            f"[{marker}] {item['rule_id']} ({item['severity']}) - {item['title']} -> {item['count']}"
        )
    return "\n".join(lines)


def compute_exit_code(results: list[dict]) -> int:
    has_critical = any(r["count"] > 0 and r["severity"] == "critical" for r in results)
    has_any = any(r["count"] > 0 for r in results)
    if has_critical:
        return 2
    if has_any:
        return 1
    return 0


def main() -> int:
    args = parse_args()
    rules = select_rules(args.only)

    conn = psycopg2.connect(DB_URL)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            results = [run_rule(cur, rule, args.sample_limit) for rule in rules]
    finally:
        conn.close()

    critical_issues = sum(r["count"] for r in results if r["severity"] == "critical")
    high_issues = sum(r["count"] for r in results if r["severity"] == "high")
    medium_issues = sum(r["count"] for r in results if r["severity"] == "medium")
    total_issues = critical_issues + high_issues + medium_issues

    report = {
        "summary": {
            "rules_checked": len(results),
            "total_issues": total_issues,
            "critical_issues": critical_issues,
            "high_issues": high_issues,
            "medium_issues": medium_issues,
        },
        "results": results,
    }

    print(format_console_report(results))
    print("")
    print(
        "Summary: "
        f"rules={report['summary']['rules_checked']}, "
        f"issues={total_issues}, "
        f"critical={critical_issues}, high={high_issues}, medium={medium_issues}"
    )

    if args.json_out:
        out_path = Path(args.json_out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"JSON report written to: {out_path}")

    return compute_exit_code(results)


if __name__ == "__main__":
    raise SystemExit(main())
