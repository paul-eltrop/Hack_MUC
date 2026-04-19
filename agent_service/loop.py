# Tool-Use Loop mit Anthropic Claude Sonnet 4.6.
# Liest vorherigen Snapshot, läuft eine begrenzte Anzahl Tool-Use-Turns,
# schreibt am Ende den neuen Snapshot atomar.

import os
import sys
import time
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

from . import db
from . import refresh
from . import state
from . import tools as tools_mod
from .prompts import SYSTEM_PROMPT, render_brief

MODEL = "claude-sonnet-4-6"
MAX_TURNS = 30
MAX_TOKENS_PER_TURN = 4096
MAX_TOOL_RESULT_CHARS = 3000

SEP = "─" * 60


def _log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", file=sys.stderr, flush=True)


def _truncate(result: str) -> str:
    if len(result) <= MAX_TOOL_RESULT_CHARS:
        return result
    return result[:MAX_TOOL_RESULT_CHARS] + "\n… [truncated]"


def _prune_history(messages: list) -> list:
    """Compress tool results older than the last 2 turns to save tokens."""
    tool_result_indices = [
        i for i, m in enumerate(messages)
        if isinstance(m.get("content"), list)
        and any(isinstance(b, dict) and b.get("type") == "tool_result" for b in m["content"])
    ]
    compress = set(tool_result_indices[:-2])
    pruned = []
    for i, msg in enumerate(messages):
        if i not in compress:
            pruned.append(msg)
            continue
        compressed = []
        for block in msg["content"]:
            if isinstance(block, dict) and block.get("type") == "tool_result":
                compressed.append({
                    "type": "tool_result",
                    "tool_use_id": block["tool_use_id"],
                    "content": f"[processed — {len(str(block.get('content', '')))} chars]",
                })
            else:
                compressed.append(block)
        pruned.append({**msg, "content": compressed})
    return pruned


def _count_tokens_approx(messages: list) -> int:
    return sum(len(str(m)) for m in messages) // 4


def run_once() -> dict:
    started_at = datetime.now(timezone.utc)
    run_id = db.next_run_id()

    print(f"\n{SEP}", file=sys.stderr)
    _log(f"RUN START  run_id={run_id}  model={MODEL}")
    print(SEP, file=sys.stderr, flush=True)

    prev = state.load_snapshot()
    if prev.get("generatedAt"):
        _log(f"Prev snapshot: runId={prev.get('runId')}  investigations={len(prev.get('investigations', []))}  generatedAt={prev.get('generatedAt')}")
    else:
        _log("Prev snapshot: (none — cold start)")

    health = db.healthcheck()
    if health.get("reachable"):
        _log(f"DB reachable: {health.get('defects')} defects, {health.get('field_claims')} field claims")
        fresh = refresh.refresh_from_db()
        draft = refresh.merge_with_prev(fresh, prev)
        _log(
            f"Refresh done: {len(draft['supplierDetails'])} suppliers, "
            f"{len(draft['factoryDetails'])} factories, "
            f"{len(draft['articleCatalog'])} articles, "
            f"{len(draft['fieldClaims'])} claims"
        )
    else:
        _log(f"DB UNREACHABLE: {health.get('error')} — keeping prev snapshot")
        draft = deepcopy(prev) if prev.get("generatedAt") else state.empty_snapshot()

    draft["runId"] = run_id
    draft["model"] = MODEL

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        _log("No ANTHROPIC_API_KEY — refresh-only run (no agent marks)")
        draft["summary"] = (draft.get("summary") or "") + " · refresh-only run (no agent)"
        state.write_snapshot_atomic(draft)
        db.insert_audit(run_id, started_at, datetime.now(timezone.utc), "refresh-only", [], draft["summary"])
        return draft

    from anthropic import Anthropic, RateLimitError
    client = Anthropic(api_key=api_key)

    _log("Pre-loading story queries...")
    story_queries = [
        "story1_supplier_solder_cold",
        "story1_field_claims_pm00008",
        "story2_vib_fail_by_section_week",
        "story3_field_claims_no_factory_defect",
        "story4_cosmetic_defects_by_operator",
        "story4_user042_section",
    ]
    story_data = {}
    for q in story_queries:
        try:
            rows = db.run_named(q, limit=20)
            story_data[q] = rows
            _log(f"  {q}: {len(rows)} rows")
        except Exception as exc:
            _log(f"  {q}: FAILED — {exc}")

    messages = [{"role": "user", "content": render_brief(prev, health, story_data, draft)}]
    brief_tokens = _count_tokens_approx(messages)
    _log(f"Brief ready (~{brief_tokens} tokens). Starting agent loop (max {MAX_TURNS} turns)...")
    print(SEP, file=sys.stderr, flush=True)

    tool_calls_log = []

    try:
        for turn in range(MAX_TURNS):
            approx_tokens = _count_tokens_approx(messages)
            _log(f"Turn {turn + 1}/{MAX_TURNS}  history~{approx_tokens} tokens  tool_calls_so_far={len(tool_calls_log)}")

            for attempt in range(3):
                try:
                    resp = client.messages.create(
                        model=MODEL,
                        max_tokens=MAX_TOKENS_PER_TURN,
                        system=[{
                            "type": "text",
                            "text": SYSTEM_PROMPT,
                            "cache_control": {"type": "ephemeral"},
                        }],
                        tools=tools_mod.TOOL_DEFS,
                        messages=_prune_history(messages),
                    )
                    _log(f"  Claude responded: stop_reason={resp.stop_reason}  usage=in:{resp.usage.input_tokens} out:{resp.usage.output_tokens}")
                    break
                except RateLimitError:
                    wait = 60 * (attempt + 1)
                    _log(f"  RATE LIMIT — waiting {wait}s (attempt {attempt + 1}/3)")
                    time.sleep(wait)
            else:
                _log("  Rate limit retries exhausted — saving partial draft")
                break

            messages.append({"role": "assistant", "content": resp.content})

            tool_use_blocks = [b for b in resp.content if getattr(b, "type", None) == "tool_use"]
            if not tool_use_blocks:
                _log(f"  No tool_use blocks — agent finished (stop_reason={resp.stop_reason})")
                # Print any text the model produced
                for block in resp.content:
                    if getattr(block, "type", None) == "text" and block.text.strip():
                        _log(f"  Agent text: {block.text[:300]}")
                break

            _log(f"  Tools called: {[b.name for b in tool_use_blocks]}")

            tool_results = []
            committed = False
            for block in tool_use_blocks:
                tool_calls_log.append({"name": block.name, "input": block.input})
                result = tools_mod.execute_tool(block.name, block.input or {}, draft, prev)
                truncated = _truncate(result)

                # Pretty-print result summary
                try:
                    import json
                    parsed = json.loads(result)
                    if isinstance(parsed, dict):
                        if parsed.get("ok") is False:
                            _log(f"    ✗ {block.name}({_fmt_input(block.input)}) → ERROR: {parsed.get('error')}")
                        else:
                            _log(f"    ✓ {block.name}({_fmt_input(block.input)}) → {_fmt_result(parsed)}")
                    elif isinstance(parsed, list):
                        _log(f"    ✓ {block.name}({_fmt_input(block.input)}) → [{len(parsed)} items]")
                    else:
                        _log(f"    ✓ {block.name}({_fmt_input(block.input)}) → {str(result)[:120]}")
                except Exception:
                    _log(f"    ✓ {block.name}({_fmt_input(block.input)}) → {str(result)[:120]}")

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": truncated,
                })
                if block.name == "commit_snapshot":
                    committed = True

            messages.append({"role": "user", "content": tool_results})
            state.write_snapshot_atomic(draft)
            _log(f"  Snapshot written (investigations={len(draft.get('investigations', []))}, atRisk={len(draft.get('atRiskProducts', []))})")

            if committed:
                _log(f"  commit_snapshot called — loop done")
                break

    finally:
        finished_at = datetime.now(timezone.utc)
        elapsed = (finished_at - started_at).total_seconds()
        if not draft.get("summary"):
            draft["summary"] = f"partial run ({len(tool_calls_log)} tool calls)"
        state.write_snapshot_atomic(draft)
        db.insert_audit(run_id, started_at, finished_at, MODEL, tool_calls_log, draft.get("summary") or "")
        print(SEP, file=sys.stderr)
        _log(
            f"RUN DONE  run_id={run_id}  turns={len(tool_calls_log)}  elapsed={elapsed:.1f}s\n"
            f"  summary: {draft.get('summary', '(none)')[:120]}\n"
            f"  investigations: {len(draft.get('investigations', []))}\n"
            f"  atRiskProducts: {len(draft.get('atRiskProducts', []))}"
        )
        print(SEP + "\n", file=sys.stderr, flush=True)

    return draft


def _fmt_input(inp: dict) -> str:
    if not inp:
        return ""
    parts = []
    for k, v in inp.items():
        sv = str(v)
        parts.append(f"{k}={sv[:40]!r}" if len(sv) > 40 else f"{k}={sv!r}")
    return ", ".join(parts)[:80]


def _fmt_result(parsed: dict) -> str:
    skip = {"ok", "message"}
    extras = {k: v for k, v in parsed.items() if k not in skip}
    base = parsed.get("message", "ok")
    if extras:
        return f"{base}  {extras}"
    return base


if __name__ == "__main__":
    run_once()
