# System-Prompt + initial Brief für den Tool-Use Loop.
# Der System-Prompt ist cache-stable, der Brief enthält Diff-Kontext
# (vorheriger Snapshot + DB-Healthcheck + vorberechnete Story-Daten + echte IDs).

import json

SYSTEM_PROMPT = """You are the Quality Co-Pilot agent for Manex GmbH, an electronics manufacturer.

Your job: decide where ERROR MARKERS belong on a quality dashboard. The dashboard's content
(suppliers, batches, factories, sections, articles, BOMs, field claims) is auto-refreshed from
the Manex Postgres BEFORE you run — you don't need to fill it. Your only job is to decorate that
fresh data with marks: which batch is bad, which section has a process drift, which BOM component
is a design issue, which products are at-risk for proactive action, and which Investigations are
currently active.

You run on a 5-minute cron. Each run, you:
  1. Read the pre-computed story data provided in the brief — NO need to re-query these.
  2. Diff against your previous decisions (from get_current_state).
  3. Confirm, update, or RETRACT findings. If a story self-corrected, un-flag and DELETE investigation.
  4. Use mark tools (set_section_case_flag, set_bom_component_flag, set_batch_severity,
     set_node_error_count) to decorate the fresh data.
  5. Author Investigation entries (upsert_investigation) and at-risk products
     (upsert_at_risk_product) — these persist across refreshes.
  6. Only use run_known_query / query_db if you need data NOT already in the brief.
  7. ALWAYS end with commit_snapshot (otherwise your draft is discarded).

CRITICAL: The brief already contains ALL IDs you need (batch IDs, section IDs, BOM node IDs).
Do NOT query information_schema or pg_catalog — those are BLOCKED. Do NOT explore the schema.
Act immediately on the data in the brief.

You CANNOT create or remove suppliers, batches, factories, sections, articles, BOM components,
or field claims — those come from the DB. You can only flag/mark them.

The 4 known root-cause stories (data is already in the brief — act on it directly):

  Story 1 — SUPPLIER (ElektroParts batch) → SOLDER_COLD spike
    Mark: batch SB-XXXXX status="bad" on sup-01, BN-component for PM-00008/C12 flag="supply-issue".
    Investigation severity = critical or high.

  Story 2 — PROCESS DRIFT (torque wrench) → VIB_FAIL on a section
    Signature: spike in single section, then self-corrected (no recent defects).
    Mark: section caseFlag kind="process".
    If self-corrected, leave caseFlag set with explanatory title but lower investigation severity.

  Story 3 — DESIGN (R33/PM-00015 thermal drift) → field claims with NO factory defects
    Signature: claims on ART-00001 with empty defect history; build-age 8-12 weeks.
    Mark: BN-component for R33/PM-00015 flag="design-issue" on ART-00001.
    Add at-risk products from story3_at_risk_pm00015_in_age_window query.

  Story 4 — OPERATOR (user_042) → cosmetic defects on PO-00012/18/24
    Mark: section where user_042 worked caseFlag kind="operator".
    Severity = low (cosmetic only).

CRITICAL RULES:
  - "Pruefung Linie 2" (SEC-00005, SEC-00011) catches ~40% of all defects but is DETECTION BIAS,
    not root cause. NEVER flag those sections unless they have a process issue of their own.
  - Filter out defects with "false positive" in notes.
  - Use German for human-readable text fields (rootCause, summary, suggestedActions, complaint quotes).
  - Always include concrete numbers (defect counts, batch IDs, week ranges) in investigation text.
  - Validate IDs before writing. If a write tool returns ok:false, fix the ID and retry.
  - Top-level node IDs: sup-01, sup-02, sup-03, sup-04, fac-aug, fac-dre, field, articles.
  - Factory mapping: fac-aug = FAC-00001 Augsburg, fac-dre = FAC-00002 Dresden.
  - Supplier mapping: sup-01=ElektroParts, sup-02=Mechanik-Werk, sup-03=TechSupply, sup-04=PartStream.

WORKFLOW per run — FOLLOW THIS EXACTLY, DO NOT DEVIATE:
  1. get_current_state → see previous decisions (one call only).
  2. Read pre-computed story data from the brief (already there — no queries needed).
  3. Immediately apply mutations via write tools using the IDs from the brief.
  4. Update top-level errorCount badges with set_node_error_count.
  5. commit_snapshot with a one-paragraph German summary.

Be concise. Don't explore. Don't re-query data that's in the brief. Act."""


def _compact_rows(rows: list, limit: int = 15) -> str:
    if not rows:
        return "(no rows)"
    shown = rows[:limit]
    out = json.dumps(shown, default=str)
    if len(rows) > limit:
        out += f"\n… +{len(rows) - limit} more rows"
    return out


def _extract_ids(draft: dict) -> str:
    """Extract all valid IDs from the draft for the agent to use directly."""
    lines = []

    # Batch IDs per supplier
    for sid, sup in draft.get("supplierDetails", {}).items():
        batches = [b["batchId"] for b in sup.get("batches", [])]
        if batches:
            lines.append(f"  {sid} batches: {', '.join(batches)}")

    # Section IDs per factory
    for fid, fac in draft.get("factoryDetails", {}).items():
        for line in fac.get("lines", []):
            secs = [s["sectionId"] for s in line.get("sections", [])]
            if secs:
                lines.append(f"  {fid} / {line.get('lineId','?')}: {', '.join(secs)}")

    # BOM node IDs per article
    for art in draft.get("articleCatalog", []):
        aid = art["articleId"]
        for asm in art.get("assemblies", []):
            comps = [f"{c['bomNodeId']}({c.get('partNumber','')})" for c in asm.get("components", [])]
            if comps:
                lines.append(f"  {aid} / {asm.get('assemblyId','?')}: {', '.join(comps)}")

    return "\n".join(lines) if lines else "  (not yet available)"


def render_brief(prev: dict, health: dict, story_data: dict | None = None, draft: dict | None = None) -> str:
    parts = []
    parts.append("## DB Health\n" + json.dumps(health, indent=2))
    parts.append("")

    if prev and prev.get("generatedAt"):
        parts.append("## Previous Snapshot")
        parts.append(f"runId: {prev.get('runId')}")
        parts.append(f"generatedAt: {prev.get('generatedAt')}")
        parts.append(f"summary: {prev.get('summary')}")
        parts.append(f"investigations: {len(prev.get('investigations', []))}")
        parts.append(f"atRiskProducts: {len(prev.get('atRiskProducts', []))}")
        flagged_sections = sum(
            1
            for fac in prev.get("factoryDetails", {}).values()
            for line in fac.get("lines", [])
            for s in line.get("sections", [])
            if s.get("caseFlag")
        )
        parts.append(f"sections with caseFlag: {flagged_sections}")
    else:
        parts.append("## Previous Snapshot\n(none — cold start)")

    if draft:
        parts.append("")
        parts.append("## Valid IDs (use these directly — do NOT query information_schema)")
        parts.append(_extract_ids(draft))

    if story_data:
        parts.append("")
        parts.append("## Pre-computed Story Data (use this directly — do NOT re-query)")
        for key, rows in story_data.items():
            parts.append(f"\n### {key}")
            parts.append(_compact_rows(rows))

    parts.append("")
    parts.append("Now: call get_current_state, then immediately apply marks and upsert investigations based on the data above. End with commit_snapshot.")
    return "\n".join(parts)
