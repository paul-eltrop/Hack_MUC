# Tool-Use Loop mit Anthropic Claude Sonnet 4.6.
# Liest vorherigen Snapshot, läuft eine begrenzte Anzahl Tool-Use-Turns,
# schreibt am Ende den neuen Snapshot atomar.

import os
import sys
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


def run_once() -> dict:
    started_at = datetime.now(timezone.utc)
    run_id = db.next_run_id()

    prev = state.load_snapshot()
    health = db.healthcheck()

    if health.get("reachable"):
        fresh = refresh.refresh_from_db()
        draft = refresh.merge_with_prev(fresh, prev)
        print(
            f"[loop] refreshed: {len(draft['supplierDetails'])} suppliers, "
            f"{len(draft['factoryDetails'])} factories, "
            f"{len(draft['articleCatalog'])} articles, "
            f"{len(draft['fieldClaims'])} claims",
            file=sys.stderr,
        )
    else:
        print(f"[loop] DB unreachable: {health.get('error')} — keeping prev", file=sys.stderr)
        draft = deepcopy(prev) if prev.get("generatedAt") else state.empty_snapshot()

    draft["runId"] = run_id
    draft["model"] = MODEL

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("[loop] no ANTHROPIC_API_KEY — writing refreshed snapshot without agent marks", file=sys.stderr)
        draft["summary"] = (draft.get("summary") or "") + " · refresh-only run (no agent)"
        state.write_snapshot_atomic(draft)
        db.insert_audit(run_id, started_at, datetime.now(timezone.utc), "refresh-only", [], draft["summary"])
        return draft

    from anthropic import Anthropic
    client = Anthropic(api_key=api_key)

    messages = [{"role": "user", "content": render_brief(prev, health)}]
    tool_calls_log = []

    for turn in range(MAX_TURNS):
        resp = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS_PER_TURN,
            system=[{
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }],
            tools=tools_mod.TOOL_DEFS,
            messages=messages,
        )

        messages.append({"role": "assistant", "content": resp.content})

        tool_use_blocks = [b for b in resp.content if getattr(b, "type", None) == "tool_use"]
        if not tool_use_blocks:
            print(f"[loop] turn {turn}: no tool_use, stop_reason={resp.stop_reason}", file=sys.stderr)
            break

        tool_results = []
        committed = False
        for block in tool_use_blocks:
            tool_calls_log.append({"name": block.name, "input": block.input})
            result = tools_mod.execute_tool(block.name, block.input or {}, draft, prev)
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": result,
            })
            if block.name == "commit_snapshot":
                committed = True
            print(f"[loop] turn {turn}: tool={block.name} result_len={len(result)}", file=sys.stderr)

        messages.append({"role": "user", "content": tool_results})

        if committed:
            print(f"[loop] commit_snapshot called — finalizing", file=sys.stderr)
            break

    finished_at = datetime.now(timezone.utc)
    state.write_snapshot_atomic(draft)
    db.insert_audit(run_id, started_at, finished_at, MODEL, tool_calls_log, draft.get("summary") or "")

    print(
        f"[loop] {run_id} done: {len(tool_calls_log)} tool calls, "
        f"{(finished_at - started_at).total_seconds():.1f}s",
        file=sys.stderr,
    )
    return draft


if __name__ == "__main__":
    run_once()
