# Deterministische SQL-Aggregationen fuer das /analyse-Dashboard.
# compute_analytics() liefert das analytics-Sub-Dict fuer den Snapshot
# mit 5 KPIs und 2 Chart-Datasets; wird aus refresh.py aufgerufen.

from datetime import datetime, timezone

from . import config

PROBLEM_TYPE_LABELS = {
    "supply": "Zulieferer",
    "technical_process": "Prozess",
    "technical_design": "Design",
    "personnel": "Personal",
    "other": "Sonstiges",
}


def compute_analytics(cur) -> dict:
    window = config.ANALYTICS_WINDOW_DAYS

    time_saved_hours, prevented_claims = _compute_savings(cur, window)
    money_saved = (
        time_saved_hours * config.HOURLY_REWORK_RATE_EUR
        + prevented_claims * config.PREVENTED_CLAIM_COST_EUR
    )

    return {
        "kpis": {
            "timeSavedHours": round(time_saved_hours, 1),
            "moneySavedEur": int(round(money_saved)),
            "topDefects": _top_defects(cur, window),
            "avgResolutionHours": _avg_resolution_hours(cur, window),
            "issuesLast30Days": _issues_last_30d(cur),
            "preventedClaims": prevented_claims,
            "narrative": None,
        },
        "charts": {
            "defectsByProductGroup": _defects_by_product_group(cur, window),
            "problemTypes": _problem_types(cur, window),
        },
        "computedAt": datetime.now(timezone.utc).isoformat(),
        "windowDays": window,
        "assumptions": {
            "hourlyReworkRateEur": config.HOURLY_REWORK_RATE_EUR,
            "preventedClaimCostEur": config.PREVENTED_CLAIM_COST_EUR,
        },
    }


def _compute_savings(cur, window_days: int) -> tuple[float, int]:
    cur.execute(
        """
        WITH repeats AS (
            SELECT d.defect_code,
                   d.reported_part_number,
                   COUNT(*) AS occurrences,
                   AVG(r.time_minutes) AS avg_minutes
            FROM defect d
            JOIN rework r ON d.defect_id = r.defect_id
            WHERE d.ts > NOW() - (%s || ' days')::interval
              AND r.time_minutes IS NOT NULL
            GROUP BY d.defect_code, d.reported_part_number
            HAVING COUNT(*) >= 2
        )
        SELECT COALESCE(SUM(avg_minutes * (occurrences - 1)), 0) / 60.0 AS hours_saved
        FROM repeats
        """,
        (window_days,),
    )
    hours = float(cur.fetchone()["hours_saved"] or 0)

    cur.execute(
        """
        SELECT COUNT(DISTINCT d.defect_id) AS prevented
        FROM defect d
        JOIN rework r ON d.defect_id = r.defect_id
        WHERE d.severity IN ('high', 'critical')
          AND d.ts > NOW() - (%s || ' days')::interval
        """,
        (window_days,),
    )
    prevented = int(cur.fetchone()["prevented"] or 0)

    return hours, prevented


def _top_defects(cur, window_days: int) -> list[dict]:
    cur.execute(
        """
        SELECT defect_code,
               COUNT(*) AS count,
               MAX(severity) AS severity
        FROM defect
        WHERE ts > NOW() - (%s || ' days')::interval
          AND defect_code IS NOT NULL
          AND (notes IS NULL OR notes NOT ILIKE '%%false positive%%')
        GROUP BY defect_code
        ORDER BY count DESC
        LIMIT %s
        """,
        (window_days, config.TOP_DEFECTS_LIMIT),
    )
    return [
        {
            "code": r["defect_code"],
            "count": int(r["count"]),
            "severity": r["severity"],
        }
        for r in cur.fetchall()
    ]


def _avg_resolution_hours(cur, window_days: int) -> float:
    cur.execute(
        """
        SELECT AVG(EXTRACT(EPOCH FROM (r.ts - d.ts)) / 3600.0) AS avg_hours
        FROM defect d
        JOIN rework r ON d.defect_id = r.defect_id
        WHERE d.ts > NOW() - (%s || ' days')::interval
          AND r.ts IS NOT NULL
          AND d.ts IS NOT NULL
          AND r.ts >= d.ts
        """,
        (window_days,),
    )
    value = cur.fetchone()["avg_hours"]
    return round(float(value), 1) if value is not None else 0.0


def _issues_last_30d(cur) -> int:
    cur.execute(
        """
        SELECT
          (SELECT COUNT(*) FROM defect WHERE ts > NOW() - INTERVAL '30 days') +
          (SELECT COUNT(*) FROM field_claim WHERE claim_ts > NOW() - INTERVAL '30 days')
          AS total
        """
    )
    return int(cur.fetchone()["total"] or 0)


def _defects_by_product_group(cur, window_days: int) -> list[dict]:
    cur.execute(
        """
        SELECT a.article_id,
               a.name AS article_name,
               COUNT(d.defect_id) AS defect_count,
               array_agg(DISTINCT d.defect_id ORDER BY d.defect_id) FILTER (WHERE d.defect_id IS NOT NULL) AS defect_ids
        FROM article a
        LEFT JOIN product p ON a.article_id = p.article_id
        LEFT JOIN defect d ON p.product_id = d.product_id
          AND d.ts > NOW() - (%s || ' days')::interval
          AND (d.notes IS NULL OR d.notes NOT ILIKE '%%false positive%%')
        GROUP BY a.article_id, a.name
        HAVING COUNT(d.defect_id) > 0
        ORDER BY defect_count DESC
        """,
        (window_days,),
    )
    return [
        {
            "articleId": r["article_id"],
            "name": r["article_name"],
            "count": int(r["defect_count"]),
            "defects": (r["defect_ids"] or [])[:20],
        }
        for r in cur.fetchall()
    ]


def _problem_types(cur, window_days: int) -> list[dict]:
    cur.execute(
        """
        WITH classified AS (
            SELECT d.defect_id,
                   CASE
                     WHEN d.defect_code IN ('SOLDER_COLD', 'PART_WRONG')
                       THEN 'supply'
                     WHEN d.defect_code IN ('VIB_FAIL', 'TORQUE_FAIL', 'ASSEMBLY_FAIL')
                       THEN 'technical_process'
                     WHEN d.severity = 'low'
                       AND d.defect_code IN ('VISUAL_SCRATCH', 'LABEL_MISALIGN', 'COSMETIC')
                       THEN 'personnel'
                     ELSE 'other'
                   END AS problem_type
            FROM defect d
            WHERE d.ts > NOW() - (%s || ' days')::interval
              AND (d.notes IS NULL OR d.notes NOT ILIKE '%%false positive%%')
        ),
        design_leaks AS (
            SELECT fc.field_claim_id AS defect_id,
                   'technical_design'::text AS problem_type
            FROM field_claim fc
            WHERE fc.claim_ts > NOW() - (%s || ' days')::interval
              AND fc.mapped_defect_id IS NULL
        ),
        combined AS (
            SELECT problem_type, defect_id FROM classified
            UNION ALL
            SELECT problem_type, defect_id FROM design_leaks
        )
        SELECT problem_type,
               COUNT(*) AS count,
               array_agg(defect_id ORDER BY defect_id) AS ids
        FROM combined
        GROUP BY problem_type
        ORDER BY count DESC
        """,
        (window_days, window_days),
    )
    rows = cur.fetchall()
    return [
        {
            "type": r["problem_type"],
            "label": PROBLEM_TYPE_LABELS.get(r["problem_type"], r["problem_type"]),
            "count": int(r["count"]),
            "defects": (r["ids"] or [])[:20],
        }
        for r in rows
    ]
