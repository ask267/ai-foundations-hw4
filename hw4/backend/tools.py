"""The Campus Customs agent's tools, all backed by data/campus_customs.db.

- search_products      browse by category / color / price / keywords
- get_product_details  one product's description, price, colors, stock
- check_stock          stock by size for one product
- find_alternatives    in-stock swaps when something doesn't fit
- build_bundle         an outfit or gift set that fits a budget (totals in code)

Every tool that touches a product also remembers its ProductCard for the current
request. The agent's final answer lists the product_ids it is presenting, and
agent.py turns exactly those ids into cards from this per-request store, so the
website only ever shows real catalogue rows the tools actually returned.
"""

from __future__ import annotations

import json
import sqlite3
from contextvars import ContextVar
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from models import (
    Alternative,
    AlternativesResult,
    BundleItem,
    BundleResult,
    BundleSlot,
    Category,
    ProductCard,
    ProductDetail,
    ProductMatch,
    SearchResults,
    SizeStock,
    StockReport,
)

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DB_PATH = ROOT / "data" / "campus_customs.db"

MAX_RESULTS = 30
SIZE_ORDER = {"XS": 0, "S": 1, "M": 2, "L": 3, "XL": 4, "XXL": 5}

# Words that carry no search meaning in shopper questions.
STOPWORDS = {
    "a", "an", "and", "any", "are", "available", "campus", "carry", "customs", "do",
    "for", "got", "have", "i", "in", "is", "item", "items", "less", "looking", "me",
    "my", "of", "on", "options", "or", "please", "sell", "show", "some", "than",
    "the", "there", "to", "under", "want", "what", "which", "with", "yale", "you",
    "your",
}

# Query words that really mean "this category" rather than a keyword.
CATEGORY_WORDS: dict[str, Category] = {
    "hoodie": "hoodie", "hoody": "hoodie", "hooded": "hoodie",
    "crewneck": "crewneck",
    "tee": "t-shirt", "tshirt": "t-shirt", "t-shirt": "t-shirt",
    "quarter-zip": "quarter-zip", "quarterzip": "quarter-zip",
    "jacket": "jacket",
}


def category_of(garment_type: str) -> Category:
    """Map the catalogue's free-text garment_type onto one shop category."""
    g = garment_type.lower()
    if "hood" in g:
        return "hoodie"
    if "quarter-zip" in g:
        return "quarter-zip"
    if "jacket" in g:
        return "jacket"
    if "t-shirt" in g:
        return "t-shirt"
    if "crewneck" in g:
        return "crewneck"
    if "shirt" in g:
        return "long-sleeve shirt"
    return "sweatshirt"


def color_family(color: str) -> str | None:
    """Group the catalogue's 22 color names into families ("navy blue" -> "navy")."""
    c = color.lower()
    for family, words in (
        ("navy", ("navy",)),
        ("blue", ("blue",)),
        ("gray", ("gray", "grey", "charcoal")),
        ("white", ("white", "cream", "ivory")),
        ("black", ("black",)),
        ("red", ("red", "coral")),
        ("gold", ("gold", "yellow")),
        ("green", ("green",)),
        ("multicolor", ("multicolor",)),
    ):
        if any(w in c for w in words):
            return family
    return None


def _normalize(word: str) -> str:
    """Lowercase, unify grey/gray, and strip a simple plural ("hoodies" -> "hoodie")."""
    w = word.lower().strip(".,!?$'\"()")
    if w == "grey":
        return "gray"
    if len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
        w = w[:-1]
    return w


def _parse_keywords(keywords: str | None, category: Category | None) -> tuple[list[str], Category | None]:
    """Split free-text keywords into search terms; category words become the category."""
    terms: list[str] = []
    for raw in (keywords or "").split():
        term = _normalize(raw)
        if not term or term in STOPWORDS:
            continue
        if term in CATEGORY_WORDS:
            category = category or CATEGORY_WORDS[term]
            continue
        terms.append(term)
    return terms, category


# ---------- per-request card store ----------

_shown: ContextVar[dict[str, ProductCard]] = ContextVar("shown_products")
# Bundles build_bundle made this request, so main.py can show the receipt.
_bundles: ContextVar[list[BundleResult]] = ContextVar("bundles_built")


def reset_shown_products() -> None:
    _shown.set({})
    _bundles.set([])


def bundles_built() -> list[BundleResult]:
    try:
        return _bundles.get()
    except LookupError:
        return []


def shown_products() -> dict[str, ProductCard]:
    try:
        return _shown.get()
    except LookupError:
        return {}


def _remember(record: "Record") -> None:
    # agent.py calls reset_shown_products() before each run, so this dict is shared
    # with the tool's (copied) context and mutations are visible after the run.
    try:
        store = _shown.get()
    except LookupError:
        store = {}
        _shown.set(store)
    store.setdefault(record.product_id, record.card())


# ---------- data loading ----------

@dataclass
class Record:
    product_id: str
    name: str
    garment_type: str
    description: str
    colors: list[str]
    search_tags: list[str]
    image_file_path: str
    price: float
    sizes: list[SizeStock]

    @property
    def category(self) -> Category:
        return category_of(self.garment_type)

    @property
    def total_stock(self) -> int:
        return sum(s.quantity for s in self.sizes)

    @property
    def color_families(self) -> set[str]:
        return {f for c in self.colors if (f := color_family(c))}

    @property
    def haystack(self) -> str:
        return " ".join(
            [self.name, self.garment_type, self.description, *self.colors, *self.search_tags]
        ).lower()

    def card(self) -> ProductCard:
        return ProductCard(
            product_id=self.product_id,
            name=self.name,
            category=self.category,
            garment_type=self.garment_type,
            description=self.description,
            colors=self.colors,
            color_families=sorted(self.color_families),
            price=self.price,
            image_url=f"/media/{self.image_file_path}",
            total_stock=self.total_stock,
        )


def _load_records() -> list[Record]:
    """Whole catalogue with stock, in two queries (no per-product lookups)."""
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        stock: dict[str, list[SizeStock]] = {}
        for r in conn.execute("SELECT product_id, size, quantity FROM inventory"):
            stock.setdefault(r["product_id"], []).append(
                SizeStock(size=r["size"], quantity=r["quantity"], in_stock=r["quantity"] > 0)
            )
        records = []
        for r in conn.execute("SELECT * FROM catalogue ORDER BY name"):
            sizes = sorted(stock.get(r["product_id"], []), key=lambda s: SIZE_ORDER.get(s.size, 99))
            records.append(
                Record(
                    product_id=r["product_id"],
                    name=r["name"],
                    garment_type=r["garment_type"],
                    description=r["description"],
                    colors=json.loads(r["colors"]),
                    search_tags=json.loads(r["search_tags"]),
                    image_file_path=r["image_file_path"],
                    price=r["price"],
                    sizes=sizes,
                )
            )
        return records
    finally:
        conn.close()


def _resolve(product_ref: str) -> Record | None:
    """Find one product from a product_id, exact name, or closest keyword match."""
    ref = (product_ref or "").strip().lower()
    if not ref:
        return None
    records = _load_records()
    for rec in records:
        if rec.product_id == ref or rec.name.lower() == ref:
            return rec

    terms = [_normalize(t) for t in ref.split() if _normalize(t) not in STOPWORDS]
    best: tuple[int, Record] | None = None
    for rec in records:
        name = rec.name.lower()
        score = 10 if ref in name else 0
        for term in terms:
            if term in name:
                score += 3
            elif term in rec.haystack:
                score += 1
        if score > 0 and (best is None or score > best[0]):
            best = (score, rec)
    return best[1] if best else None


# ---------- tools ----------

def search_products(
    category: Category | None = None,
    color: str | None = None,
    max_price: float | None = None,
    min_price: float | None = None,
    keywords: str | None = None,
    limit: int = MAX_RESULTS,
) -> SearchResults:
    """Search the Campus Customs catalogue. Use this for any "what X do you have" question.

    Prefer the structured filters; call once with all the filters that apply.

    Args:
        category: One of "hoodie", "crewneck", "t-shirt", "quarter-zip", "jacket",
            "long-sleeve shirt", "sweatshirt". Use it whenever the shopper names a
            type of item ("hoodies" -> "hoodie", "tees" -> "t-shirt").
        color: A color to match, e.g. "navy", "gray", "white".
        max_price: Only products at or below this price in dollars.
        min_price: Only products at or above this price in dollars.
        keywords: Other words that must all match, e.g. a sport, team, residential
            college, or graphic ("hockey", "sailing", "Davenport", "bulldog").
        limit: Maximum products to return (up to 30).

    Returns:
        total_matches (how many products matched), returned (how many are listed),
        and products: compact matches with product_id, name, category, price,
        colors, in_stock, and a short_description. Empty products means nothing
        in the catalogue matches.
    """
    terms, category = _parse_keywords(keywords, category)
    color_term = _normalize(color) if color else None

    matches: list[Record] = []
    for rec in _load_records():
        if category and rec.category != category:
            continue
        if color_term and not any(color_term in c.lower() for c in rec.colors):
            continue
        if max_price is not None and rec.price > max_price:
            continue
        if min_price is not None and rec.price < min_price:
            continue
        if terms and not all(t in rec.haystack for t in terms):
            continue
        matches.append(rec)

    if terms:
        # Name hits rank above description-only hits; ties stay alphabetical.
        matches.sort(key=lambda r: -sum(t in r.name.lower() for t in terms))

    cap = max(1, min(int(limit or MAX_RESULTS), MAX_RESULTS))
    listed = matches[:cap]
    for rec in listed:
        _remember(rec)

    return SearchResults(
        total_matches=len(matches),
        returned=len(listed),
        products=[
            ProductMatch(
                product_id=rec.product_id,
                name=rec.name,
                category=rec.category,
                price=rec.price,
                colors=rec.colors,
                in_stock=rec.total_stock > 0,
                short_description=rec.description[:120],
            )
            for rec in listed
        ],
    )


def get_product_details(product_ref: str) -> ProductDetail | dict:
    """Look up one product's real details from the shop database.

    Use this whenever a shopper asks about a specific product's description,
    price, colors, or overall availability. Never state a price or description
    from memory; call this and use what it returns.

    Args:
        product_ref: A product name, product_id, or close keywords, e.g.
            "Basic Hoodie Big Yale", "basic-hoodie-big-yale", or "big yale hoodie".

    Returns:
        product_id, name, garment_type, description, colors, price, total_stock,
        in_stock, and per-size stock. If no product matches, returns
        {"found": False, "product_ref": <ref>}.
    """
    rec = _resolve(product_ref)
    if rec is None:
        return {"found": False, "product_ref": product_ref}
    _remember(rec)
    return ProductDetail(
        product_id=rec.product_id,
        name=rec.name,
        garment_type=rec.garment_type,
        description=rec.description,
        colors=rec.colors,
        price=rec.price,
        total_stock=rec.total_stock,
        in_stock=rec.total_stock > 0,
        sizes=rec.sizes,
    )


def check_stock(product_ref: str, size: str | None = None) -> StockReport | dict:
    """Check how many units of a product are in stock, by size, from the database.

    Use this for any availability or "do you have my size" question. Never guess
    a quantity; call this. If a size is out of stock, tell the shopper clearly.

    Args:
        product_ref: A product name, product_id, or close keywords.
        size: Optional specific size to check, e.g. "M", "XL". Case-insensitive.

    Returns:
        product_id, name, total_stock, in_stock, and per-size stock. If a size was
        given, also requested_size, requested_size_quantity, and
        requested_size_in_stock. If no product matches, returns
        {"found": False, "product_ref": <ref>}.
    """
    rec = _resolve(product_ref)
    if rec is None:
        return {"found": False, "product_ref": product_ref}
    _remember(rec)
    report = StockReport(
        product_id=rec.product_id,
        name=rec.name,
        total_stock=rec.total_stock,
        in_stock=rec.total_stock > 0,
        sizes=rec.sizes,
    )
    if size:
        wanted = size.strip().upper()
        match = next((s for s in rec.sizes if s.size.upper() == wanted), None)
        report.requested_size = wanted
        report.requested_size_quantity = match.quantity if match else 0
        report.requested_size_in_stock = bool(match and match.in_stock)
    return report


# ---------- alternatives ----------

# Tag words that describe the garment or brand rather than a theme; sharing them
# says nothing about similarity (the category and color checks already cover it).
_GENERIC_TAG_WORDS = (
    "yale", "campus", "college", "merch", "apparel", "hood", "crew", "shirt", "sweat",
    "sleeve", "pullover", "zip", "jacket", "tee", "fleece", "pocket", "logo", "lettering",
    "navy", "gray", "grey", "white", "blue", "black", "red", "graphic", "casual",
)


def _themes(rec: Record) -> set[str]:
    return {
        t.lower() for t in rec.search_tags
        if not any(w in t.lower() for w in _GENERIC_TAG_WORDS)
    }


def _size_qty(rec: Record, size: str) -> int:
    return next((s.quantity for s in rec.sizes if s.size.upper() == size), 0)


def _matches_color(rec: Record, color: str) -> bool:
    family = color_family(color)
    if family:
        return family in rec.color_families
    return any(color.lower() in c.lower() for c in rec.colors)


def similar_records(
    source: Record,
    records: list[Record],
    size: str | None = None,
    color: str | None = None,
    limit: int = 4,
) -> list[tuple[Record, list[str]]]:
    """Best in-stock swaps for `source`, each with the reasons it was picked."""
    source_themes = _themes(source)
    scored = []
    for rec in records:
        if rec.product_id == source.product_id or rec.total_stock == 0:
            continue
        if size and _size_qty(rec, size) == 0:
            continue
        if color and not _matches_color(rec, color):
            continue

        score, why = 0, []
        if rec.category == source.category:
            score += 6
            why.append(f"Also a {rec.category}")
        shared = sorted(rec.color_families & source.color_families)
        if shared:
            score += 2 * len(shared)
            why.append("Same colors: " + ", ".join(shared))
        gap = abs(rec.price - source.price)
        if gap <= 10:
            score += 2
            why.append(f"Similar price (${rec.price:.0f})")
        elif gap <= 25:
            score += 1
        themes = sorted(_themes(rec) & source_themes)[:3]
        score += 2 * len(themes)
        if themes:
            why.append("Shares: " + ", ".join(themes))
        if size:
            why.append(f"{size} in stock ({_size_qty(rec, size)} left)")
        if color:
            why.append(f"Comes in {color}")
        scored.append((score, gap, rec, why))

    scored.sort(key=lambda item: (-item[0], item[1], item[2].name))
    return [(rec, why) for _score, _gap, rec, why in scored[: max(1, min(limit, 8))]]


def find_alternatives(
    product_ref: str,
    size: str | None = None,
    color: str | None = None,
    limit: int = 4,
) -> AlternativesResult:
    """Find in-stock alternatives to a product: the best swaps when it doesn't fit.

    Call this when a product or the shopper's size is sold out, when it doesn't
    come in the color they want, or when they ask for "something similar".
    Pass the size and/or color they need so every alternative actually has it.

    Args:
        product_ref: The product they were looking at (name or product_id).
        size: Size they need, e.g. "XS". Only alternatives with that size in stock.
        color: Color they want, e.g. "gray". Only alternatives in that color.
        limit: How many alternatives to return (up to 8).

    Returns:
        found, the source product, and alternatives: each with product_id, name,
        category, price, colors, `why` (reasons it's a good swap), and the
        requested size's quantity. An empty list means nothing in stock fits;
        say so honestly.
    """
    source = _resolve(product_ref)
    if source is None:
        return AlternativesResult(found=False, note=f"No product matches {product_ref!r}.")
    wanted_size = size.strip().upper() if size else None
    picks = similar_records(source, _load_records(), wanted_size, color, limit)
    for rec, _why in picks:
        _remember(rec)
    return AlternativesResult(
        found=True,
        source_product_id=source.product_id,
        source_name=source.name,
        requested_size=wanted_size,
        requested_color=color,
        alternatives=[
            Alternative(
                product_id=rec.product_id,
                name=rec.name,
                category=rec.category,
                price=rec.price,
                colors=rec.colors,
                why=why,
                requested_size_quantity=_size_qty(rec, wanted_size) if wanted_size else None,
            )
            for rec, why in picks
        ],
        note=None if picks else "Nothing else in stock matches those requirements.",
    )


def similar_cards(product_id: str, limit: int = 4) -> list[tuple[ProductCard, list[str]]]:
    """Cards for the product page's "You might also like" row (same engine as the tool)."""
    records = _load_records()
    source = next((r for r in records if r.product_id == product_id), None)
    if source is None:
        return []
    return [(rec.card(), why) for rec, why in similar_records(source, records, limit=limit)]


# ---------- bundle builder ----------

MAX_BUNDLE_SLOTS = 5
MAX_CANDIDATES_PER_SLOT = 25
MAX_SEARCH_STEPS = 200_000  # hard cap so a huge request can't stall the chat


def _slot_candidates(slot: BundleSlot, records: list[Record]) -> list[tuple[int, Record]]:
    """In-stock products that fit one slot, as (relevance, record), best first."""
    terms, category = _parse_keywords(slot.keywords, slot.category)
    size = slot.size.strip().upper() if slot.size else None
    hits = []
    for rec in records:
        if rec.total_stock == 0:
            continue
        if category and rec.category != category:
            continue
        if slot.color and not _matches_color(rec, slot.color):
            continue
        if slot.max_price is not None and rec.price > slot.max_price:
            continue
        if size and _size_qty(rec, size) == 0:
            continue
        if terms and not all(t in rec.haystack for t in terms):
            continue
        relevance = sum(t in rec.name.lower() for t in terms)
        hits.append((relevance, rec))
    hits.sort(key=lambda h: (-h[0], h[1].price, h[1].name))
    return hits[:MAX_CANDIDATES_PER_SLOT]


def build_bundle(
    slots: list[BundleSlot],
    budget: float,
    goal: Literal["best_use_of_budget", "cheapest"] = "best_use_of_budget",
) -> BundleResult:
    """Put together an outfit or gift set from in-stock products that fits a budget.

    Call this when the shopper wants SEVERAL pieces together with a spending
    limit: "a hoodie and a tee for my dad under $120", "game-day outfit in M for
    $100", "gifts for mom and grandpa, $150 total". One slot per piece.

    The tool checks every combination of matching products, so the total is exact
    and every piece really has the requested size in stock. Never add up prices
    yourself; quote `total` and `remaining` from this result.

    Args:
        slots: One entry per piece (up to 5). Each can set label ("for Dad"),
            category, color, keywords (theme words like "hockey", "dad",
            "bulldog"), size (must be in stock), and max_price.
        budget: Total spending limit in dollars for the whole bundle.
        goal: "best_use_of_budget" (default) picks the best-matching bundle that
            uses the budget well; "cheapest" picks the lowest total.

    Returns:
        found (every slot had at least one in-stock match), items (the chosen
        product for each slot with price and size stock), total, remaining
        (budget - total), within_budget, and a note. If within_budget is false,
        the items are the cheapest possible bundle; tell the shopper honestly how
        far over budget it is.
    """
    slots = list(slots)[:MAX_BUNDLE_SLOTS]
    budget = round(float(budget), 2)
    if not slots:
        return BundleResult(found=False, budget=budget, note="No pieces were requested.")

    records = _load_records()
    candidates = [_slot_candidates(slot, records) for slot in slots]
    empty = [slot.label or slot.category or slot.keywords or f"piece {i + 1}"
             for i, (slot, c) in enumerate(zip(slots, candidates)) if not c]
    if empty:
        return BundleResult(
            found=False,
            budget=budget,
            note="Nothing in stock matches: " + ", ".join(map(str, empty)) + ".",
        )

    # Search the most constrained slot first; prune any partial bundle that can't
    # finish under budget even with the cheapest remaining pieces.
    order = sorted(range(len(slots)), key=lambda i: len(candidates[i]))
    cheapest_rest = [0.0] * (len(order) + 1)
    for depth in range(len(order) - 1, -1, -1):
        cheapest_rest[depth] = cheapest_rest[depth + 1] + min(r.price for _, r in candidates[order[depth]])

    best: tuple[tuple, list[Record]] | None = None
    checked = steps = 0
    chosen: list[Record | None] = [None] * len(slots)

    def search(depth: int, total: float, relevance: int, used: set[str]) -> None:
        nonlocal best, checked, steps
        steps += 1
        if steps > MAX_SEARCH_STEPS:
            return
        if depth == len(order):
            checked += 1
            spend = total if goal == "best_use_of_budget" else -total
            key = (relevance, round(spend, 2))
            if best is None or key > best[0]:
                best = (key, list(chosen))  # type: ignore[arg-type]
            return
        slot_index = order[depth]
        for rel, rec in candidates[slot_index]:
            if rec.product_id in used:
                continue
            if total + rec.price + cheapest_rest[depth + 1] > budget + 1e-9:
                continue
            chosen[slot_index] = rec
            search(depth + 1, total + rec.price, relevance + rel, used | {rec.product_id})
        chosen[slot_index] = None

    search(0, 0.0, 0, set())

    within = best is not None
    if best is not None:
        picks = best[1]
    else:
        # Nothing fits: show the cheapest possible bundle (distinct products) instead.
        picks, used = [], set()
        for cands in candidates:
            rec = next((r for _, r in sorted(cands, key=lambda h: h[1].price) if r.product_id not in used), None)
            if rec is None:
                return BundleResult(found=False, budget=budget, note="Not enough different products to fill every piece.")
            used.add(rec.product_id)
            picks.append(rec)

    items = []
    for slot, rec in zip(slots, picks):
        _remember(rec)
        size = slot.size.strip().upper() if slot.size else None
        items.append(
            BundleItem(
                label=slot.label,
                product_id=rec.product_id,
                name=rec.name,
                category=rec.category,
                price=rec.price,
                colors=rec.colors,
                size=size,
                size_quantity=_size_qty(rec, size) if size else None,
            )
        )
    total = round(sum(item.price for item in items), 2)
    result = BundleResult(
        found=True,
        budget=budget,
        items=items,
        total=total,
        remaining=round(budget - total, 2),
        within_budget=within,
        combinations_checked=checked,
        note=None if within else (
            f"No combination fits ${budget:.2f}. The cheapest possible bundle is "
            f"${total:.2f}, ${total - budget:.2f} over budget."
        ),
    )
    try:
        _bundles.get().append(result)
    except LookupError:
        _bundles.set([result])
    return result
