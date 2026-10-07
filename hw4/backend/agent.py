"""The Campus Customs shopping agent.

main.py imports exactly one thing from here: run_agent(message, history) ->
AgentResult with `reply`, `results_title`, `products` (cards for the website),
and `tools_used`. Everything else is wiring.

Model:  gpt-5.6-luna (override with MODEL_NAME) through Portkey's
        OpenAI-compatible gateway.
Prompt: loaded from prompts/prompt.md at startup.
Tools:  search_products, get_product_details, check_stock, find_alternatives,
        build_bundle (tools.py).
Output: ShopReply (models.py) - reply text plus the product_ids to show as cards.
Deps:   ShopDeps - the logged-in customer (or None for guests) and the page the
        shopper is on. A dynamic instructions function writes both into the
        agent's context on every run, so "this" on a product page resolves.
Limits: at most MAX_MODEL_REQUESTS model requests, MAX_TOOL_CALLS tool calls and
        MAX_TOTAL_TOKENS tokens per shopper message (LOOP_LIMITS).
Audit:  every run is appended to output/audit_trail.json (audit.py).
"""

from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from pydantic_ai import Agent, NativeOutput, RunContext, UsageLimits, capture_run_messages
from pydantic_ai.exceptions import UsageLimitExceeded
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    TextPart,
    UserPromptPart,
)
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from audit import append_events, loop_events, new_run_id, short
from audit import now as audit_now
from models import AgentResult, BundleResult, ProductCard, ShopDeps, ShopReply
from tools import (
    build_bundle,
    bundles_built,
    check_stock,
    find_alternatives,
    get_product_details,
    reset_shown_products,
    search_products,
    shown_products,
)

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PROMPT_PATH = HERE / "prompts" / "prompt.md"

# The PORTKEY_API_KEY lives in the project root .env; load that plus any closer
# .env, first value wins.
for _candidate in (
    HERE / ".env",
    ROOT / ".env",
    ROOT.parent / ".env",
    ROOT.parent.parent / ".env",
):
    load_dotenv(_candidate, override=False)

logger = logging.getLogger("campus_customs.agent")

MODEL_NAME = os.getenv("MODEL_NAME", "gpt-5.6-luna")
PORTKEY_BASE_URL = os.getenv("PORTKEY_BASE_URL", "https://api.portkey.ai/v1")

_agent: Agent | None = None


def _instructions() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8")


def build_agent() -> Agent:
    """Construct the agent. Raises RuntimeError if PORTKEY_API_KEY is missing."""
    api_key = os.getenv("PORTKEY_API_KEY")
    if not api_key:
        raise RuntimeError(
            "PORTKEY_API_KEY not found. Put it in the project root .env, "
            "then restart uvicorn."
        )

    model = OpenAIChatModel(
        MODEL_NAME,
        provider=OpenAIProvider(base_url=PORTKEY_BASE_URL, api_key=api_key),
    )
    agent = Agent(
        model,
        deps_type=ShopDeps,
        instructions=_instructions(),
        tools=[search_products, get_product_details, check_stock, find_alternatives, build_bundle],
        # Native structured output (JSON schema response format) instead of an
        # output tool: the reply is still validated as ShopReply, but the model
        # isn't forced to call a tool, so small talk takes one request, not two.
        output_type=NativeOutput(ShopReply),
        name="campus_customs_agent",
        retries=2,
    )
    agent.instructions(_who_and_where)
    return agent


def _who_and_where(ctx: RunContext[ShopDeps]) -> str:
    """Per-run context: who is chatting and what page they're looking at."""
    customer, page = ctx.deps.customer, ctx.deps.page
    lines = ["## Who you're talking to"]
    if customer:
        lines.append(
            f"The shopper is logged in as {customer.name} (first name: "
            f"{customer.first_name or customer.name}, email: {customer.email}). "
            "Greet them by first name when it fits. If they ask what name or email "
            "they're logged in with, you may tell them; this is their own account."
        )
    else:
        lines.append(
            "The shopper is a guest (not logged in), so you don't know their name. "
            "Their chat isn't saved; if they want it saved, they can log in or "
            "create an account."
        )

    lines.append("\n## Where they are on the website")
    if page.page_type == "product" and page.product_id:
        lines.append(
            f"They are viewing the product page for **{page.product_name}** "
            f"(product_id `{page.product_id}`). When they say \"this\", \"it\", or "
            "\"this one\" without naming a product, they mean this item: look it up "
            "by that product_id with get_product_details or check_stock."
        )
    else:
        lines.append(f"They are on the {page.page_type} page ({page.path}), not a product page.")

    if ctx.deps.redactions:
        lines.append(
            "\n## Sensitive info removed\n"
            f"The shield removed a {', '.join(ctx.deps.redactions)} from the shopper's latest "
            "message before you saw it. In one short sentence, remind them never to share "
            "that in chat (you never need it), then keep helping with their shopping."
        )
    return "\n".join(lines)


def get_agent() -> Agent:
    """Build once, reuse across requests."""
    global _agent
    if _agent is None:
        _agent = build_agent()
    return _agent


def _tools_used(messages: list[Any]) -> list[str]:
    used: list[str] = []
    for message in messages:
        for part in getattr(message, "parts", []):
            if getattr(part, "part_kind", "") == "tool-call":
                name = getattr(part, "tool_name", "") or ""
                # final_result is PydanticAI's structured-output tool, not a shop tool.
                if name and not name.startswith("final_result") and name not in used:
                    used.append(name)
    return used


# Keep the last N prior turns so the agent remembers context (e.g. a size the
# shopper asked about) without sending an ever-growing history.
MAX_HISTORY_TURNS = 12


def _build_history(history: list[dict] | None) -> list[ModelMessage]:
    """Turn [{role, content}, ...] from the widget into PydanticAI messages."""
    messages: list[ModelMessage] = []
    for turn in (history or [])[-MAX_HISTORY_TURNS:]:
        role = turn.get("role")
        content = (turn.get("content") or "").strip()
        if not content:
            continue
        if role == "user":
            messages.append(ModelRequest(parts=[UserPromptPart(content=content)]))
        elif role == "assistant":
            messages.append(ModelResponse(parts=[TextPart(content=content)]))
    return messages


# Loop limits for one shopper message. A normal turn takes 1-3 model requests;
# hitting a limit stops the run and is logged with stop_reason "loop_limit".
MAX_MODEL_REQUESTS = 6
MAX_TOOL_CALLS = 10
MAX_TOTAL_TOKENS = 60_000
LOOP_LIMITS = UsageLimits(
    request_limit=MAX_MODEL_REQUESTS,
    tool_calls_limit=MAX_TOOL_CALLS,
    total_tokens_limit=MAX_TOTAL_TOKENS,
)


def run_agent(message: str, history: list[dict] | None, deps: ShopDeps) -> AgentResult:
    """Answer one shopper message, using prior turns and deps for context.

    Every run is written to the append-only audit trail (audit.py): start, each
    model step and tool call/result, and how the run stopped.
    """
    run_id, started = new_run_id(), time.perf_counter()
    message_history = _build_history(history)
    audit_start = {
        "time": audit_now(),
        "run_id": run_id,
        "event": "run_start",
        "model": MODEL_NAME,
        "user": f"customer:{deps.customer.id}" if deps.customer else "guest",
        "page": deps.page.path,
        "page_product": deps.page.product_id,
        "message": short(message),
        "history_messages": len(message_history),
        "redactions": deps.redactions,
    }

    try:
        agent = get_agent()
    except RuntimeError as exc:
        result = AgentResult(reply=f"⚠️ {exc}", error=True)
        _audit(audit_start, [], result, "config_error", started, error=str(exc))
        return result

    reset_shown_products()
    with capture_run_messages() as captured:
        try:
            run = agent.run_sync(message, message_history=message_history, deps=deps, usage_limits=LOOP_LIMITS)
        except UsageLimitExceeded as exc:
            result = AgentResult(
                reply="Sorry, that one took me too many steps 🐾 Could you ask it a simpler way, "
                "or one product at a time?",
                error=True,
            )
            _audit(audit_start, captured[len(message_history):], result, "loop_limit", started, error=str(exc))
            return result
        except Exception as exc:  # noqa: BLE001
            # The provider's own safety filter can reject a request (e.g. a
            # jailbreak attempt). Shoppers get a friendly answer either way; the
            # technical details only go to the audit trail, never to the chat.
            filtered = _is_content_filter(exc)
            result = AgentResult(
                reply=(
                    "I can't help with that one, but I'm happy to help you find Yale gear, "
                    "check sizes, or compare styles 🐾"
                    if filtered
                    else "Ruh-roh, I couldn't reach my brain just now. Please try again in a moment 🐾"
                ),
                error=True,
            )
            stop = "content_filter" if filtered else "model_error"
            _audit(audit_start, captured[len(message_history):], result, stop, started, error=str(exc))
            return result

    output: ShopReply = run.output
    result = AgentResult(
        reply=output.reply,
        results_title=output.results_title,
        products=_cards_for(output.product_ids),
        tools_used=_tools_used(list(run.all_messages())),
        bundle=_bundle_for(output.product_ids),
    )
    _audit(audit_start, run.new_messages(), result, "final_output", started)
    return result


def _is_content_filter(exc: Exception) -> bool:
    text = str(exc).lower()
    return "content_filter" in text or "content management policy" in text


def _audit(
    start: dict,
    messages: list[ModelMessage],
    result: AgentResult,
    stop_reason: str,
    started: float,
    error: str | None = None,
) -> None:
    """Write this run's events to the audit trail. Logging never breaks a chat."""
    try:
        steps, totals = loop_events(start["run_id"], list(messages))
        responses = [m for m in messages if isinstance(m, ModelResponse)]
        end = {
            "time": audit_now(),
            "run_id": start["run_id"],
            "event": "run_end",
            "stop_reason": stop_reason,
            "last_finish_reason": totals["last_finish_reason"],
            "duration_ms": round((time.perf_counter() - started) * 1000),
            "model_requests": totals["model_steps"],
            "tool_calls": sum(len(e["tool_calls"]) for e in steps if e["event"] == "model_step"),
            "input_tokens": sum(m.usage.input_tokens for m in responses),
            "output_tokens": sum(m.usage.output_tokens for m in responses),
            "products_shown": len(result.products),
            "bundle_total": result.bundle.total if result.bundle else None,
            "reply": short(result.reply),
        }
        if error:
            end["error"] = short(error, 300)
        append_events([start, *steps, end])
    except Exception as exc:  # noqa: BLE001
        logger.warning("audit trail write failed: %s", exc)


def _bundle_for(product_ids: list[str]) -> BundleResult | None:
    """The most recent bundle build_bundle made this run, if the reply presents it.

    The receipt (items, total, remaining) comes straight from the tool, so the
    numbers the shopper sees are computed in code, not written by the model.
    """
    presented = set(product_ids)
    for bundle in reversed(bundles_built()):
        if bundle.items and {item.product_id for item in bundle.items} <= presented:
            return bundle
    return None


def _cards_for(product_ids: list[str]) -> list[ProductCard]:
    """Cards for the ids the agent chose, in its order.

    Only ids a tool actually returned during this run are kept, so the website
    can never show a product the model made up.
    """
    seen = shown_products()
    cards: list[ProductCard] = []
    for pid in dict.fromkeys(product_ids):  # dedupe, keep order
        if pid in seen:
            cards.append(seen[pid])
    return cards
