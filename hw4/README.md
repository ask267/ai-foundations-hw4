# Campus Customs — Yale Bulldog Blue shop + "Ask Dan" chatbot (Homework 4)

A React + Vite + TypeScript storefront for Campus Customs, with a FastAPI backend
and a PydanticAI shopping agent ("Dan"). Dan looks up real prices and stock by
size, searches the catalogue and puts product cards on the page, finds in-stock
alternatives, and builds outfits or gift sets that fit a budget. Logged-in
shoppers' chats are saved, and every agent run is written to an append-only
audit trail.

Full system guide: **[output/harness.md](output/harness.md)**.

## 1. Place the data pack

The database and product images are **not** in this repo. Put the course data
pack in `hw4/data/` so it looks like this:

```
hw4/
└── data/
    ├── campus_customs.db
    └── products/          # the product .jpg images referenced by the catalogue
```

## 2. Add your API key

```bash
cp .env.example .env
```

Then edit `.env` and set `PORTKEY_API_KEY`. The agent uses OpenAI's
`gpt-5.6-luna` through the Portkey gateway. Never commit `.env`.

## 3. Run the back end (terminal 1)

Requires Python 3.11+.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r ../requirements.txt
uvicorn main:app --reload --port 8000
```

- Check that it's running: <http://127.0.0.1:8000/api/health> should return `{"ok": true, ...}`.
- API docs: <http://127.0.0.1:8000/docs>
- After editing `backend/prompts/prompt.md`, restart the backend (the prompt is
  read at startup).

## 4. Run the front end (terminal 2)

Requires Node.js 20.19+ (or 22.12+), which Vite 8 needs.

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Vite forwards `/api` and `/media` requests to the
backend on port 8000, so both must be running.

**Test login:** `test@campuscustoms.yale.edu` / `password` (the seed user from the
data pack). You can also create a new account.

## What's where

```
hw4/
├── AI_prompts.md            prompts used for each problem
├── requirements.txt         backend Python dependencies
├── .env.example             placeholder settings (copy to .env)
├── frontend/                Vite + React + TypeScript site (three.js 3D hero on Home)
├── backend/
│   ├── main.py              FastAPI app: run with  uvicorn main:app --reload --port 8000
│   ├── agent.py             the agent: model, wiring, loop limits, audit hook  ┐
│   ├── tools.py             the agent's 5 database tools                         │ the agent
│   ├── models.py            Pydantic / PydanticAI types                          │ (4 files)
│   ├── prompts/prompt.md    system prompt, incl. safety rules                    ┘
│   ├── auth.py              password hashing + session tokens (used by main.py)
│   ├── safety.py            sensitive-info shield (used by main.py)
│   └── audit.py             append-only audit trail writer (used by agent.py)
└── output/
    ├── harness.md           how the whole system works (start here)
    ├── design.md            design refresh (Problem 10)
    ├── usability.md         usability improvements (Problem 9)
    ├── app_check.html       live-site checks with screenshots (open in a browser)
    ├── app_check_images/    screenshots linked from app_check.html
    └── audit_trail.json     append-only log of agent loop activity
```

## Try these in the chat

- "How much is the Baseball Left Chest Crewneck, and do you have it in XL?"
  (real price and stock, then in-stock XL alternatives)
- "What hoodies do you have?" (27 product cards appear on the page)
- On any product page: "Do you have this in pink?"
- "Hoodie + tee for my dad in L, under $120" (bundle receipt with totals computed in code)
