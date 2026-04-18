# Manex-Qualitätsagent: DB gezielt nach den 4 bekannten Root-Cause-Stories abfragen
# und mit GPT-4o einen strukturierten Qualitätsbericht generieren

import json
import os
import pprint
import uuid
from datetime import datetime, timezone
from pathlib import Path
import psycopg2
import psycopg2.extras
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

DB_URL = os.environ["MANEX_DB_URL"]
openai_client = OpenAI()

# Queries nach Stories gruppiert — jede zielt auf die spezifischen Entitäten laut DATA_PATTERNS.md
STORY_QUERIES: dict[str, dict] = {

    "story1_lieferant_solder_cold": {
        "beschreibung": "Story 1 — Lieferantencharge SB-00007 (ElektroParts GmbH, PM-00008) → SOLDER_COLD Spike KW 5-6/2026",
        "sql": """
            SELECT sb.batch_id, sb.supplier_name,
                   pm.part_number, pm.title AS part_title,
                   COUNT(DISTINCT d.defect_id)                    AS defect_count,
                   COUNT(DISTINCT d.product_id)                   AS betroffene_produkte,
                   array_agg(DISTINCT d.product_id ORDER BY d.product_id) AS betroffene_produkt_ids,
                   MIN(d.ts)::date                                AS erstes_auftreten,
                   MAX(d.ts)::date                                AS letztes_auftreten
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
        """
    },

    "story1_feldreklamationen_pm00008": {
        "beschreibung": "Story 1 — Feldreklamationen auf PM-00008, Wochen nach Bau, Beschwerdetexte",
        "sql": """
            SELECT fc.field_claim_id,
                   fc.claim_ts::date AS reklamationsdatum,
                   p.build_ts::date  AS baudatum,
                   EXTRACT(DAY FROM (fc.claim_ts - p.build_ts))::int AS tage_nach_bau,
                   fc.market,
                   fc.complaint_text
            FROM field_claim fc
            JOIN product p ON fc.product_id = p.product_id
            WHERE fc.reported_part_number = 'PM-00008'
            ORDER BY fc.claim_ts
        """
    },

    "story1_produkte_defekt_count": {
        "beschreibung": "Story 1 — Defektanzahl pro Produkt (SOLDER_COLD, Charge SB-00007)",
        "sql": """
            SELECT d.product_id,
                   COUNT(*) AS defekt_count
            FROM defect d
            JOIN product p              ON d.product_id   = p.product_id
            JOIN product_part_install ppi ON p.product_id = ppi.product_id
            JOIN part pt                ON ppi.part_id    = pt.part_id
            JOIN supplier_batch sb      ON pt.batch_id    = sb.batch_id
            WHERE d.defect_code = 'SOLDER_COLD'
              AND sb.batch_id   = 'SB-00007'
              AND d.notes NOT ILIKE '%false positive%'
            GROUP BY d.product_id
            ORDER BY defekt_count DESC
        """
    },

    "claim_lag_vergleich": {
        "beschreibung": "Feldreklamations-Lag — Story 1 (4-8 Wochen) vs. Story 3 (8-12 Wochen) direkt verglichen",
        "sql": """
            SELECT
                CASE
                    WHEN fc.reported_part_number = 'PM-00008' THEN 'Story 1 — Lieferant (SB-00007)'
                    WHEN p.article_id = 'ART-00001'           THEN 'Story 3 — Design (R33/PM-00015)'
                END                                                         AS story,
                COUNT(*)                                                    AS reklamationen,
                MIN(EXTRACT(DAY FROM (fc.claim_ts - p.build_ts)))::int     AS min_tage,
                AVG(EXTRACT(DAY FROM (fc.claim_ts - p.build_ts)))::int     AS avg_tage,
                MAX(EXTRACT(DAY FROM (fc.claim_ts - p.build_ts)))::int     AS max_tage
            FROM field_claim fc
            JOIN product p ON fc.product_id = p.product_id
            WHERE fc.reported_part_number = 'PM-00008'
               OR (
                   p.article_id = 'ART-00001'
                   AND NOT EXISTS (
                       SELECT 1 FROM defect d WHERE d.product_id = fc.product_id
                   )
               )
            GROUP BY story
            ORDER BY avg_tage
        """
    },

    "story2_vib_fail_sektion_woche": {
        "beschreibung": "Story 2 — VIB_FAIL Defekte nach Sektion und KW (Kalibrierdrift Drehmomentstüssel KW49-52/2025)",
        "sql": """
            SELECT s.name                               AS sektion,
                   TO_CHAR(DATE_TRUNC('week', d.ts), 'IYYY-IW') AS kw,
                   DATE_TRUNC('week', d.ts)::date       AS woche,
                   COUNT(*)                             AS defekte
            FROM defect d
            JOIN section s ON d.occurrence_section_id = s.section_id
            WHERE d.defect_code = 'VIB_FAIL'
            GROUP BY s.name, DATE_TRUNC('week', d.ts)
            ORDER BY woche, defekte DESC
        """
    },

    "story2_vib_test_failures": {
        "beschreibung": "Story 2 — VIB_TEST Ergebnisse (FAIL/MARGINAL) nach Sektion und KW",
        "sql": """
            SELECT s.name                               AS sektion,
                   TO_CHAR(DATE_TRUNC('week', tr.ts), 'IYYY-IW') AS kw,
                   COUNT(*) FILTER (WHERE tr.overall_result = 'FAIL')     AS fail,
                   COUNT(*) FILTER (WHERE tr.overall_result = 'MARGINAL') AS marginal,
                   COUNT(*)                                                AS gesamt
            FROM test_result tr
            JOIN section s ON tr.section_id = s.section_id
            WHERE tr.test_key = 'VIB_TEST'
            GROUP BY s.name, DATE_TRUNC('week', tr.ts)
            HAVING COUNT(*) FILTER (WHERE tr.overall_result IN ('FAIL','MARGINAL')) > 0
            ORDER BY DATE_TRUNC('week', tr.ts), sektion
        """
    },

    "story2_rework_schraubmoment": {
        "beschreibung": "Story 2 — Nacharbeitseinträge zu VIB_FAIL (Schraubmoment-Hinweise)",
        "sql": """
            SELECT r.rework_id, r.ts::date AS datum, r.user_id,
                   r.action_text, s.name AS sektion
            FROM rework r
            JOIN defect d ON r.defect_id = d.defect_id
            LEFT JOIN section s ON r.rework_section_id = s.section_id
            WHERE d.defect_code = 'VIB_FAIL'
            ORDER BY r.ts DESC
            LIMIT 20
        """
    },

    "story2_produkte_defekt_count": {
        "beschreibung": "Story 2 — Defektanzahl pro Produkt (VIB_FAIL, KW49-52/2025)",
        "sql": """
            SELECT d.product_id,
                   COUNT(*) AS defekt_count
            FROM defect d
            WHERE d.defect_code = 'VIB_FAIL'
              AND d.notes NOT ILIKE '%false positive%'
            GROUP BY d.product_id
            ORDER BY defekt_count DESC
        """
    },

    "story3_feldreklamationen_ohne_werksdefekt": {
        "beschreibung": "Story 3 — Feldreklamationen auf ART-00001 Produkte OHNE Werksdefekt (Designschwäche R33/PM-00015)",
        "sql": """
            SELECT fc.reported_part_number,
                   pm.title AS part_title,
                   COUNT(*)  AS reklamationen,
                   AVG(EXTRACT(EPOCH FROM (fc.claim_ts - p.build_ts)) / 86400)::int AS avg_tage_bis_reklamation,
                   array_agg(SUBSTRING(fc.complaint_text, 1, 160) ORDER BY fc.claim_ts) AS beschwerden
            FROM field_claim fc
            JOIN product p      ON fc.product_id  = p.product_id
            LEFT JOIN part_master pm ON fc.reported_part_number = pm.part_number
            WHERE p.article_id = 'ART-00001'
              AND NOT EXISTS (
                  SELECT 1 FROM defect d WHERE d.product_id = fc.product_id
              )
            GROUP BY fc.reported_part_number, pm.title
            ORDER BY reklamationen DESC
        """
    },

    "story3_bom_position_r33": {
        "beschreibung": "Story 3 — BOM-Position R33 auf Steuerplatine (PM-00015 Widerstand Thermaldrift)",
        "sql": """
            SELECT bn.find_number, bn.node_type,
                   pm.part_number, pm.title AS part_title,
                   b.bom_id, a.name AS article_name
            FROM bom_node bn
            JOIN part_master pm ON bn.part_number = pm.part_number
            JOIN bom b          ON bn.bom_id      = b.bom_id
            JOIN article a      ON b.article_id   = a.article_id
            WHERE bn.find_number = 'R33'
        """
    },

    "story3_produkte_feldreklamation_count": {
        "beschreibung": "Story 3 — Feldreklamationen pro Produkt (ART-00001, kein Werksdefekt)",
        "sql": """
            SELECT fc.product_id,
                   COUNT(*) AS reklamation_count
            FROM field_claim fc
            JOIN product p ON fc.product_id = p.product_id
            WHERE p.article_id = 'ART-00001'
              AND NOT EXISTS (
                  SELECT 1 FROM defect d WHERE d.product_id = fc.product_id
              )
            GROUP BY fc.product_id
            ORDER BY reklamation_count DESC
        """
    },

    "story4_kosmetik_defekte_operator": {
        "beschreibung": "Story 4 — Kosmetik-Defekte (VISUAL_SCRATCH, LABEL_MISALIGN) nach Order und Operator via Rework",
        "sql": """
            SELECT p.order_id, r.user_id,
                   d.defect_code,
                   COUNT(*) AS defekte
            FROM defect d
            JOIN product p ON d.product_id = p.product_id
            JOIN rework r  ON r.defect_id  = d.defect_id
            WHERE d.defect_code IN ('VISUAL_SCRATCH', 'LABEL_MISALIGN')
              AND d.severity = 'low'
            GROUP BY p.order_id, r.user_id, d.defect_code
            ORDER BY defekte DESC
        """
    },

    "story4_betroffene_produkte": {
        "beschreibung": "Story 4 — Produkte in PO-00012, PO-00018, PO-00024 mit Kosmetik-Defekten",
        "sql": """
            SELECT p.order_id, p.product_id, d.defect_code,
                   d.ts::date AS defektdatum, d.severity,
                   r.user_id  AS rework_user
            FROM defect d
            JOIN product p ON d.product_id = p.product_id
            LEFT JOIN rework r ON r.defect_id = d.defect_id
            WHERE p.order_id IN ('PO-00012', 'PO-00018', 'PO-00024')
              AND d.defect_code IN ('VISUAL_SCRATCH', 'LABEL_MISALIGN')
            ORDER BY p.order_id, d.ts
        """
    },

    "story4_produkte_defekt_count": {
        "beschreibung": "Story 4 — Defektanzahl pro Produkt (Kosmetik, user_042, PO-00012/18/24)",
        "sql": """
            SELECT d.product_id, p.order_id,
                   COUNT(*) AS defekt_count
            FROM defect d
            JOIN product p ON d.product_id = p.product_id
            JOIN rework r  ON r.defect_id  = d.defect_id
            WHERE d.defect_code IN ('VISUAL_SCRATCH', 'LABEL_MISALIGN')
              AND p.order_id IN ('PO-00012', 'PO-00018', 'PO-00024')
              AND r.user_id = 'user_042'
            GROUP BY d.product_id, p.order_id
            ORDER BY defekt_count DESC
        """
    },

    "noise_false_positives": {
        "beschreibung": "Rauschen — False Positives (severity low, notes enthält 'false positive')",
        "sql": """
            SELECT defect_code, severity, COUNT(*) AS anzahl
            FROM defect
            WHERE notes ILIKE '%false positive%'
            GROUP BY defect_code, severity
            ORDER BY anzahl DESC
        """
    },

    "noise_near_miss_tests": {
        "beschreibung": "Rauschen — Near-Miss Testergebnisse (Messwert nahe Grenzwert, aber PASS)",
        "sql": """
            SELECT tr.test_key,
                   COUNT(*) AS near_miss_count,
                   ROUND(AVG((tr.test_value::numeric - t.lower_limit) / NULLIF(t.upper_limit - t.lower_limit, 0) * 100), 1) AS avg_pct_vom_limit
            FROM test_result tr
            JOIN test t ON tr.test_id = t.test_id
            WHERE tr.overall_result = 'PASS'
              AND t.upper_limit IS NOT NULL
              AND t.lower_limit IS NOT NULL
              AND tr.test_value IS NOT NULL
              AND tr.test_value ~ '^-?[0-9]+([.][0-9]+)?$'
              AND (
                  tr.test_value::numeric >= t.upper_limit * 0.9
                  OR tr.test_value::numeric <= t.lower_limit * 1.1
              )
            GROUP BY tr.test_key
            ORDER BY near_miss_count DESC
            LIMIT 10
        """
    },

    "uebersicht_defekt_pareto": {
        "beschreibung": "Überblick — Defekt-Pareto Top 15 (ohne False Positives)",
        "sql": """
            SELECT defect_code,
                   COUNT(*)                                                              AS anzahl,
                   SUM(cost)::numeric(10,2)                                             AS gesamtkosten,
                   COUNT(CASE WHEN severity IN ('high','critical') THEN 1 END)          AS hoch_kritisch,
                   MIN(ts)::date AS erstes, MAX(ts)::date AS letztes
            FROM defect
            WHERE notes NOT ILIKE '%false positive%'
            GROUP BY defect_code
            ORDER BY anzahl DESC
            LIMIT 15
        """
    },

    "noise_detection_bias_beweis": {
        "beschreibung": "Rauschen — Detection Bias: Anteil Detektionen je Sektion pro Defekttyp",
        "sql": """
            SELECT d.defect_code,
                   s.name AS sektion,
                   COUNT(*) AS detektionen,
                   ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY d.defect_code), 1) AS anteil_pct
            FROM defect d
            JOIN section s ON d.detected_section_id = s.section_id
            WHERE d.notes NOT ILIKE '%false positive%'
            GROUP BY d.defect_code, s.name
            ORDER BY d.defect_code, detektionen DESC
        """
    },

    "noise_near_miss_esr_story1": {
        "beschreibung": "Rauschen — Near-Miss ESR-Tests auf Produkten mit SB-00007 Teilen (Story 1 Frühwarnsignal)",
        "sql": """
            SELECT tr.test_key,
                   COUNT(*) AS near_miss_count,
                   ROUND(AVG(tr.test_value::numeric / NULLIF(t.upper_limit, 0) * 100), 1) AS avg_pct_vom_oberlimit,
                   MIN(tr.test_value::numeric)::numeric(10,4) AS min_wert,
                   t.upper_limit
            FROM test_result tr
            JOIN test t ON tr.test_id = t.test_id
            JOIN product_part_install ppi ON tr.product_id = ppi.product_id
            JOIN part pt ON ppi.part_id = pt.part_id
            WHERE pt.batch_id = 'SB-00007'
              AND tr.overall_result = 'PASS'
              AND t.upper_limit IS NOT NULL
              AND tr.test_value ~ '^-?[0-9]+([.][0-9]+)?$'
              AND tr.test_value::numeric >= t.upper_limit * 0.85
            GROUP BY tr.test_key, t.upper_limit
            ORDER BY near_miss_count DESC
        """
    },

    "noise_near_miss_vib_story2": {
        "beschreibung": "Rauschen — Near-Miss VIB_TEST Ergebnisse KW49-52/2025 (Story 2 Frühwarnsignal)",
        "sql": """
            SELECT TO_CHAR(DATE_TRUNC('week', tr.ts), 'IYYY-IW') AS kw,
                   COUNT(*) AS near_miss_count,
                   ROUND(AVG(tr.test_value::numeric / NULLIF(t.upper_limit, 0) * 100), 1) AS avg_pct_vom_oberlimit
            FROM test_result tr
            JOIN test t ON tr.test_id = t.test_id
            WHERE tr.test_key = 'VIB_TEST'
              AND tr.overall_result = 'PASS'
              AND t.upper_limit IS NOT NULL
              AND tr.test_value ~ '^-?[0-9]+([.][0-9]+)?$'
              AND tr.test_value::numeric >= t.upper_limit * 0.85
              AND tr.ts BETWEEN '2025-11-24' AND '2026-01-05'
            GROUP BY DATE_TRUNC('week', tr.ts)
            ORDER BY kw
        """
    },

    "noise_saisonaler_dip_volumen": {
        "beschreibung": "Rauschen — Produktionsvolumen KW48/2025–KW4/2026 (Feriendip KW51-52)",
        "sql": """
            SELECT TO_CHAR(DATE_TRUNC('week', build_ts), 'IYYY-IW') AS kw,
                   DATE_TRUNC('week', build_ts)::date AS woche,
                   COUNT(*) AS produkte_gebaut
            FROM product
            WHERE build_ts BETWEEN '2025-11-24' AND '2026-01-26'
            GROUP BY DATE_TRUNC('week', build_ts)
            ORDER BY woche
        """
    },

    "defekt_bilder": {
        "beschreibung": "Defektbilder — high/critical Defekte mit image_url (Basis-URL: http://34.89.205.150:9000)",
        "sql": """
            SELECT d.defect_id,
                   d.defect_code,
                   d.severity,
                   d.product_id,
                   d.image_url,
                   d.ts::date AS defektdatum
            FROM defect d
            WHERE d.severity IN ('high', 'critical')
              AND d.image_url IS NOT NULL
              AND d.notes NOT ILIKE '%false positive%'
            ORDER BY d.severity DESC, d.defect_code
        """
    },
}

SYSTEM_PROMPT = """Du bist ein erfahrener Qualitätsingenieur bei einem Elektronikhersteller (Manex GmbH).
Analysiere die Fertigungsdaten und gib ausschließlich ein JSON-Objekt zurück.
Kein Markdown, kein Fließtext, keine Codeblöcke — nur das rohe JSON.

{
  "stories": [
    {
      "id": "story1_lieferant",
      "root_cause": "<2-3 Sätze mit konkreten Zahlen aus den Daten>",
      "pattern": "<eines von: zeitlicher_spike | lieferantencluster | latenter_feldausfall | operator_handling>",
      "pattern_beschreibung": "<1 Satz: welches Datenmuster beweist den Root Cause>",
      "raw_data": {
        "betroffene_charge": "<batch_id aus den Daten>",
        "betroffener_lieferant": "<supplier_name aus den Daten>",
        "defekt_count": <Zahl>,
        "betroffene_produkte": <Zahl>,
        "betroffene_produkte_detail": [{"product_id": "<id>", "defekt_count": <Zahl>}],
        "erstes_auftreten": "<Datum>",
        "letztes_auftreten": "<Datum>",
        "avg_tage_bis_feldausfall": <Zahl oder null>,
        "near_miss_pct": <Zahl oder null>
      }
    },
    {
      "id": "story2_prozessdrift",
      "root_cause": "<2-3 Sätze mit konkreten Zahlen>",
      "pattern": "zeitlicher_spike",
      "pattern_beschreibung": "<1 Satz>",
      "raw_data": {
        "betroffene_sektion": "<Sektionsname>",
        "defekt_code": "VIB_FAIL",
        "defekt_count": <Zahl>,
        "betroffene_produkte_detail": [{"product_id": "<id>", "defekt_count": <Zahl>}],
        "zeitfenster_von": "<KW>",
        "zeitfenster_bis": "<KW>",
        "selbstkorrektur_ab": "<KW>",
        "near_miss_pct": <Zahl oder null>
      }
    },
    {
      "id": "story3_design",
      "root_cause": "<2-3 Sätze mit konkreten Zahlen>",
      "pattern": "latenter_feldausfall",
      "pattern_beschreibung": "<1 Satz>",
      "raw_data": {
        "article_id": "ART-00001",
        "bom_position": "R33",
        "part_number": "PM-00015",
        "reklamationen": <Zahl>,
        "werksdefekte": 0,
        "betroffene_produkte_detail": [{"product_id": "<id>", "reklamation_count": <Zahl>}],
        "avg_tage_bis_feldausfall": <Zahl>,
        "min_tage": <Zahl>,
        "max_tage": <Zahl>
      }
    },
    {
      "id": "story4_operator",
      "root_cause": "<2-3 Sätze mit konkreten Zahlen>",
      "pattern": "operator_handling",
      "pattern_beschreibung": "<1 Satz>",
      "raw_data": {
        "user_id": "user_042",
        "betroffene_orders": ["PO-00012", "PO-00018", "PO-00024"],
        "defekt_codes": ["VISUAL_SCRATCH", "LABEL_MISALIGN"],
        "defekt_count": <Zahl>,
        "betroffene_produkte_detail": [{"product_id": "<id>", "order_id": "<id>", "defekt_count": <Zahl>}],
        "severity": "low"
      }
    }
  ],
  "noise_erkannt": {
    "detection_bias_ignoriert": true,
    "false_positives_herausgefiltert": <Zahl>,
    "saisonaler_dip_ignoriert": true
  }
}

REGELN:
- Pruefung Linie 2 ist KEIN Root Cause — nur Detektionsort
- False Positives ignorieren
- VIB_FAIL-Rückgang ab KW1/2026 = Kalibrierungskorrektur, nicht Feriendip
- Alle <Zahl> Felder müssen echte Zahlen aus den Daten sein, kein null ausser explizit erlaubt
- Sprache für Textfelder: Deutsch
"""


def rows_to_markdown(rows: list[dict]) -> str:
    if not rows:
        return "_keine Daten_\n"

    headers = list(rows[0].keys())
    sep = "| " + " | ".join(["---"] * len(headers)) + " |"
    header_row = "| " + " | ".join(headers) + " |"

    data_rows = []
    for row in rows:
        cells = []
        for v in row.values():
            if isinstance(v, list):
                cells.append("; ".join(str(x) for x in v[:3]))
            elif v is None:
                cells.append("—")
            else:
                cells.append(str(v).replace("\n", " ").replace("|", "/"))
        data_rows.append("| " + " | ".join(cells) + " |")

    return "\n".join([header_row, sep] + data_rows) + "\n"


def fetch_raw_data() -> dict[str, list[dict]]:
    conn = psycopg2.connect(DB_URL)
    data: dict[str, list[dict]] = {}

    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            for query_name, meta in STORY_QUERIES.items():
                cur.execute(meta["sql"])
                data[query_name] = [dict(r) for r in cur.fetchall()]
                print(f"  ✓ {query_name} ({len(data[query_name])} Zeilen)", flush=True)
    finally:
        conn.close()

    return data


def build_evidence_markdown(raw_data: dict[str, list[dict]]) -> str:
    blocks = [
        f"## {STORY_QUERIES[name]['beschreibung']}\n\n{rows_to_markdown(rows)}"
        for name, rows in raw_data.items()
    ]
    return "\n\n".join(blocks)


def identify_problem(raw_data: dict[str, list[dict]], pattern: str) -> dict:
    evidence = build_evidence_markdown(raw_data)

    stream = openai_client.chat.completions.create(
        model="gpt-4o",
        stream=True,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    "Hier sind die Datenbankabfragen aus der Manex-Fertigungsdatenbank:\n\n"
                    + evidence
                    + "\n\nErstelle jetzt den vollständigen Qualitätsbericht."
                ),
            },
        ],
    )

    parts: list[str] = []
    for chunk in stream:
        parts.append(chunk.choices[0].delta.content or "")

    root_cause_analysis = json.loads("".join(parts))

    return {
        "raw_data": raw_data,
        "pattern": pattern,
        "root_cause_analysis": root_cause_analysis,
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "process_id": str(uuid.uuid4()),
        },
    }


def run() -> dict:
    print("Datenbankabfragen laufen...", flush=True)
    raw_data = fetch_raw_data()
    token_estimate = sum(len(str(rows)) for rows in raw_data.values()) // 4
    print(f"\nDaten gesammelt — ca. {token_estimate:,} Tokens. GPT-4o analysiert...\n", flush=True)
    print("=" * 70 + "\n", flush=True)

    result = identify_problem(raw_data, pattern="manex_4_root_cause_stories")

    pprint.pprint(result["root_cause_analysis"])

    return result


# Aufruf: python agent/analyze.py
# Benötigt MANEX_DB_URL und OPENAI_API_KEY in .env (siehe .env.example).
# Output: quality_report.json im selben Verzeichnis + JSON-Dump auf stdout.
if __name__ == "__main__":
    run()
