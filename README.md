# Maniax — Interactive Quality Co-Pilot

> An LLM-powered replacement for the Excel-based 8D / FMEA workflow: a live supply-chain canvas, a tool-using Claude agent that runs every 5 minutes against the Manex Postgres, and a closed-loop action workflow that feeds proof documents back into its RAG store.

**Built for the Manex.AI Challenge at the thinc! × Codex Hackathon (Munich, April 2026).** Two-person team, 36 hours.

---

## The problem

Manex's quality engineers spend hours assembling 8D and FMEA reports by exporting Excel files, copy-pasting defect counts, and manually correlating supplier batches with field claims. The result is static, late, and impossible to audit.

Maniax replaces that workflow with a single interactive surface:

- **A live supply-chain canvas.** Clickable suppliers, factories, articles, BOMs and field zones, with camera-tweened zoom-in drill-down. Red badges, batch pills, BOM rings and section flags appear automatically when the agent detects an anomaly.
- **A tool-using Claude Sonnet 4.6 agent.** Runs every 5 minutes, queries the Manex Postgres directly (14 hand-tuned named queries), retrieves prior knowledge from a Qdrant RAG store, and writes back a typed snapshot that decorates the canvas and creates investigations.
- **A closed-loop action workflow.** Every investigation can be turned into a `product_action` insert, tracked on a Kanban board, with proof documents that get re-ingested into the RAG store for the next agent run.
- **An analytics dashboard.** Five deterministic KPIs (time saved, EUR saved, avg resolution, issues / 30 d, top defect) plus drill-down charts, computed via SQL against the live Manex schema.
- **A document archive.** Drag-and-drop ingestion of 8D reports, FMEAs, supplier and factory documentation — parsed with Docling, chunked, embedded with `text-embedding-3-small`, and stored in Qdrant.

The whole thing ships as a single `docker compose up -d` on a Vultr VPS, fronted by Caddy with automatic Let's Encrypt TLS.

---

## Architecture

```
                    ┌───────────── Caddy (reverse proxy, TLS) ────────────┐
                    │  /agent_state.json  → file_server (shared volume)    │
                    │  /api/*             → portal:8000                    │
                    │  /*                 → frontend:3000                  │
                    └──────────────────────────────────────────────────────┘
                                           │
        ┌──────────────────┬────────────── │ ──────────────┬──────────────────┐
        ▼                  ▼               ▼               ▼                  ▼
   Next.js 15         FastAPI          agent_service    Qdrant            Manex Postgres
   frontend           portal           (5-min cron)     (RAG vectors,     (read-only seed
   - Flow canvas      - Share links    Claude Sonnet    file-based,         + writes to
   - Investigations   - Archive        4.6 + 15         shared volume)      product_action)
   - Analytics        - RAG ingest     native tools
   - Archive
```

All four services live in one `docker-compose.yml` at the repo root. Shared state goes through Docker volumes — `agent_state` (snapshot JSON, atomic writes), `qdrant_storage` (vectors), `portal_data` (SQLite), `caddy_data` (TLS certs).

---

## Repo layout

```
Hack_MUC/
├── frontend/        Next.js 15, React 19, Tailwind v4, @xyflow/react, recharts
├── agent_service/   Tool-using Claude Sonnet 4.6 agent + DB refresh + atomic snapshot writes
├── portal/          FastAPI: share links, document archive, RAG ingestion gateway
├── rag/             Standalone Qdrant + OpenAI embeddings library
├── agent/           Legacy GPT-4o single-shot baseline (mined for its SQL + verify rules)
├── manex-base/      Provided Manex infrastructure (read-only)
└── docker-compose.yml + Caddyfile + Dockerfiles + .env.example
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · `@xyflow/react` 12 · `recharts` · `lucide-react` |
| Backend | FastAPI · Uvicorn · `psycopg2` · `qdrant-client` · Docling · `python-multipart` |
| LLMs & AI | Anthropic Claude Sonnet 4.6 (tool use + prompt caching) · OpenAI GPT-4o (legacy + action suggester) · OpenAI `text-embedding-3-small` · Docling |
| Data | PostgreSQL (Manex schema, 19 tables + views) · Qdrant (file-based vector store) · SQLite (portal metadata) |
| Infra | Docker · Docker Compose · Caddy 2 · Let's Encrypt · Vultr (Ubuntu 24.04) |

---

## Key implementation details

Each of the claims below maps to code in this repo:

**Tool-using Claude agent — 15 native tools, ID-validated writes**
A two-phase loop runs every 5 minutes. First a deterministic SQL refresh fills the canvas with real data. Then Claude Sonnet 4.6 runs up to 30 tool-use turns to decorate the snapshot with marks, investigations, and at-risk products. Six read tools (`run_known_query`, `query_db`, `rag_search`, `verify_consistency`, …) and nine write tools (`set_batch_severity`, `upsert_investigation`, `commit_snapshot`, …). Every write tool checks its `nodeId` / `batchId` / `sectionId` / `bomNodeId` against the layout skeleton — unknown IDs return `{ok: false, error: "…"}` so the model self-corrects. No hallucinated writes ever leak into the snapshot.
→ [`agent_service/loop.py`](agent_service/loop.py), [`agent_service/tools.py`](agent_service/tools.py), [`agent_service/prompts.py`](agent_service/prompts.py)

**Interactive zoom-in / zoom-out flow canvas**
Built on top of `@xyflow/react` — not just a graph, but an animated drill-down system. Click a supplier → camera tweens into the supplier's batch timeline. Click "back" → reverse animation, overview re-pops in. Cubic-bezier-eased animations for `node-pop-in`, `edge-appear`, `panel-fade-in` are choreographed to the zoom transition. Four detail views (supplier / article / factory / field) each with their own interaction language: batch timelines, BOM "flower" layouts, parallel factory-line containers with section flags, latent at-risk-product populations.
→ [`frontend/app/_flow/FlowView.tsx`](frontend/app/_flow/FlowView.tsx), [`frontend/app/_flow/SupplierDetail.tsx`](frontend/app/_flow/SupplierDetail.tsx), [`frontend/app/_flow/ArticleCatalog.tsx`](frontend/app/_flow/ArticleCatalog.tsx), [`frontend/app/_flow/FactoryDetail.tsx`](frontend/app/_flow/FactoryDetail.tsx), [`frontend/app/_flow/FieldDetail.tsx`](frontend/app/_flow/FieldDetail.tsx)

**Atomic snapshot writes — crash-safe even under SIGKILL**
The agent writes its typed snapshot with `fcntl.flock(LOCK_EX)` + temp-file-swap + `os.replace()`. Combined with Caddy's file-server bypass for `/agent_state.json` (served directly from the shared Docker volume, no Next.js proxy), the frontend never sees a partial snapshot — even if the agent is SIGKILLed mid-write, the previous valid JSON is still served.
→ [`agent_service/state.py`](agent_service/state.py)

**Prompt caching from day one**
The ~72-line system prompt (describing the four root-cause stories, tool semantics, and node-ID mappings) is wrapped with `cache_control: {"type": "ephemeral"}`. On the 5-minute cadence we hit the cache on every turn — input tokens stay low and decision-making stays consistent.
→ [`agent_service/prompts.py`](agent_service/prompts.py)

**14 named SQL queries — one per root-cause story**
Extracted from the legacy GPT-4o baseline and handed to the agent as structured tools. Grouped by story: supply-side bad batches (PM-00008), process-drift torque issues (SEC-00001), design-level thermal drift (PM-00015 / BOM R33), operator-specific cosmetic defects (user_042 / SEC-00007). The system prompt carries explicit rules to avoid known false positives like the "Prüfung Linie 2" detection bias.
→ [`agent_service/db.py`](agent_service/db.py), [`agent/analyze.py`](agent/analyze.py)

**Closed-loop action workflow**
Every investigation has a Kanban-based action creator that POSTs `product_action` records to the Manex API. Owner assignment, status transitions (New → In Progress → In Review → Completed), proof-document upload that re-enters the RAG store. Auto-close logic for investigations whose proof text satisfies the acceptance criteria.
→ [`frontend/app/investigations/[id]/action/`](frontend/app/investigations/), [`portal/main.py`](portal/main.py)

**Docling + Qdrant RAG pipeline**
Drag-and-drop PDF / DOCX / PPTX / XLSX / MD / TXT / HTML / CSV → Docling parses, `rag.rag.chunk_text` chunks with 64-word overlap, OpenAI `text-embedding-3-small` embeds (1536 dim), Qdrant upsert tagged with `company_id="manex-archive"`. Single-node file-based Qdrant on a shared Docker volume — both portal (writer) and agent (reader + writer) see the same store, no extra service to manage. SHA-256 dedupe on upload.
→ [`rag/rag.py`](rag/rag.py), [`portal/main.py`](portal/main.py)

**Single-VPS deploy, three-way Caddy routing**
One `docker-compose.yml` boots frontend + portal + agent + Caddy. Caddy terminates TLS, serves `/agent_state.json` directly from the shared volume (bypassing Next.js), proxies `/api/*` to the portal and `/*` to the frontend. Adding HTTPS was three lines in the `Caddyfile`. Agent can be stopped independently (`docker compose stop agent_service`) for cost control during demos.
→ [`docker-compose.yml`](docker-compose.yml), [`Caddyfile`](Caddyfile)

**Deterministic analytics — no LLM in the KPI loop**
`/analyse` dashboard: 5 KPI tiles + 4 charts. Time-saved estimated via repeat-detection, prevented-claims count, top-defects histogram, avg resolution hours, issues / 30 d, defects-by-product, problem-type histogram — all pure SQL aggregations embedded into the snapshot. `recharts` on the frontend.
→ [`agent_service/analytics.py`](agent_service/analytics.py), [`frontend/app/analyse/`](frontend/app/analyse/)

---

## The four root-cause stories

The agent is prompted to recognise four patterns embedded in the Manex seed data:

1. **Supply** — Bad batch SB-00008 / SB-00009 (PM-00008, ElektroParts GmbH) → `SOLDER_COLD` defects + downstream field claims, KW 5-6 / 2026.
2. **Process drift** — Torque-wrench drift on SEC-00001 (Augsburg Montage Linie 1) → `VIB_FAIL` cluster, KW 49-52 / 2025, self-corrects.
3. **Design** — PM-00015 thermal drift on BOM position R33 (ART-00001 Steuerplatine) → field claims with no in-factory defects, build age 8-12 weeks. Agent populates ~20 latent at-risk products.
4. **Operator** — user_042 on SEC-00007 (Dresden Montage Linie 1) → cosmetic defects on PO-00012 / 18 / 24 (low severity).

The canvas decorations, investigation cards, and at-risk population all reflect whichever of these the agent has detected on the current snapshot.

---

## Running locally

```bash
git clone <repo>
cd Hack_MUC
cp .env.example .env     # add OPENAI_API_KEY, ANTHROPIC_API_KEY, MANEX_DB_URL, MANEX_API_URL, MANEX_API_KEY

# Everything at once
docker compose up -d --build

# Or piece by piece (dev mode)
cd manex-base && docker compose up -d                # provided Manex infrastructure
cd frontend && npm install && npm run dev            # http://localhost:3000
cd portal && pip install -r requirements.txt
uvicorn portal.main:app --port 8000 --reload         # http://localhost:8000
cd agent_service && pip install -r requirements.txt
python -m agent_service.refresh                      # DB refresh only (no Anthropic key needed)
python -m agent_service.loop                         # full agent run, one iteration
python -m agent_service.cron                         # 5-min loop forever
```

---

## What we'd do differently with more time

- **Multi-tenant Qdrant.** The `company_id="manex-archive"` payload filter is in place but we never pushed a second tenant through it.
- **Investigation versioning.** Right now re-opening a closed investigation loses the prior timeline. We have the append-only RAG of closure events but no UI surface.
- **Agent-side tool-use traces.** We log tokens and tool calls but don't persist them — a post-mortem view of "why did the agent create this investigation" would be genuinely useful.
- **Replace `main 2.py` with actual FastAPI modules.** The portal is one giant `main.py` with hackathon duct tape.

---

## Credits

Built in a two-person team at the thinc! × Codex Hackathon in Munich, April 2026:

- **[Paul Eltrop](https://github.com/paul-eltrop)** — RAG pipeline, verification layer, FastAPI portal, investigation & chat UI, Kanban action workflow, document ingestion, auto-close logic, long-term recommendations
- **[Lasse Johannis](https://github.com/lassejohannis)** — agent service tool-use loop with 15 native tools, frontend flow canvas (zoom-into-node drill-down, sub-flow animations), detail views (supplier / article / factory / field), Docker + Caddy deployment, /analyse quality-analytics dashboard
