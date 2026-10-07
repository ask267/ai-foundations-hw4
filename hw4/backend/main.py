"""Campus Customs API.

Serves the product catalogue and product images from data/campus_customs.db.
This will grow into the agent backend in Problem 5 (see the /api/chat stub).

Run from hw4/:   backend/.venv/bin/python -m uvicorn main:app --app-dir backend --port 8000
Open API docs:   http://127.0.0.1:8000/docs
Frontend (Vite): http://127.0.0.1:5173
"""

from __future__ import annotations

import json
import re
import sqlite3
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr, Field

from agent import run_agent
from auth import hash_password, issue_token, read_token, verify_password
from models import ChatHistoryMessage, ChatReply, Customer, PageContext, ProductCard, ShopDeps
from safety import shield
from tools import category_of, color_family, similar_cards

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "campus_customs.db"

app = FastAPI(title="Campus Customs API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

if not DB_PATH.exists():
    raise RuntimeError(
        f"Data pack not found: expected {DB_PATH} and {DATA_DIR / 'products'}/. "
        "Put campus_customs.db and the products/ images in hw4/data/ (see README.md)."
    )

# Product photos: data/products/<file>.jpg -> /media/products/<file>.jpg
app.mount("/media", StaticFiles(directory=DATA_DIR), name="media")


# ---------- database helpers ----------

def connect() -> sqlite3.Connection:
    """Open the shop database read-only (product reads never modify anything)."""
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def connect_rw() -> sqlite3.Connection:
    """Open the shop database read-write (used for account creation)."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


SIZE_ORDER = {"XS": 0, "S": 1, "M": 2, "L": 3, "XL": 4, "XXL": 5}


def product_from_row(row: sqlite3.Row) -> dict:
    """Turn a catalogue row into JSON-friendly product data."""
    product = dict(row)
    product["colors"] = json.loads(product["colors"])
    product["search_tags"] = json.loads(product["search_tags"])
    product["image_url"] = f"/media/{product['image_file_path']}"
    product["category"] = category_of(product["garment_type"])
    product["color_families"] = sorted({f for c in product["colors"] if (f := color_family(c))})
    return product


def load_inventory(conn: sqlite3.Connection, product_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT size, quantity FROM inventory WHERE product_id = ?", (product_id,)
    ).fetchall()
    inventory = [dict(r) for r in rows]
    inventory.sort(key=lambda item: SIZE_ORDER.get(item["size"], 99))
    return inventory


# ---------- routes ----------

@app.get("/api/health")
def health():
    return {"ok": True, "database": DB_PATH.name, "exists": DB_PATH.exists()}


@app.get("/api/products")
def list_products(q: str | None = Query(default=None, description="Text search")):
    """All products with total stock, optionally filtered by a search string."""
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT c.*, COALESCE(SUM(i.quantity), 0) AS total_stock,
                   GROUP_CONCAT(CASE WHEN i.quantity > 0 THEN i.size END) AS sizes_in_stock
            FROM catalogue c
            LEFT JOIN inventory i ON i.product_id = c.product_id
            GROUP BY c.product_id
            ORDER BY c.name
            """
        ).fetchall()
    products = [product_from_row(r) for r in rows]
    for p in products:
        sizes = (p["sizes_in_stock"] or "").split(",")
        p["sizes_in_stock"] = sorted(filter(None, sizes), key=lambda z: SIZE_ORDER.get(z, 99))

    if q:
        needle = q.lower().strip()
        products = [
            p
            for p in products
            if needle in " ".join(
                [p["name"], p["garment_type"], p["description"], *p["colors"], *p["search_tags"]]
            ).lower()
        ]
    return {"count": len(products), "products": products}


@app.get("/api/products/{product_id}")
def get_product(product_id: str):
    """One product with its per-size inventory for the single-item page."""
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM catalogue WHERE product_id = ?", (product_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Product not found")
        product = product_from_row(row)
        product["inventory"] = load_inventory(conn, product_id)
    product["total_stock"] = sum(item["quantity"] for item in product["inventory"])
    return product


# ---------- auth ----------

class PublicUser(BaseModel):
    """User info that is safe to return to the client (never the password hash)."""

    id: int
    first_name: str | None = None
    last_name: str | None = None
    name: str
    email: str


class SignupRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


def public_user(row: sqlite3.Row) -> PublicUser:
    return PublicUser(
        id=row["id"],
        first_name=row["first_name"],
        last_name=row["last_name"],
        name=row["name"],
        email=row["email"],
    )


class SessionResponse(BaseModel):
    """Login/signup result: the safe user fields plus a signed session token."""

    user: PublicUser
    token: str


def customer_from_auth(authorization: str | None) -> Customer | None:
    """The logged-in customer for an `Authorization: Bearer <token>` header, else None.

    Only the signed token is trusted; the user id inside it can't be forged.
    """
    token = (authorization or "").removeprefix("Bearer ").strip()
    user_id = read_token(token)
    if user_id is None:
        return None
    with connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        return None
    return Customer(**public_user(row).model_dump())


def require_customer(authorization: str | None) -> Customer:
    customer = customer_from_auth(authorization)
    if customer is None:
        raise HTTPException(status_code=401, detail="Please log in.")
    return customer


@app.post("/api/signup", response_model=SessionResponse, status_code=201)
def signup(body: SignupRequest):
    """Create a new account and store it in the users table with a hashed password."""
    email = body.email.strip().lower()
    full_name = f"{body.first_name.strip()} {body.last_name.strip()}"
    password_hash = hash_password(body.password)

    with connect_rw() as conn:
        existing = conn.execute(
            "SELECT id FROM users WHERE email = ?", (email,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="An account with that email already exists.")

        cursor = conn.execute(
            """
            INSERT INTO users (name, email, password_hash, first_name, last_name)
            VALUES (?, ?, ?, ?, ?)
            """,
            (full_name, email, password_hash, body.first_name.strip(), body.last_name.strip()),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return SessionResponse(user=public_user(row), token=issue_token(row["id"]))


@app.post("/api/login", response_model=SessionResponse)
def login(body: LoginRequest):
    """Check email + password against the users table."""
    email = body.email.strip().lower()
    with connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

    # Same error whether the email is unknown or the password is wrong, so an
    # attacker can't tell which emails have accounts.
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    return SessionResponse(user=public_user(row), token=issue_token(row["id"]))


@app.get("/api/me", response_model=PublicUser)
def me(authorization: str | None = Header(default=None)):
    """Who the session token belongs to (the site checks this on load)."""
    return PublicUser(**require_customer(authorization).model_dump())


# ---------- chat ----------

HISTORY_LIMIT = 50  # messages reloaded into the widget
CONTEXT_TURNS = 12  # prior messages the agent sees (same cap as agent.py)


class ChatTurn(BaseModel):
    role: str
    content: str


class PageInfo(BaseModel):
    path: str = "/"


@app.get("/api/products/{product_id}/similar")
def get_similar(product_id: str, limit: int = Query(default=4, ge=1, le=8)):
    """In-stock alternatives for a product page's "You might also like" row."""
    return [{**card.model_dump(), "why": why} for card, why in similar_cards(product_id, limit)]


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    # Guests only: prior turns from the widget. Logged-in users' context comes
    # from the database instead.
    history: list[ChatTurn] = Field(default_factory=list)
    page: PageInfo = Field(default_factory=PageInfo)


PAGE_TYPES = {
    "/": "home",
    "/products": "products",
    "/about": "about",
    "/login": "login",
    "/create-account": "create-account",
}


def page_context(path: str) -> PageContext:
    """Turn the browser's path into a PageContext, trusting only what the DB confirms."""
    clean = re.sub(r"[^A-Za-z0-9/_-]", "", path or "/")[:120] or "/"
    match = re.fullmatch(r"/products/([A-Za-z0-9_-]+)/?", clean)
    if match:
        with connect() as conn:
            row = conn.execute(
                "SELECT product_id, name FROM catalogue WHERE product_id = ?", (match.group(1),)
            ).fetchone()
        if row:
            return PageContext(
                page_type="product", path=clean, product_id=row["product_id"], product_name=row["name"]
            )
    return PageContext(page_type=PAGE_TYPES.get(clean.rstrip("/") or "/", "other"), path=clean)


def history_card(item: dict) -> ProductCard:
    """Saved products_json entries -> ProductCard (seeded rows predate `category`)."""
    colors = item.get("colors") or []
    return ProductCard.model_validate(
        {
            **item,
            "category": item.get("category") or category_of(item.get("garment_type", "")),
            "color_families": item.get("color_families")
            or sorted({f for c in colors if (f := color_family(c))}),
        }
    )


def load_history(user_id: int, limit: int) -> list[ChatHistoryMessage]:
    """The user's most recent `limit` chat messages, oldest first."""
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT role, content, products_json, created_at FROM chat_messages
            WHERE user_id = ? ORDER BY id DESC LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()
    messages = []
    for row in reversed(rows):
        products = [history_card(p) for p in json.loads(row["products_json"] or "[]")]
        messages.append(
            ChatHistoryMessage(
                role=row["role"], content=row["content"], products=products, created_at=row["created_at"]
            )
        )
    return messages


def save_turn(user_id: int, message: str, reply: str, products: list[ProductCard]) -> None:
    """Store the shopper's message and the agent's reply in chat_messages."""
    products_json = json.dumps([p.model_dump() for p in products]) if products else None
    with connect_rw() as conn:
        conn.executemany(
            "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, ?, ?, ?)",
            [(user_id, "user", message, None), (user_id, "assistant", reply, products_json)],
        )
        conn.commit()


@app.get("/api/chat/history", response_model=list[ChatHistoryMessage])
def chat_history(authorization: str | None = Header(default=None)):
    """The logged-in user's saved chat, so the widget can reload it."""
    customer = require_customer(authorization)
    return load_history(customer.id, HISTORY_LIMIT)


@app.post("/api/chat", response_model=ChatReply)
def chat(body: ChatRequest, authorization: str | None = Header(default=None)):
    """Send the shopper's message to the Campus Customs agent and return its reply.

    Contract: the agent returns structured product matches (product_ids), and the
    response carries them as ProductCards that the website renders on the page.
    Logged-in users: context comes from their saved history and the turn is saved.
    Guests: context comes from the widget and nothing is saved.
    """
    # Sensitive-info shield: strip card numbers, SSNs, and passwords before the
    # message reaches the model or the database.
    message, redactions = shield(body.message)

    customer = customer_from_auth(authorization)
    if customer:
        history = [
            {"role": m.role, "content": m.content} for m in load_history(customer.id, CONTEXT_TURNS)
        ]
    else:
        history = [{"role": t.role, "content": shield(t.content)[0]} for t in body.history]

    deps = ShopDeps(customer=customer, page=page_context(body.page.path), redactions=redactions)
    result = run_agent(message, history, deps)

    if customer and not result.error:
        save_turn(customer.id, message, result.reply, result.products)

    return ChatReply(
        reply=result.reply,
        results_title=result.results_title,
        products=result.products,
        tools_used=result.tools_used,
        bundle=result.bundle,
        redactions=redactions,
        shielded_message=message if redactions else None,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
