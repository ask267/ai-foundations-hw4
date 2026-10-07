"""Structured types shared by the agent, its tools, and the API.

These grow as the agent gains new abilities (Problem 5 onward).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from pydantic import BaseModel, Field

# Shop categories, normalized from the catalogue's free-text garment_type.
Category = Literal[
    "hoodie",
    "crewneck",
    "t-shirt",
    "quarter-zip",
    "jacket",
    "long-sleeve shirt",
    "sweatshirt",
]


# ---------- tool results (what the model sees) ----------

class ProductMatch(BaseModel):
    """One compact search hit: just enough for the model to choose and describe it."""

    product_id: str
    name: str
    category: Category
    price: float
    colors: list[str] = Field(default_factory=list)
    in_stock: bool
    short_description: str


class SearchResults(BaseModel):
    """search_products result: the matches plus how many matched in total."""

    total_matches: int
    returned: int
    products: list[ProductMatch] = Field(default_factory=list)


class SizeStock(BaseModel):
    """Stock for one size, with a clear in/out-of-stock flag."""

    size: str
    quantity: int
    in_stock: bool


class ProductDetail(BaseModel):
    """Full lookup result for one product: description, price, and stock."""

    product_id: str
    name: str
    garment_type: str
    description: str
    colors: list[str] = Field(default_factory=list)
    price: float
    total_stock: int = 0
    in_stock: bool = False
    sizes: list[SizeStock] = Field(default_factory=list)


class StockReport(BaseModel):
    """Stock lookup for a product, optionally focused on one requested size."""

    product_id: str
    name: str
    total_stock: int = 0
    in_stock: bool = False
    sizes: list[SizeStock] = Field(default_factory=list)
    requested_size: str | None = None
    requested_size_in_stock: bool | None = None
    requested_size_quantity: int | None = None


class Alternative(BaseModel):
    """One in-stock alternative, with plain-language reasons it's a good swap."""

    product_id: str
    name: str
    category: Category
    price: float
    colors: list[str] = Field(default_factory=list)
    why: list[str] = Field(default_factory=list)
    requested_size_quantity: int | None = None


class AlternativesResult(BaseModel):
    """find_alternatives result: what we compared against and the best swaps."""

    found: bool
    source_product_id: str | None = None
    source_name: str | None = None
    requested_size: str | None = None
    requested_color: str | None = None
    alternatives: list[Alternative] = Field(default_factory=list)
    note: str | None = None


class BundleSlot(BaseModel):
    """One piece the shopper wants in a bundle (outfit or gift set)."""

    label: str | None = Field(
        default=None, description='Who or what this piece is for, e.g. "for Dad", "top layer".'
    )
    category: Category | None = None
    color: str | None = Field(default=None, description='e.g. "navy", "gray".')
    keywords: str | None = Field(
        default=None, description='Theme words that must match, e.g. "hockey", "dad", "Davenport".'
    )
    size: str | None = Field(default=None, description='Size this piece must have in stock, e.g. "L".')
    max_price: float | None = None


class BundleItem(BaseModel):
    """One chosen piece: the real product, its price, and the stock in the requested size."""

    label: str | None = None
    product_id: str
    name: str
    category: Category
    price: float
    colors: list[str] = Field(default_factory=list)
    size: str | None = None
    size_quantity: int | None = None


class BundleResult(BaseModel):
    """build_bundle result. Totals are computed in code, never by the model."""

    found: bool
    budget: float
    items: list[BundleItem] = Field(default_factory=list)
    total: float = 0.0
    remaining: float = 0.0  # budget - total; negative means over budget
    within_budget: bool = False
    combinations_checked: int = 0
    note: str | None = None


# ---------- agent dependencies (who is chatting, where they are) ----------

class Customer(BaseModel):
    """The logged-in shopper, taken from the verified session token."""

    id: int
    first_name: str | None = None
    last_name: str | None = None
    name: str
    email: str


PageType = Literal["home", "products", "product", "about", "login", "create-account", "other"]


class PageContext(BaseModel):
    """What page the shopper is on, checked against the database by the backend."""

    page_type: PageType = "other"
    path: str = "/"
    product_id: str | None = None  # set only when it matches a real catalogue row
    product_name: str | None = None


@dataclass
class ShopDeps:
    """PydanticAI dependencies for one agent run (RunContext.deps)."""

    customer: Customer | None
    page: PageContext
    redactions: list[str] = field(default_factory=list)  # what the shield removed this turn


# ---------- agent output (what the model returns) ----------

class ShopReply(BaseModel):
    """The agent's structured final answer."""

    reply: str = Field(description="The chat message to show the shopper (markdown allowed).")
    product_ids: list[str] = Field(
        default_factory=list,
        description=(
            "product_id of every product you are presenting, in display order. "
            "Only ids that appeared in a tool result during this conversation turn. "
            "The website renders these as product cards. Empty if you aren't showing products."
        ),
    )
    results_title: str | None = Field(
        default=None,
        description='Short heading for the cards on the page, e.g. "Navy hoodies" or "Hockey gear".',
    )


# ---------- API contract (what the website receives) ----------

class ProductCard(BaseModel):
    """A product card for the website: image, name, price, short info."""

    product_id: str
    name: str
    category: Category
    garment_type: str
    description: str
    colors: list[str] = Field(default_factory=list)
    color_families: list[str] = Field(default_factory=list)  # e.g. ["navy", "white"], for swatches
    price: float
    image_url: str
    total_stock: int = 0


class ChatHistoryMessage(BaseModel):
    """One saved chat_messages row, as the widget reloads it."""

    role: Literal["user", "assistant"]
    content: str
    products: list[ProductCard] = Field(default_factory=list)
    created_at: str


class ChatReply(BaseModel):
    """What POST /api/chat returns to the website."""

    reply: str
    results_title: str | None = None
    products: list[ProductCard] = Field(default_factory=list)
    tools_used: list[str] = Field(default_factory=list)
    # Bundle builder: the bundle the agent presented, with its code-computed total.
    bundle: BundleResult | None = None
    # Sensitive-info shield: what was removed, and the message as it was sent on.
    redactions: list[str] = Field(default_factory=list)
    shielded_message: str | None = None


class AgentResult(BaseModel):
    """What run_agent() hands back to main.py before it becomes a ChatReply."""

    reply: str = ""
    results_title: str | None = None
    products: list[ProductCard] = Field(default_factory=list)
    tools_used: list[str] = Field(default_factory=list)
    bundle: BundleResult | None = None
    error: bool = False  # true when the model/gateway failed; such turns aren't saved
