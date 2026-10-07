"""Append-only audit trail of agent loop activity: output/audit_trail.json.

Every chat turn adds events to one JSON array (oldest first) and never removes
any. Events share a `run_id`:

    run_start    who (customer id or guest), page, the shielded message
    model_step   one per model request: finish_reason, tool calls asked for, tokens
    tool_call    tool name + short args
    tool_result  tool name + short result summary
    retry        a tool or the output failed validation and the model was asked again
    run_end      stop_reason, duration, totals, short reply

To append without rewriting the file, the writer seeks back to the closing `]`,
truncates just that bracket, and writes `,<new events>]`, so the file is valid
JSON after every turn. A lock keeps concurrent requests from interleaving.
No emails, password data or full product payloads are logged.
"""

from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pydantic_core import to_jsonable_python

ROOT = Path(__file__).resolve().parent.parent
AUDIT_PATH = Path(os.getenv("AUDIT_PATH", ROOT / "output" / "audit_trail.json"))
MAX_TEXT = 160  # characters kept for messages, args and results

_lock = threading.Lock()


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def new_run_id() -> str:
    return uuid.uuid4().hex[:12]


def short(value: Any, limit: int = MAX_TEXT) -> str:
    """Compact one-line text for the log, cut to `limit` characters."""
    text = value if isinstance(value, str) else json.dumps(to_jsonable_python(value), separators=(",", ":"))
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def summarize_result(content: Any) -> str:
    """A readable one-liner for the tool results this agent returns."""
    data = to_jsonable_python(content)
    if not isinstance(data, dict):
        return short(data)
    if data.get("found") is False:
        return short(f"not found: {data.get('product_ref') or data.get('note') or ''}")
    if "total_matches" in data:  # SearchResults
        names = ", ".join(p["name"] for p in data.get("products", [])[:3])
        return short(f"{data['returned']} of {data['total_matches']} matches: {names}")
    if "alternatives" in data:  # AlternativesResult
        names = ", ".join(a["name"] for a in data["alternatives"][:3])
        return short(f"{len(data['alternatives'])} alternatives to {data.get('source_name')}: {names}")
    if "items" in data and "total" in data:  # BundleResult
        status = "within budget" if data.get("within_budget") else "over budget"
        return short(
            f"{len(data['items'])} items, total ${data['total']:.2f} of ${data['budget']:.2f} ({status})"
        )
    if "sizes" in data:  # ProductDetail / StockReport
        sizes = " ".join(f"{s['size']}={s['quantity']}" for s in data["sizes"])
        price = f" ${data['price']:.2f}" if "price" in data else ""
        return short(f"{data.get('name')}{price} | {sizes}")
    return short(data)


def append_events(events: list[dict]) -> None:
    """Add events to the end of the audit file. Never rewrites earlier events."""
    if not events:
        return
    body = ",\n".join(json.dumps(e, ensure_ascii=False) for e in events)
    with _lock:
        AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
        if not AUDIT_PATH.exists() or AUDIT_PATH.stat().st_size == 0:
            AUDIT_PATH.write_text(f"[\n{body}\n]\n", encoding="utf-8")
            return
        with AUDIT_PATH.open("r+b") as f:
            end = f.seek(0, os.SEEK_END)
            f.seek(max(0, end - 4096))
            tail = f.read()
            close = tail.rfind(b"]")
            if close == -1:
                # Not a JSON array we wrote; keep it untouched and start a fresh file.
                AUDIT_PATH.rename(AUDIT_PATH.with_suffix(f".unreadable-{new_run_id()}.json"))
                AUDIT_PATH.write_text(f"[\n{body}\n]\n", encoding="utf-8")
                return
            empty = tail[:close].rstrip().endswith(b"[")
            f.seek(end - len(tail) + close)
            f.truncate()
            f.write((("\n" if empty else ",\n") + body + "\n]\n").encode("utf-8"))


def loop_events(run_id: str, messages: list[Any]) -> tuple[list[dict], dict]:
    """Audit events for the messages one agent run produced, plus step totals."""
    events: list[dict] = []
    step = 0
    last_finish: str | None = None
    for message in messages:
        kind = getattr(message, "kind", "")
        if kind == "response":
            step += 1
            calls = [p for p in message.parts if p.part_kind == "tool-call"]
            last_finish = message.finish_reason
            events.append(
                {
                    "time": message.timestamp.isoformat(timespec="milliseconds"),
                    "run_id": run_id,
                    "event": "model_step",
                    "step": step,
                    "finish_reason": message.finish_reason,
                    "tool_calls": [c.tool_name for c in calls],
                    "input_tokens": message.usage.input_tokens,
                    "output_tokens": message.usage.output_tokens,
                }
            )
            for call in calls:
                events.append(
                    {
                        "time": message.timestamp.isoformat(timespec="milliseconds"),
                        "run_id": run_id,
                        "event": "tool_call",
                        "step": step,
                        "tool": call.tool_name,
                        "args": short(call.args or {}),
                    }
                )
        elif kind == "request":
            for part in message.parts:
                if part.part_kind == "tool-return":
                    events.append(
                        {
                            "time": part.timestamp.isoformat(timespec="milliseconds"),
                            "run_id": run_id,
                            "event": "tool_result",
                            "step": step,
                            "tool": part.tool_name,
                            "result": summarize_result(part.content),
                        }
                    )
                elif part.part_kind == "retry-prompt":
                    events.append(
                        {
                            "time": part.timestamp.isoformat(timespec="milliseconds"),
                            "run_id": run_id,
                            "event": "retry",
                            "step": step,
                            "tool": part.tool_name,
                            "reason": short(part.content),
                        }
                    )
    return events, {"model_steps": step, "last_finish_reason": last_finish}
