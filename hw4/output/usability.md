# Usability improvements — Campus Customs (Problem 9)

Four improvements: two on the front end (look and ease of use) and two in the
agent/backend (better, more accurate, safer answers). Each one is visible in the
running app, and the **Try it** line says where to see it.

| # | Area | Improvement | Where you see it |
|---|---|---|---|
| 1 | Front end | Smart catalogue: filter chips, color swatches, "my size" filter, sort, stock badges | **Products** page |
| 2 | Front end | Compare: up to 3 products side by side, with a size-by-size stock grid, "your size" verdict, and winner badges | **+ Compare** on every card → tray → **Compare** page |
| 3 | Agent / backend | `find_alternatives` tool: in-stock alternatives, with reasons, when an item doesn't fit, plus a **You might also like** row | Chat ("…in XL?"), bottom of every product page |
| 4 | Agent / backend | `build_bundle` tool: outfits and gift sets that fit a budget, with totals computed in code and every size really in stock | Chat (🧾 bundle receipt + cards on the page) |

---

## 1. Smart catalogue: filters, swatches, "my size", sort, stock badges (front end)

**What I added**
- **Category chips** (Hoodies, Crewnecks, Tees, Quarter-zips, Jackets,
  Long-sleeve, Sweatshirts) with **live counts**. Each count reflects the other
  active filters, so "Hoodies 8" means 8 hoodies match the color/size/search
  you've already picked. Chips with 0 matches are greyed out, so you never
  click into an empty page.
- **Color swatches.** The catalogue's 22 inconsistent color names ("navy blue",
  "heather charcoal gray", "cream", …) are grouped into 9 color families by the
  backend (`tools.color_family`) and shown as real colored circles.
- **"My size" filter.** Tap XS–XXL to see only products that have your size
  **in stock**. `/api/products` now returns each product's `sizes_in_stock`
  (one `GROUP_CONCAT` in the existing query, so no extra requests).
- **Sort:** Featured (A–Z), Price low→high, Price high→low.
- **Filters live in the URL** (`/products?category=hoodie&color=gray&size=M&sort=price-asc`),
  so a filtered view can be shared, bookmarked, and survives the back button.
- A **sticky, frosted toolbar**, a results bar ("8 of 102 products · Hoodies ·
  Gray · Size M in stock") with **Clear all filters**, and a friendly empty
  state with the bulldog.
- **Product cards** now show **color dots** and an amber **"Only N left"** badge
  when a product has 20 or fewer units (real stock from the database).

**Why it helps.** A shopper can go from 102 items to "gray hoodies in my size,
cheapest first" in three taps instead of scrolling. The size filter answers
"do you have it in my size?" before they fall in love with something that's
sold out in their size. For the business, "Only N left" badges create honest
urgency on low-stock items, and shareable filter links work for social posts
("all our navy crewnecks").

**Try it:** Products page → tap **Hoodies**, the **gray** swatch, **M**, and sort
**Price: low to high**. You get 8 results (checked against the database: same 8
products, $45–$88). Filter to **Tees** + search "left chest" to see an
**ONLY 9 LEFT** badge.

Files: `frontend/src/pages/Products.tsx`, `frontend/src/catalog.ts`,
`frontend/src/components/ProductCard.tsx`, `backend/main.py` (`category`,
`color_families`, `sizes_in_stock` on `/api/products`).

---

## 2. Compare: side-by-side with real stock in every size (front end)

**What I added**
- A **+ Compare** button on every product card: on the Products page, in
  chat results, and in "You might also like". It also appears next to the price
  on each product page. On a card it sits in the image's top-right corner (shown
  on hover, and always on touch screens). It sits *beside* the card link, not
  inside it, so tapping it never opens the product page by accident.
- A floating **compare tray** at the bottom of the screen with thumbnails of
  your picks (up to 3), empty "+" slots, an × on each pick, and a **Compare N**
  button once you have two. Picks are saved in `localStorage`, so they survive
  page changes and reloads. On phones the tray moves left, clear of the chat
  button.
- A **Compare page** (`/compare?ids=a,b,c&size=M`) that lines the products up
  in columns:
  - image, type, and name (each links to the product page)
  - **price**, with a green **Lowest price** badge
  - **colors**, as swatches plus the catalogue's color names, with **Most colors**
  - a **size-by-size stock grid** (XS–XXL): "Sold out" is struck through, and
    5 or fewer left shows in amber
  - **total stock**, with **Most in stock**
  - the full description
  Badges only appear when there's a real winner. If all three cost $58,
  nobody gets "Lowest price".
- A **Your size** picker that highlights that row of the grid and gives a
  plain-English verdict, e.g. "Only Champion Mens Triumph Raglan Crew and
  Champion Reverse Weave Crewneck are in stock in XL."
- An **Ask Dan to help me choose** button that opens the chat and sends
  "Help me choose between A, B and C in size XL. Which would you pick and why?",
  so the agent answers with real stock data.
- The URL holds the picks and the size, so a comparison can be shared ("which
  one should I get?").

**Why it helps.** The hardest moment in shopping is choosing between two or
three similar things. Without this, a shopper flips between product pages
trying to remember which one had their size. The grid answers "which of these
can I actually buy in my size, and which is cheapest?" in one glance. That
matters in this catalogue, where many crewnecks look alike and cost the same
$58, so stock and color are what really separate them. For the business,
shoppers who can decide quickly are less likely to give up.

**Try it:** Products → **Crewnecks** → hover the first three cards and click
**+ Compare** on each → **Compare 3** in the tray → tap **XL**. The XL row
lights up: Baseball Left Chest Crewneck *Sold out*, Champion Mens Triumph Raglan
Crew *2 left*, Champion Reverse Weave Crewneck *12 left*. These match the
`inventory` table exactly. Baseball gets **Most in stock** (70 units).

Files: `frontend/src/compare.tsx` (picks, saved in localStorage),
`frontend/src/components/CompareToggle.tsx`, `frontend/src/components/CompareTray.tsx`,
`frontend/src/pages/Compare.tsx`, `frontend/src/components/ProductCard.tsx`,
`frontend/src/pages/ProductDetail.tsx`, `frontend/src/App.tsx` (`/compare` route).

> The "Ask Dan" quick replies and the "Ask Dan about this" button from my first
> version are still in the app. Compare replaces them as my second front-end
> improvement for this writeup.

---

## 3. `find_alternatives`: in-stock alternatives with reasons (agent tool + product pages)

**What I added**
- A new agent tool, `find_alternatives(product_ref, size?, color?, limit)`
  (`backend/tools.py`), returning a typed `AlternativesResult` (`models.py`). It
  scores every **in-stock** product against the one the shopper wanted:
  - same category: +6
  - shared color families: +2 each
  - price within $10: +2 (within $25: +1)
  - shared themes (bulldog, hockey, a residential college): +2 each. Generic
    tag words like "crewneck" or "Yale" are ignored.
- If a `size` or `color` is given, **every** alternative must actually have that
  size in stock or that color. Each result carries plain-language `why` reasons
  ("Also a crewneck", "Same colors: navy, white", "XL in stock (5 left)") and
  the requested size's real quantity.
- The prompt now says **"Don't stop at 'sold out'"**: when a size or color isn't
  available, say so clearly, then call `find_alternatives` and offer the top
  picks as cards. If nothing fits, say so honestly (e.g. nothing in the shop is
  pink, so it says that instead of inventing a pink item).
- The same engine powers a **"You might also like"** row on every product page
  (`GET /api/products/{id}/similar`), with the top two reasons shown as chips
  under each card.

**Why it helps.** "Sold out in your size" is where a sale usually ends. Now the
agent immediately offers the closest in-stock swaps, and every one really has
the shopper's size. For the business that rescues sales. For the shopper it
saves searching, and the reasons make the suggestions trustworthy rather than
random.

**Try it:** On the Baseball Left Chest Crewneck page, ask "I need an XL though".
Reply: "XL is sold out… District Vit Crewneck Vintage Standing Bulldog — XL, 5
left; Diving Left Chest Crewneck — XL, 5 left; Hype And Vice … Offside Crewneck
— XL, 20 left", with a "View 3 products on the page" link. All three XL
quantities match the database. Scroll to the bottom of any product page for
**You might also like**; the Vintage Bulldog hoodie's top pick is the Sailor
Bulldog hoodie, with the reason "Shares: bulldog".

Files: `backend/tools.py` (`find_alternatives`, `similar_records`,
`color_family`), `backend/models.py` (`Alternative`, `AlternativesResult`),
`backend/agent.py` (tool registered), `backend/prompts/prompt.md`,
`backend/main.py` (`/similar` route), `frontend/src/pages/ProductDetail.tsx`.

---

## 4. Bundle Builder: outfits and gift sets that fit a budget (agent tool)

**What I added**
- A new agent tool, `build_bundle(slots, budget, goal)` (`backend/tools.py`).
  The shopper describes several pieces and a spending limit. The agent turns
  that into one **slot** per piece (`BundleSlot` in `models.py`). Each slot has
  an optional `label` ("for Mom"), `category`, `color`, `keywords` ("hockey",
  "dad"), `size`, and `max_price`.
- The tool does the work in **code, not in the model**:
  1. For each slot, it finds every **in-stock** product that matches. If a size
     is given, the product must have **that size** in stock.
  2. It searches **every combination** of those products, with no duplicates.
     It starts with the most constrained slot and skips any partial bundle that
     can't finish under budget, even with the cheapest remaining pieces. It
     keeps the best-matching bundle that uses the budget well, or the cheapest
     one if `goal="cheapest"`.
  3. It returns a typed `BundleResult`: each item's real price and stock in
     that size, the **total**, the **remaining** budget, `within_budget`, and how
     many combinations fit.
  - If nothing fits, it returns the **cheapest possible** bundle and how far
    over budget it is. If a piece has no in-stock match at all, it says which
    one.
- The prompt says: **never add up prices yourself**. Quote `total` and
  `remaining` from the tool, ask for a missing size, and use family words
  ("mom", "grandpa") as keywords for gifts.
- `/api/chat` now returns a `bundle` field. The chat shows it as a **receipt**
  under Dan's message, with each piece (label, name, size, units left), the
  total, and "$X left in your budget". The receipt is filled in from the tool
  result, not from the model's text. It's only attached when the agent's reply
  presents those same products, so the numbers on screen are computed by code.
  The pieces also appear as product cards on the page (Problem 7), each with
  **+ Compare**.

**Why it helps.** "A hoodie and a tee for my dad, size L, under $120" is a
common way people shop for gifts, game day, and family weekends, but it's hard
to do by hand: filter by size, then add up prices across tabs. Language models
are also bad at this. They add prices wrong and forget size limits. Doing the
math in code makes the answer **accurate** (exact totals, real stock), **fast**
(one tool call instead of several searches; checking 798 combinations takes
about 10 ms), and **cheaper** (fewer model round-trips). For the business it
turns one question into a multi-item sale, and it's honest when the budget
doesn't stretch instead of quietly going over it.

**Try it:** Open the chat and tap the quick reply **Hoodie + tee for my dad in
L, under $120**. The receipt shows Yale Dad Hoodie (L, 20 left) $68.00 + Yale
Dad T Shirt (L, 15 left) $32.00 = **$100.00**, "**$20.00 left in your
budget**". Other tests I ran (all numbers checked against the database):

| Request | Result |
|---|---|
| "a hoodie, a crewneck and a tee all in M for $150" | 798 combos fit; Ua Gameday Double Knit Hood $45 + Baseball Left Chest Crewneck $58 + 2025 Yale Vs Harvard T Shirt $32 = **$135**, $15 left |
| "gifts for my mom and grandpa, a hoodie each, $140. Mom is S, grandpa is XL" | Yale Mom Hoodie (S, 8 left) + Yale Grandpa Hoodie (XL, 2 left) = **$136**, $4 left |
| "game-day outfit in M: a hockey hoodie, a tee, and a quarter-zip, $100" | Honest no: the cheapest possible is **$172, $72 over budget** (the only hockey hoodie in M is $68 and the cheapest quarter-zip in M is $72). The receipt turns red and Dan asks whether to raise the budget or drop a piece. |

Files: `backend/tools.py` (`build_bundle`, `_slot_candidates`, `_parse_keywords`),
`backend/models.py` (`BundleSlot`, `BundleItem`, `BundleResult`,
`ChatReply.bundle`), `backend/agent.py` (tool registered, `_bundle_for`),
`backend/main.py`, `backend/prompts/prompt.md`,
`frontend/src/components/ChatWidget.tsx` (`BundleReceipt`), `frontend/src/api.ts`.

> The sensitive-info shield from my first version (`backend/safety.py`) is still
> running on every chat message. The Bundle Builder replaces it as my second
> agent/backend improvement for this writeup.

---

## Verification summary

| Check | Result |
|---|---|
| `/products?category=hoodie&color=gray&size=M&sort=price-asc` | 8 results, $45→$88. Matches a direct database query. |
| Low-stock badge | "ONLY 9 LEFT" on Football Left Chest T Shirt (9 units in the database) |
| + Compare on cards | Adds to the tray without opening the product; a 4th pick is disabled; picks survive reloads |
| Compare page, size XL | Sold out / 2 left / 12 left. Matches `inventory`. Correct verdict line; ties get no badge |
| Sold-out rescue (XL) | `check_stock` + `find_alternatives`, 3 real XL alternatives, quantities match the database |
| Bundle, within budget | `build_bundle` called; receipt total and remaining match database prices |
| Bundle, over budget | Cheapest possible total ($172) reported honestly; red receipt |
| Frontend build | `tsc` + `vite build` pass. |
