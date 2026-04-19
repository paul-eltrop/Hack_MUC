# Maniax — Interactive Quality Co-Pilot

> **Thinc Hackathon 2026** — Team submission for the Manex Quality Co-Pilot challenge.
> Replacing static Excel-based 8D / FMEA reports with an interactive, LLM-powered, closed-loop quality reporting system.

**Live demo:** https://chickentendr.club

---

## TL;DR

Manex's quality engineers today spend hours assembling 8D and FMEA reports by exporting Excel files, copy-pasting defect counts, and manually correlating supplier batches with field claims. Maniax turns that workflow into a single, interactive surface:

- **A live supply-chain canvas** — clickable suppliers, factories, articles, BOMs and field zones, with zoom-in drill-down. Red badges, batch pills, BOM rings and section flags appear automatically when our agent detects an anomaly.
- **A tool-using Claude Sonnet 4.6 agent** — runs every 5 minutes, queries the Manex Postgres directly (14 hand-tuned named queries), retrieves prior knowledge from a Qdrant RAG store, and writes back a typed snapshot that decorates the canvas and creates investigations.
- **A closed-loop action workflow** — every investigation can be turned into a `product_action` insert, tracked on a Kanban board, with proof documents that get re-ingested into the RAG store for the next agent run.
- **An analytics dashboard** — five deterministic KPIs (time saved, EUR saved, avg resolution, issues / 30 d, top defect) plus drill-down charts, computed via SQL against the live Manex schema.
- **A document archive** — drag-and-drop ingestion of 8D reports, FMEAs, supplier and factory documentation; parsed by Docling, chunked, embedded with `text-embedding-3-small` and stored in Qdrant. The agent searches this knowledge base via its `rag_search` tool.

Everything is deployed as a single `docker compose up -d` on a Vultr VPS, fronted by Caddy with automatic Let's Encrypt TLS.

---

## How it Maps to the Three Evaluation Pillars

| Pillar | What we built |
|---|---|
| **Intelligent Generation** | Native Anthropic tool-use loop over Claude Sonnet 4.6 with prompt caching. 6 read tools + 9 write tools. The agent autonomously runs SQL queries against the Manex schema, searches our RAG store, validates its own conclusions with deterministic consistency rules, and finally commits a typed snapshot. ID validation prevents hallucinated writes. |
| **Innovative Visualization** | Interactive supply-chain topology built on `@xyflow/react` with custom zoom-in / zoom-out drill-down (suppliers → batches, factories → lines → sections, articles → BOMs → components, field → claims + at-risk population). All overlays — error counts, batch pills, BOM rings, section flags, at-risk products — are driven by the agent's snapshot. Plus an analytics dashboard with KPI tiles, pie charts, and a top-defects bar (`recharts`). |
| **Closed-Loop Workflow** | Every investigation has a Kanban-based action creator that POSTs `product_action` records to the Manex API. Owner assignment, status transitions (New → In Progress → In Review → Completed), proof-document upload that re-enters the RAG store. Auto-close logic for resolved investigations. |

---

## Architecture

```
                         chickentendr.club  (HTTPS via Caddy + Let's Encrypt)
                                           │
                                           ▼
                       ┌──────────────── Caddy (reverse proxy) ────────────────┐
                       │  /agent_state.json  → file_server (shared volume)     │
                       │  /api/*             → portal:8000                     │
                       │  /*                 → frontend:3000                   │
                       └───────────────────────────────────────────────────────┘
                                           │
            ┌──────────────────┬───────────┴────────────┬─────────────────────┐
            ▼                  ▼                        ▼                     ▼
   Next.js 15 frontend   FastAPI portal        agent_service             Manex Postgres
   - Flow canvas         - Share links         - 5-min cron loop         (read-only seed
   - Investigations      - Document archive    - Claude Sonnet 4.6         + writes to
   - Analytics           - SQLite metadata     - 15 native tools           product_action /
   - Archive UI          - Docling ingestion   - Atomic snapshot           rework)
                              │  ▲                  │  ▲
                              │  │                  │  │
                              ▼  │                  ▼  │
                          Qdrant (shared volume — RAG vector store)
                          OpenAI text-embedding-3-small, 1536 dim
```

All four services live in one `docker-compose.yml` at the repo root. Shared state goes through Docker volumes — `agent_state` (snapshot JSON, atomic writes), `qdrant_storage` (vectors), `portal_data` (SQLite), `caddy_data` (TLS certs).

---

## What's Inside the Repo

```
Hack_MUC/
├── frontend/        Next.js 15, React 19, Tailwind v4, @xyflow/react, recharts
├── agent_service/   Tool-using Claude Sonnet 4.6 agent + DB refresh + snapshot writer
├── portal/          FastAPI: share links, document archive, RAG ingestion gateway
├── rag/             Standalone Qdrant + OpenAI embeddings library
├── agent/           Legacy GPT-4o single-shot baseline (still mined for SQL + verify rules)
├── manex-base/      Provided Manex infrastructure (read-only)
├── docker-compose.yml + Caddyfile + Dockerfiles + .env.example
└── README.md (this file)
```

---

## 1. Frontend — `frontend/`

**Stack:** Next.js 15 (App Router, no `src/`), React 19, TypeScript, Tailwind v4, `@xyflow/react@12`, `recharts`, `lucide-react`.

### Routes

| Route | What it does |
|---|---|
| `/` | Split layout: 680 px Investigations sidebar (live from snapshot) + interactive Flow canvas |
| `/investigations/[id]` | Detail view: root cause, timeline, affected products, suggested actions, embedded chat |
| `/investigations/[id]/action` | Kanban board for corrective actions — drag-drop, owner assignment, proof upload |
| `/analyse` | Analytics dashboard: 5 KPI tiles + 4 charts + drill-down panel |
| `/archive` | Document archive with category clustering (8D / FMEA / Supplier / Factory / Spec / Other) |

### The Flow Canvas (`app/_flow/`)

Custom-built on top of `@xyflow/react` — not just a graph, an **interactive zoom-in / zoom-out drill-down system**. Click a supplier → camera tweens into the supplier's batch timeline. Click "back" → reverse animation, overview re-pops in.

| Component | Visualizes |
|---|---|
| `FlowView.tsx` | Top-level orchestrator, manages two viewModes (overview / sub-flow), animation phases, back-navigation |
| `SupplierDetail.tsx` | Batch timeline (Year / Month / Week granularity), part-master drill, status pills |
| `ArticleCatalog.tsx` | Article picker + interactive BOM "flower" layout per assembly |
| `FactoryDetail.tsx` | Factory lines as parallel containers with Montage → Prüfung → Verpackung sections + caseFlag banners |
| `FieldDetail.tsx` | Field claims (market, complaint quote, build age) + at-risk population (latent products) |
| `agent-state.ts` | `useAgentState()` hook — polls `/agent_state.json` every 10 s |
| `applyAgentState.ts` | Pure functions that overlay the agent's marks on the static topology |

**Custom animations** in `globals.css`: `node-pop-in`, `node-disappear`, `edge-appear`, `edge-disappear`, `panel-fade-in`, `panel-fade-out` — all cubic-bezier-eased, choreographed to the zoom transition.

### Internal API routes (`app/api/`)

`POST /api/chat`, `POST /api/upload`, `POST /api/actions` (GPT-4o + RAG fallback to hardcoded), `POST /api/share`, `GET /api/share-status/[link_id]`, `POST /api/investigation-close`, `GET /api/proof-download/[file_key]`.

---

## 2. Agent Service — `agent_service/`

The heart of the system. A two-phase loop that runs every 5 minutes:

1. **Phase 1 — Deterministic refresh** (`refresh.py`): pure SQL fetch of suppliers / batches, factories / lines / sections, articles / BOMs, field claims. Always fills the canvas with real data.
2. **Phase 2 — Optional Claude agent loop** (`loop.py`): if `ANTHROPIC_API_KEY` is set, Claude Sonnet 4.6 runs up to 30 tool-use turns to decorate the snapshot with marks, investigations, and at-risk products.
3. **Atomic write** (`state.py`): `fcntl.flock(LOCK_EX)` + temp-file-swap + `os.replace()` — Caddy's file_server never reads partial JSON.

### The Tool Surface (`tools.py`)

Native Anthropic tool-use, **15 tools total**:

| Tool | Type | Purpose |
|---|---|---|
| `list_known_queries` | Read | Lists the 14 named SQL queries |
| `run_known_query` | Read | Executes one of the named queries by name |
| `query_db` | Read | Allowlisted free-form SELECT |
| `rag_search` | Read | Semantic search over the Qdrant archive |
| `get_current_state` | Read | Returns summary of previous snapshot for diffing |
| `verify_consistency` | Read | Wraps the legacy `agent/verify.py` deterministic SQL rules |
| `set_node_error_count` | Write | Top-level node badge |
| `set_node_subtitle` | Write | Top-level node subtitle |
| `set_batch_severity` | Write | Batch pill (`ok` / `suspect` / `bad`) |
| `set_section_case_flag` | Write | Section ring + banner (kind: `process` / `operator`) |
| `set_bom_component_flag` | Write | BOM ring (`design-issue` / `supply-issue`) |
| `upsert_at_risk_product` | Write | Latent population entry on Field detail |
| `upsert_investigation` | Write | Dashboard investigation list + detail page |
| `delete_investigation` | Write | Remove a stale investigation |
| `commit_snapshot` | Write | Atomic write + end loop |

**ID validation**: every write tool checks `nodeId` / `batchId` / `sectionId` / `bomNodeId` against the layout skeleton. Unknown IDs return `{ok: false, error: "..."}` so the model self-corrects in the next turn — no hallucinated writes ever leak into the snapshot.

### Prompt caching

System prompt (~72 lines describing the four stories, tool semantics and node-ID mappings) is wrapped with `cache_control: {"type": "ephemeral"}`. Across the 5-minute cadence we get cache hits on every turn — saves tokens and keeps decision-making consistent.

### Named Queries (`db.py`)

14 hand-tuned SQL queries extracted from our legacy GPT-4o baseline (`agent/analyze.py`):

- **Story 1 (Supply):** `story1_supplier_solder_cold`, `story1_field_claims_pm00008`, `story1_at_risk_products_sb_batch`
- **Story 2 (Process Drift):** `story2_vib_fail_by_section_week`, `story2_vib_test_results`, `story2_self_correction_check`
- **Story 3 (Design):** `story3_field_claims_no_factory_defect`, `story3_at_risk_pm00015_in_age_window`
- **Story 4 (Operator):** `story4_cosmetic_defects_by_operator`, `story4_user042_section`
- **Infrastructure:** `supplier_batches_full`, `factories_lines_sections`, `tests_per_section`, `articles_with_boms`

### Analytics (`analytics.py`)

Deterministic SQL aggregations (no LLM in the loop): time-saved estimate via repeat-detection, prevented-claims count, top-defects histogram, avg resolution hours, issues / 30 d, defects-by-product, problem-type histogram. Embedded into the snapshot for the `/analyse` dashboard.

### Cron (`cron.py`)

`while True: run_once(); sleep(300)` — exception-tolerant, restart-safe. Can also be run as a one-shot via `python -m agent_service.loop` or refresh-only via `python -m agent_service.refresh`.

---

## 3. Portal — `portal/`

FastAPI multi-tenant backend. Single `main.py`, six logical endpoint groups.

| Endpoint group | What it does |
|---|---|
| **Share links** | Create, list, fetch shareable investigation links (`POST/GET /share/links`, `POST /share/chat`, `POST /share/upload`) |
| **Archive** | Document upload with SHA-256 dedupe, list, delete (`POST /archive/upload`, `GET /archive/documents`, `DELETE /archive/documents/{id}`) |
| **Debug** | First 200 Qdrant points (`GET /debug/rag`) |

**SQLite schema:** `share_links`, `rag_documents`, `rag_claims`, `rag_contradictions`, `link_completions`, `archive_documents` (with UNIQUE file_sha256 for dedupe).

**Document parsing:** `Docling` for PDF / DOCX / PPTX / XLSX / MD / TXT / HTML / CSV. First call is a 30-60 s cold-start while the model warms up; subsequent calls are fast. After parsing, text is chunked, embedded with `text-embedding-3-small`, and upserted into Qdrant tagged with `company_id="manex-archive"` so the agent's `rag_search` tool finds it.

**CORS:** allowed origin is configurable via env (`PORTAL_ALLOW_ORIGIN`).

---

## 4. RAG Pipeline — `rag/rag.py`

Standalone library — no HTTP server, imported directly by `portal` and `agent_service`. Functions:

- `chunk_text(text, chunk_size=512, overlap=64)` — word-level chunking with overlap
- `embed(texts)` — batch OpenAI `text-embedding-3-small`
- `index_document(doc_id, text, metadata)` — chunk → embed → Qdrant upsert
- `retrieve(query, top_k=5)` — semantic search
- `delete_document(doc_id)` — payload-filter delete

**Why file-based Qdrant?** Single-node hackathon deploy. The shared Docker volume gives both the portal (writer) and the agent (reader + writer) a consistent view, with no extra service to manage.

---

## 5. The Four Root-Cause Stories

Our agent is trained (via prompt + queries) to detect the four root-cause patterns embedded in the Manex seed data:

1. **Supply** — Bad batch SB-00008 / SB-00009 (PM-00008, ElektroParts GmbH) → `SOLDER_COLD` defects + downstream field claims, KW 5-6 / 2026.
2. **Process drift** — Torque-wrench drift on SEC-00001 (Augsburg Montage Linie 1) → `VIB_FAIL` cluster, KW 49-52 / 2025, self-corrects.
3. **Design** — PM-00015 thermal drift on BOM position R33 (ART-00001 Steuerplatine) → field claims with no in-factory defects, build age 8-12 weeks. Agent populates ~20 latent at-risk products.
4. **Operator** — user_042 on SEC-00007 (Dresden Montage Linie 1) → cosmetic defects on PO-00012 / 18 / 24 (low severity).

The system prompt (`prompts.py`) carries explicit rules to avoid common false positives — e.g. ignoring the "Prüfung Linie 2" detection bias which would otherwise look like a root cause.

---

## 6. Deployment

Single-command production deploy:

```bash
git clone <repo> /opt/hackmuc && cd /opt/hackmuc
cp .env.example .env && nano .env       # add OPENAI / ANTHROPIC / MANEX keys
docker compose up -d --build
```

What you get:

- **Caddy** on `:80` / `:443` — automatic Let's Encrypt cert for `chickentendr.club`, gzip encoding, three-way routing
- **frontend** — Next.js multi-stage build (Node 20-alpine), `next start` on `:3000`
- **portal** — FastAPI on uvicorn, `:8000`, mounts `qdrant_storage` and `portal_data`
- **agent_service** — Python 3.11, runs `python -m agent_service.cron` (5-min cadence). Can be turned off with `docker compose stop agent_service` for cost control during demos.

**Caddy file-server bypass for `/agent_state.json`** — instead of proxying to Next.js, Caddy serves the JSON directly from the shared `agent_state` volume. Combined with the agent's `flock` + `os.replace()` atomic write, this guarantees the frontend never sees a partial snapshot.

**Single-origin design** — frontend and portal both live behind `chickentendr.club`. No CORS dance, no separate API subdomain, no auth tokens to juggle.

---

## 7. Tech Stack at a Glance

**Frontend:** Next.js 15.3 · React 19 · TypeScript · Tailwind v4 · @xyflow/react 12 · recharts · lucide-react.

**Backend:** FastAPI · Uvicorn · psycopg2 · qdrant-client · Docling · python-multipart · python-dotenv.

**LLMs & AI:** Anthropic Claude Sonnet 4.6 (tool-use + prompt caching) · OpenAI GPT-4o (legacy + action suggester) · OpenAI `text-embedding-3-small` · Docling document parsing.

**Data:** PostgreSQL (Manex schema, 19 tables + views) · Qdrant (file-based vector store) · SQLite (portal metadata).

**Infra:** Docker · Docker Compose · Caddy 2 · Let's Encrypt · Vultr (Ubuntu 24.04).

---

## 8. Things We're Quietly Proud Of

- **No mocked data on the Flow canvas in production.** Every supplier batch, factory section, BOM component and field claim shown comes from the live Manex Postgres via the deterministic refresh — the LLM only adds *decorations* (severity, flags, investigations) on top.
- **Crash-safe snapshot writes.** `fcntl.flock` + temp-file-swap means the agent can be SIGKILLed mid-write and the frontend will still serve the previous valid snapshot.
- **Merge-previous-decisions logic** in `refresh.py:merge_with_prev` — agent flags survive a refresh even if the underlying data changes, so the canvas stays coherent across the 5-minute cycle.
- **ID validation as a guardrail** — write tools refuse unknown IDs, the model corrects itself, and we never leak hallucinated entities into the canvas.
- **Prompt caching turned on day one.** The system prompt sits in the cache, the per-run brief is the only un-cached payload — input tokens stay low even at 5-minute cadence.
- **One repo, one `docker compose up`.** Frontend, portal, agent and reverse proxy boot together on a single VPS. Adding HTTPS was three lines in the `Caddyfile`.

---

## 9. Running Locally

```bash
# 1. Manex infrastructure (provided, read-only)
cd manex-base && docker compose up -d

# 2. Frontend
cd frontend && npm install && npm run dev          # http://localhost:3000

# 3. Portal
cd portal && pip install -r requirements.txt
uvicorn portal.main:app --port 8000 --reload       # http://localhost:8000

# 4. Agent service (one-shot or cron)
cd agent_service && pip install -r requirements.txt
python -m agent_service.refresh                    # DB refresh only (no Anthropic key needed)
python -m agent_service.loop                       # full agent run, one iteration
python -m agent_service.cron                       # 5-min loop forever
```

`.env` at repo root needs: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MANEX_DB_URL`, `MANEX_API_URL`, `MANEX_API_KEY`.

---

## 10. Team

Built in 36 hours at the Thinc Hackathon 2026 — Munich, April 2026.

Live at **https://chickentendr.club**.
