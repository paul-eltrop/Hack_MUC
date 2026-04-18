# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Context

This is the **Thinc Hackathon 2026** team solution repository. The challenge is to build an **Interactive Quality Co-Pilot** for the fictional manufacturer "Manex" — replacing static Excel-based 8D/FMEA reports with an LLM-powered, interactive quality reporting system.

The reference infrastructure (schema, seed data, Docker setup) lives in `../Manex_given/Thinc-Hackathon-2026-Manex/`. This repo is where the team's actual solution is built.

## Infrastructure Commands

**Start the provided Manex stack** (from `../Manex_given/Thinc-Hackathon-2026-Manex/`):
```bash
docker compose --env-file .env.<team-slug> -p manex-<team-slug> up -d
```

**Regenerate seed data** (requires Python):
```bash
cd data-generation && pip install -r requirements.txt && python generate.py
# Writes output to ../supabase/seed.sql (~9,500 rows, deterministic RNG seed 20260413)
```

**Provision a new team** (organizer only):
```bash
./scripts/deploy-team.sh <team-slug> <team-number>
```

## Data Access

Three access tiers are provided (credentials in your `handouts/team-<slug>.txt`):

| Tier | Use when |
|------|----------|
| **PostgREST REST API** (port 8000+N) | Client-side fetching, supabase-js |
| **Supabase Studio** (port 8400+N) | Exploratory SQL, schema browsing |
| **Direct PostgreSQL** (port 5430+N) | pandas/Polars, SQLAlchemy, psql |

REST calls require `Authorization: Bearer <JWT>` and `apikey: <JWT>` headers.

Image URLs: construct by prepending the nginx host `http://<host>:9000` to the relative path in `defect.image_url`.

## Database Schema

19 tables in the `public` schema. Key relationships:

- **`product`** — central entity; every quality event references it
- **`defect`** + **`test_result`** — in-factory detection chain
- **`field_claim`** — post-shipment customer reports
- **`rework`** — corrective actions on defects (**writable**)
- **`product_action`** — 8D initiatives, ownership tracking (**writable**)
- **`bom`** / **`bom_node`** / **`part_master`** / **`part`** — bill of materials + physical part instances
- **`product_part_install`** — links installed parts to BOM positions (traceability)
- **`supplier_batch`** — supplier delivery batches

Convenience views pre-join common relationships: `v_defect_detail`, `v_product_bom_parts`, `v_field_claim_detail`, `v_quality_summary`.

**Write targets**: Only `product_action` and `rework` accept `INSERT/UPDATE`. All other seed tables block `DELETE`. Teams may `CREATE TABLE` freely in the `public` schema.

## The Four Root-Cause Stories

The synthetic dataset contains four embedded patterns (documented fully in `../Manex_given/Thinc-Hackathon-2026-Manex/docs/DATA_PATTERNS.md`):

1. **Supplier incident** — Bad capacitor batch (SB-00007, PM-00008) from ElektroParts GmbH → `SOLDER_COLD` defects + field claims, weeks 5–6/2026
2. **Process drift** — Torque wrench calibration at Montage Linie 1 → `VIB_FAIL` defects, weeks 49–52/2025 (self-corrected Jan 2026)
3. **Design weakness** — Resistor PM-00015 at BOM position R33 → thermal drift field claims, zero in-factory detection
4. **Operator handling** — Packaging operator user_042 → cosmetic defects on orders PO-00012, PO-00018, PO-00024

## Reference Documentation

All reference docs are in `../Manex_given/Thinc-Hackathon-2026-Manex/docs/`:

- `QUICKSTART.md` — connection setup, credential format, curl/Python/JS examples
- `SCHEMA.md` — full ER diagram, ID prefix conventions (FAC-, ART-, BOM-, PM-, SB-, PRD-, DEF-, FC-, …)
- `API_REFERENCE.md` — PostgREST conventions, view definitions, write-back examples
- `DATA_PATTERNS.md` — root-cause stories, noise patterns, global distributions
- `CASE.md` — evaluation rubric (UI/UX, GenAI use, actionability, business impact)

## Challenge Architecture

Solutions should address three pillars:
1. **Intelligent Generation** — LLM drafts problem descriptions and root-cause hypotheses from DB data
2. **Innovative Visualization** — Interactive fault trees, Pareto charts, timelines, BOM traceability (not static tables)
3. **Closed-Loop Workflow** — Convert findings into `product_action` records with owner assignment and progress tracking

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