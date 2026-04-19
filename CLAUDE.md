# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Context

This is the **Thinc Hackathon 2026** team solution repository. The challenge is to build an **Interactive Quality Co-Pilot** for the fictional manufacturer "Manex" — replacing static Excel-based 8D/FMEA reports with an LLM-powered, interactive quality reporting system.

The reference infrastructure (schema, seed data, Docker setup) lives in `manex-base/` (read-only, third-party). This repo is where the team's actual solution is built — split across **four parts** that are starting to come together.

## Repo Architecture

```
Hack_MUC/
├── manex-base/          (read-only)  — Manex-provided schema, seed, docs
├── frontend/            (Next.js)    — Quality Co-Pilot UI
├── agent/               (Python)     — Legacy story analyzer (GPT-4o, single-shot)
├── agent_service/       (Python)     — NEW: tool-using Claude Sonnet 4.6 agent + DB refresh
├── portal/              (FastAPI)    — Shared-link portal + document upload + RAG-Ingestion
├── rag/                 (Python)     — Standalone RAG-Pipeline (Qdrant + OpenAI Embeddings)
├── start.sh                          — Env-Bootstrap + Manex-API Healthcheck
└── .env                              — MANEX_API_URL, MANEX_API_KEY, MANEX_DB_URL,
                                        OPENAI_API_KEY, ANTHROPIC_API_KEY
```

The pipeline is now **end-to-end wired** via `agent_service` writing `frontend/public/agent_state.json` — see "Connection Map" below.

---

## Part 1 — `frontend/` (Next.js Quality Co-Pilot UI)

Next.js 15 App Router (no `src/`-folder), React 19, Tailwind v4, TypeScript. Routes live in `frontend/app/`.

**Hauptlayout:** Sticky NavTabs (`Investigations` · `Analyse` · `Archive`) auf jeder Seite via `app/layout.tsx`.

### Routes

| Route | Datei | Inhalt |
|---|---|---|
| `/` | `app/page.tsx` | **Split-Layout:** Investigations-Liste links (`w-[680px]`, scrollbar), Flow-Canvas rechts |
| `/investigations/[id]` | `app/investigations/[id]/page.tsx` | Detail-View pro Investigation: Root-Cause, Timeline, Affected Products, Suggested Actions |
| `/investigations/[id]/action` | `app/investigations/[id]/action/page.tsx` | Action-Creator-Form (POST → `product_action`) |
| `/analyse` | `app/analyse/page.tsx` | Stub ("Coming soon") |
| `/archive` | `app/archive/page.tsx` | Stub ("Coming soon") |

### `app/data.ts`
Hardcodierter Investigation-Datensatz mit 4 Cases (`INV-001`…`INV-004`) — mappt 1:1 auf die 4 Stories aus `DATA_PATTERNS.md`. Felder: `id`, `severity`, `title`, `source`, `summary`, `defects`, `claims`, `risk`, `status`, `age`, `rootCause`, `timeline[]`, `affectedProducts[]`, `suggestedActions[]`. Wird (noch) nicht aus der DB geladen.

### `app/_flow/` — Topology-Canvas (interaktiv, klickbar)

Interaktive Visualisierung der Supply-Chain-Topologie + Drilldown in jede Domäne. Nutzt **`@xyflow/react ^12.10.2`**.

| File | Rolle |
|---|---|
| `FlowView.tsx` | Top-Level-Canvas: 4 Suppliers + 2 Factories (parallel mit "tauschen" bidirektional Test-Pool) + Articles + Field. Click → Zoom-In → Detail-Overlay |
| `flow-data.ts` | Alle Datenstrukturen + hardcodierte Mock-Daten: Topologie-Nodes, Articles + BOMs, Factories (Lines + Sections + caseFlags), Field-Claims + at-risk Population |
| `flow-nodes.tsx` | `FlowNode` (compact) + `FlowMiniNode` + `BgNode` (für Zoom-In-Container-Effekt) |
| `flow-edges.tsx` | `LabeledEdge` mit Bezier-Path, Label, markerStart-Support |
| `SupplierDetail.tsx` | ElektroParts-Detail mit Batch-Timeline (Year/Month/Week-Granularity) |
| `ArticleCatalog.tsx` | Article-Picker (links) + BOM-Blume (rechts) mit Tabs pro Baugruppe, eigener React-Flow-Instanz mit gapped Edges |
| `FactoryDetail.tsx` | Werks-Mittelview: Lines als Container + 3 Sections (Montage→Pruefung→Verpackung) mit caseFlag-Banner für Story 2/4 |
| `FieldDetail.tsx` | Articles mit Claims + at-risk Population (Story 1 Supply + Story 3 Design Risiko) |
| `AgentPanel.tsx` | Vorhanden, aber **nicht eingebunden** — wurde aus FlowView entfernt für Split-Layout |

### Animationen / globals.css
`animate-node-disappear`, `animate-node-pop-in`, `animate-edge-disappear`, `animate-edge-appear`, `animate-panel-fade-in`, `animate-panel-fade-out` — werden vom FlowView-Zoom-Pattern verwendet.

### Wichtig — Constraints
- `_flow/`-Komponenten sind **client-only**, deshalb auf `/` per `next/dynamic` mit `ssr: false` importiert
- `FlowView` ist `absolute inset-0` und braucht einen `relative` Parent mit fester Höhe (z.B. `style={{height: 'calc(100vh - 64px)'}}`)
- Zurück-Button (Sub-Flow-Mode) ist `fixed top-20 left-6 z-30` — sitzt über der Investigations-Liste
- React Flow v12 spezifisch: package heißt `@xyflow/react` (nicht `reactflow`), CSS-Import: `@xyflow/react/dist/style.css`

---

## Part 2 — `agent/` (Legacy GPT-4o Single-Shot, deprecated)

| File | Rolle |
|---|---|
| `analyze.py` | 27 SQL-Queries pro Story + GPT-4o-Reportgenerierung — **Quelle für die Named Queries in `agent_service/db.py`** |
| `verify.py` | Deterministische SQL-Consistency-Rules — **vom neuen Agent via `verify_consistency`-Tool wiederverwendet** |
| `plan.py`, `plan 2.py`, `verify 2.py` | WIP / Duplikat-Files |
| `requirements.txt` | `openai`, `psycopg2-binary`, `python-dotenv` |

Wird nicht mehr direkt aufgerufen — `agent_service/` hat den Loop übernommen. Code bleibt als Referenz.

---

## Part 2b — `agent_service/` (NEW: Tool-Using Claude Sonnet 4.6 Agent)

Echter agentic Loop mit nativem Anthropic Tool-Use + Prompt-Caching. Läuft in zwei Phasen:
**(1) Deterministischer DB-Refresh** füllt Canvas-Inhalte, **(2) Optionaler Claude-Loop** decoriert mit Marks/Investigations.

| File | Rolle |
|---|---|
| `loop.py` | Main entry: `run_once()` — refresh + agent loop (max 30 turns) + atomic snapshot write |
| `cron.py` | `while True: run_once(); sleep(300)` — 5-Min Cadence |
| `refresh.py` | Phase 1: pure-SQL fetch (suppliers/factories/articles/field-claims) + `merge_with_prev()` (überträgt Agent-Decisions auf fresh Daten) |
| `tools.py` | 15 Tool-Defs (6 read + 9 write) + Executor-Dispatch + ID-Validation gegen Layout-Skeleton |
| `db.py` | `connect()`, 14 `NAMED_QUERIES` (extrahiert aus `agent/analyze.py`), `healthcheck()`, `next_run_id()`, `insert_audit()` |
| `state.py` | `load_snapshot()`, `write_snapshot_atomic()` (mit `fcntl.flock`), ID-Mappings (`SUPPLIER_DB_TO_NODE`, `FACTORY_DB_TO_NODE`), `TOP_LEVEL_NODE_IDS` |
| `prompts.py` | `SYSTEM_PROMPT` (cache-stable, beschreibt 4 Stories + Mark-Tools) + `render_brief()` (DB-Health + prev-Snapshot-Stats) |
| `rag_tool.py` | Wraps `rag/rag.py:retrieve()` für `rag_search`-Tool |
| `requirements.txt` | `anthropic`, `psycopg2-binary`, `python-dotenv` |

### Tool-Surface (Anthropic Tool-Use)

**Read-Tools (Side-Effect-frei):**
- `list_known_queries` — listet die 14 Story-SQLs
- `run_known_query` — z.B. `story1_supplier_solder_cold`, `story2_vib_fail_by_section_week`, `story3_field_claims_no_factory_defect`, `story4_cosmetic_defects_by_operator`
- `query_db` — free-form SELECT (allowlisted)
- `rag_search` — semantische Suche über Qdrant
- `get_current_state` — vorheriger Snapshot zum Diffen
- `verify_consistency` — wraps `agent/verify.py:RULES`

**Write-Tools (mutieren in-memory Draft, validieren IDs):**
- `set_node_error_count`, `set_node_subtitle` — Top-Level-Badges
- `set_batch_severity` — Batch-Pille rot/gelb/grau
- `set_section_case_flag` — Section-Ring + Banner (kind: process/operator)
- `set_bom_component_flag` — BOM-Ring (design-issue/supply-issue)
- `upsert_at_risk_product` — Field-Detail Card
- `upsert_investigation` / `delete_investigation` — Dashboard-Liste + Detail-Page
- `commit_snapshot` — atomic write nach `frontend/public/agent_state.json`, beendet Loop

### Wie der Agent das Canvas-Schema kennt

1. **Hardcoded im System-Prompt** ([prompts.py:62-64](agent_service/prompts.py#L62-L64)): Top-Level-Node-IDs (`sup-01..sup-04`, `fac-aug`, `fac-dre`, `field`, `articles`) + Factory/Supplier-Mappings.
2. **Live via `get_current_state`**: Sieht echte `batchId`, `sectionId`, `bomNodeId` — die kommen aus dem Refresh.
3. **ID-Validierung**: Write-Tools returnen `{ok: false, error: "..."}` bei unbekannten IDs → Modell self-correctet im nächsten Turn.

### Snapshot-Schema (`frontend/public/agent_state.json`)

```ts
{
  schemaVersion: 1, generatedAt, model: "claude-sonnet-4-6", runId, summary,
  nodes: { "sup-01": { errorCount, subtitle }, ... },
  supplierDetails: { "sup-01": { batches[], partMasters[] } },   // ← Refresh
  factoryDetails: { "fac-aug": { lines[].sections[].caseFlag } },// ← Refresh + Agent
  articleCatalog: [{ assemblies[].components[].flag }],          // ← Refresh + Agent
  fieldClaims: [...],                                            // ← Refresh
  atRiskProducts: [...],                                         // ← Agent only
  investigations: [...]                                          // ← Agent only
}
```

### Wie man den Agent testet (Reihenfolge!)

**Voraussetzung:** `.env` im Repo-Root mit `MANEX_DB_URL` (Pflicht) und `ANTHROPIC_API_KEY` (optional).

```bash
# 1. Smoke-Test: Imports laufen?
python3 -c "from agent_service import refresh, loop, tools; print('ok', len(tools.TOOL_DEFS))"

# 2. Refresh-only Run (kein Agent, nur DB → JSON):
#    Erwartet: 4 Suppliers, 2 Factories, 5 Articles, ~100 Claims im JSON.
#    Funktioniert auch ohne ANTHROPIC_API_KEY.
python3 -m agent_service.refresh

# 3. Voller Loop (Refresh + Agent-Decoration):
#    Erwartet: 5-15 Tool-Use-Turns, am Ende commit_snapshot.
#    Logs: "[loop] turn N: tool=X result_len=Y" auf stderr.
python3 -m agent_service.loop

# 4. Output prüfen:
cat frontend/public/agent_state.json | jq '.summary, .runId, (.investigations | length)'

# 5. Cron-Mode (5min-Cadence, im Background):
python3 -m agent_service.cron &
```

**Was gut aussieht:**
- `agent_state.json` enthält `generatedAt` mit aktuellem Timestamp
- `investigations[]` hat 2-4 Einträge (eine pro aktiver Story)
- Mindestens eine `factoryDetails.*.lines[].sections[].caseFlag` ist gesetzt (Story 2/4)
- Mindestens eine `articleCatalog[].assemblies[].components[].flag` ist gesetzt (Story 1/3)
- `atRiskProducts[]` hat ~20 Einträge (Story 3 R33-Population)

**Frontend-Sicht:** `cd frontend && npm run dev` → `http://localhost:3000`. Investigations-Liste links zeigt Agent-Output, Canvas rechts hat rote Badges auf `sup-01` + `field`.

**Troubleshooting:**
- `MANEX_DB_URL is not set` → `.env` fehlt oder im falschen Pfad. Loader: [loop.py:13](agent_service/loop.py#L13) sucht `.env` ein Verzeichnis über `agent_service/`.
- `[loop] DB unreachable` → Manex-Container nicht hoch. `docker ps | grep manex` prüfen, ggf. `cd manex-base && docker compose up -d`.
- `[loop] no ANTHROPIC_API_KEY — writing refreshed snapshot without agent marks` → Erwartetes Verhalten, Canvas zeigt DB-Daten ohne Marks.
- Agent ruft 30 Turns ohne `commit_snapshot` → Draft wird trotzdem geschrieben (siehe [loop.py:104-105](agent_service/loop.py#L104-L105)), aber `summary` fehlt.

### Frontend-Bridge

| File | Rolle |
|---|---|
| `frontend/app/_flow/agent-state.ts` | `useAgentState()` Hook — fetcht `/agent_state.json` alle 10s, liefert `null` bei leerem Snapshot |
| `frontend/app/_flow/applyAgentState.ts` | `applyNodeOverrides()` + `pickArticleCatalog/SupplierDetail/FactoryDetail/FieldClaims/AtRisk/Investigations()` — strict empty-mode (kein Mock-Fallback) |
| `frontend/app/useInvestigations.ts` | Hook für Investigations-Liste/Detail aus Snapshot |
| `frontend/public/agent_state.json` | Snapshot-File (Initial leer, wird vom Agent atomar überschrieben) |

## Part 3 — `portal/` (FastAPI Multi-Tenant Backend)

| File | Rolle |
|---|---|
| `main.py` | FastAPI-Server: Share-Links, Document-Upload, RAG-Ingestion, Static-File-Serving |

- **Endpoints** (laut Code-Header): `/upload` (PDF/DOCX/PPTX/etc. via Docling), CRUD für Share-Links
- **SQLite-Tabellen**: `share_links`, `rag_documents`, `rag_claims`, `rag_contradictions`
- **Qdrant** (lokales Storage in `rag/qdrant_storage/`) für Vector-Embeddings via `text-embedding-3-small`
- **Docling** für Dokument-Parsing
- Liest `.env` aus Projekt-Root für `OPENAI_API_KEY`

## Part 4 — `rag/` (Standalone RAG-Pipeline)

| File | Rolle |
|---|---|
| `rag.py` | Funktionen: `index_document()`, `retrieve()`, `answer()`, `chunk_text()`, `embed()` |

- Wird vom `portal/` benutzt (gleiches Qdrant-Storage)
- Kein eigener HTTP-Server — wird programmtisch importiert

## start.sh

- Source `.env`, Healthcheck via `curl -H Authorization: Bearer $MANEX_API_KEY $MANEX_API_URL/defect?limit=1`
- Öffnet Studio-UI im Browser
- Setzt env-Variablen für die Shell

---

## Connection Map

**Was bereits verbunden ist:**
- `agent_service/loop.py` ↔ Manex-Postgres + Qdrant-RAG + Claude Sonnet 4.6 → schreibt `frontend/public/agent_state.json`
- `frontend/app/_flow/agent-state.ts` polled `/agent_state.json` alle 10s → `useAgentState()` versorgt FlowView, SupplierDetail, FactoryDetail, ArticleCatalog, FieldDetail
- `frontend/app/useInvestigations.ts` ↔ Snapshot → Investigations-Liste + Detail-Pages
- `portal/main.py` ↔ `rag/qdrant_storage/` ↔ OpenAI-Embeddings (Document-Upload)
- `frontend/app/investigations/[id]/action/page.tsx` ↔ PostgREST-`product_action`-Insert

**Was noch NICHT verbunden ist:**
- ❌ `frontend` ↔ `portal` — kein API-Call vom Frontend zum Portal (Document-Upload nur via Portal-eigener UI)
- ❌ `agent_service` schreibt keine Audit-Tabelle in Manex (`insert_audit` ist im Code, aber `CREATE TABLE public.agent_run` muss noch laufen)
- ❌ Kein WebSocket/SSE — Frontend pollt JSON, was für Demo OK ist

---

## Manex Infrastructure (External)

### Data Access Tiers
| Tier | Use when |
|------|----------|
| **PostgREST REST API** (port 8000+N) | Client-side fetching, supabase-js |
| **Supabase Studio** (port 8400+N) | Exploratory SQL, schema browsing |
| **Direct PostgreSQL** (port 5430+N) | pandas/Polars, SQLAlchemy, psql |

REST calls require `Authorization: Bearer <JWT>` and `apikey: <JWT>` headers.

Image URLs: prepend nginx host `http://<host>:9000` to `defect.image_url`.

### Schema (19 Tabellen, public-Schema)
- **`product`** — central entity; every quality event references it
- **`defect`** + **`test_result`** — in-factory detection chain
- **`field_claim`** — post-shipment customer reports
- **`rework`** — corrective actions on defects (**writable**)
- **`product_action`** — 8D initiatives, ownership tracking (**writable**)
- **`bom`** / **`bom_node`** / **`part_master`** / **`part`** — bill of materials + physical part instances
- **`product_part_install`** — links installed parts to BOM positions (traceability)
- **`supplier_batch`** — supplier delivery batches

Convenience-Views: `v_defect_detail`, `v_product_bom_parts`, `v_field_claim_detail`, `v_quality_summary`.

**Write targets**: Nur `product_action` und `rework` akzeptieren `INSERT/UPDATE`. Alle anderen Seed-Tabellen blocken `DELETE`. Teams dürfen `CREATE TABLE` im `public`-Schema.

### Die 4 Root-Cause-Stories (Seed-Daten)

Alle 4 sind im aktuellen Frontend (Investigations + FlowView) sichtbar markiert:

1. **Supply** — Bad batch SB-00008/9 (PM-00008, ElektroParts GmbH) → SOLDER_COLD-Defekte + Field-Claims, KW5-6/2026
2. **Process Drift** — Drehmomentschlüssel an SEC-00001 (Montage Linie 1) → VIB_FAIL, KW49-52/2025 (self-corrected)
3. **Design** — PM-00015 an BOM-Position R33 (ART-00001 Steuerplatine) → thermische Drift, Field-Claims ohne in-factory Defekte
4. **Operator** — user_042 an SEC-00007 (Dresden Montage Linie 1), POs PO-00012/18/24 → cosmetic Defekte (low severity)

Volle Beschreibung: `manex-base/docs/DATA_PATTERNS.md`.

### Reference-Docs (alle in `manex-base/docs/`)
- `QUICKSTART.md` — Connection-Setup, Credential-Format, curl/Python/JS-Beispiele
- `SCHEMA.md` — voller ER-Diagramm, ID-Prefix-Konventionen
- `API_REFERENCE.md` — PostgREST-Konventionen, View-Definitionen, Write-Back-Beispiele
- `DATA_PATTERNS.md` — Root-Cause-Stories, Noise-Patterns, globale Distributionen
- `CASE.md` — Bewertungsrubrik (UI/UX, GenAI use, Actionability, Business Impact)

### Drei Bewertungs-Pillars
1. **Intelligent Generation** — LLM drafts problem descriptions and root-cause hypotheses from DB data
2. **Innovative Visualization** — Interactive fault trees, Pareto charts, timelines, BOM traceability (not static tables)
3. **Closed-Loop Workflow** — Convert findings into `product_action` records with owner assignment and progress tracking

---

# Coding Guidelines

## Kommentare

- **Keine Inline-Kommentare.** Kein `// increment counter` neben `i++`.
- Jede Datei beginnt mit genau **einem Kommentarblock (3 Zeilen)**, der beschreibt was die Datei tut. Nicht mehr, nicht weniger.
- Kommentare im Code nur wenn die Logik **wirklich nicht offensichtlich** ist – z.B. ein Workaround, ein bekannter Bug, oder eine Business-Regel die man aus dem Code allein nicht ablesen kann.
- Wenn du das Gefühl hast einen Kommentar schreiben zu müssen, benenne stattdessen die Variable oder Funktion besser.

## Error Handling

- **Kein defensives Try-Catch um Code der nicht failen kann.** Wenn eine Variable aus einer Zuweisung kommt und kein I/O, Netzwerk oder Parsing involviert ist, braucht sie kein Try-Catch.
- Try-Catch nur dort wo tatsächlich Laufzeitfehler auftreten können: Dateizugriff, Netzwerk-Requests, JSON-Parsing von externem Input, Datenbankzugriffe.
- Keine leeren Catch-Blöcke. Wenn du einen Fehler fängst, tu etwas Sinnvolles damit.

## Code-Stil

- Schreibe Code so wie ein erfahrener Entwickler ihn bei einem Code-Review sehen will: kurz, klar, ohne Boilerplate.
- Bevorzuge frühe Returns statt tief verschachtelter If-Else-Blöcke.
- Keine Variablen deklarieren die nur einmal benutzt werden um sie direkt weiterzugeben – inline wenn es lesbar bleibt.
- Keine unnötigen Abstraktionen. Nicht alles braucht eine eigene Klasse, ein Interface oder ein Pattern. Einfacher Code > cleverer Code.
- Funktionen kurz halten. Wenn eine Funktion mehr als ~30 Zeilen hat, aufteilen.

## Naming

- Variablen- und Funktionsnamen sollen den Zweck beschreiben, nicht den Typ. `users` statt `userArray`, `isValid` statt `validationBooleanFlag`.
- Keine Abkürzungen außer allgemein bekannte (`id`, `url`, `config`, `err`, `ctx`).
- Konsistent bleiben: wenn im Projekt `fetch` verwendet wird, nicht plötzlich `get` oder `retrieve` einführen.

## Struktur

- Importe oben, gruppiert nach extern/intern, mit einer Leerzeile dazwischen.
- Keine toten Importe, keine auskommentierten Code-Blöcke.
- Dateien sollen eine Aufgabe haben. Wenn eine Datei zwei unabhängige Dinge tut, aufteilen.

## Was du NICHT tun sollst

- Keinen Code generieren der nur existiert um "sicher" auszusehen (leere Catch-Blöcke, redundante Null-Checks auf non-nullable Werte, überflüssige Type-Assertions).
- Keine `console.log`-Statements als Debugging-Überbleibsel hinterlassen.
- Keine TODO-Kommentare hinterlassen die nie bearbeitet werden.
- Keinen Code wiederholen – wenn du Copy-Paste machst, extrahiere eine Funktion.
