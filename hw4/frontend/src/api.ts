// Thin client for the FastAPI backend (backend/main.py).
// Vite proxies /api and /media to http://127.0.0.1:8000 during development.

export type InventoryItem = {
  size: string
  quantity: number
}

// The fields a product card needs. Both the catalogue API and the chat agent
// return at least these, so the same <ProductCard> renders either.
export type ProductSummary = {
  product_id: string
  name: string
  garment_type: string
  description: string
  colors: string[]
  color_families?: string[] // e.g. ["navy", "white"], used for swatches
  image_url: string
  price: number
  total_stock: number
}

export type Product = ProductSummary & {
  category: string
  search_tags: string[]
  image_file_path: string
  sizes_in_stock?: string[] // catalogue list only
  inventory?: InventoryItem[] // single-product endpoint only
}

// A "You might also like" pick, with the reasons it was chosen.
export type SimilarProduct = ProductSummary & { why: string[] }

// build_bundle result (backend/models.py BundleResult). Totals come from code.
export type BundleItem = {
  label: string | null
  product_id: string
  name: string
  price: number
  size: string | null
  size_quantity: number | null
}

export type Bundle = {
  budget: number
  items: BundleItem[]
  total: number
  remaining: number
  within_budget: boolean
  combinations_checked: number
}

// POST /api/chat response (backend/models.py ChatReply).
export type ChatReply = {
  reply: string
  results_title: string | null
  products: ProductSummary[]
  tools_used: string[]
  bundle: Bundle | null
  redactions: string[] // sensitive-info shield: what was removed from the message
  shielded_message: string | null // the message as it was actually sent on
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export async function fetchProducts(q?: string): Promise<Product[]> {
  const query = q ? `?q=${encodeURIComponent(q)}` : ''
  const data = await request<{ count: number; products: Product[] }>(`/api/products${query}`)
  return data.products
}

export function fetchProduct(productId: string): Promise<Product> {
  return request<Product>(`/api/products/${encodeURIComponent(productId)}`)
}

export function fetchSimilar(productId: string): Promise<SimilarProduct[]> {
  return request<SimilarProduct[]>(`/api/products/${encodeURIComponent(productId)}/similar`)
}

export type ChatTurn = {
  role: 'user' | 'assistant'
  content: string
}

// A saved chat_messages row (GET /api/chat/history).
export type HistoryMessage = ChatTurn & {
  products: ProductSummary[]
  created_at: string
}

const authHeader = (token: string | null): Record<string, string> =>
  token ? { Authorization: `Bearer ${token}` } : {}

// Send a message with the page the shopper is on. Logged-in users send their
// token (the server loads and saves their history); guests send prior turns.
export function sendChat(
  message: string,
  { history, path, token }: { history: ChatTurn[]; path: string; token: string | null },
): Promise<ChatReply> {
  return request<ChatReply>('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify({ message, history: token ? [] : history, page: { path } }),
  })
}

export function fetchChatHistory(token: string): Promise<HistoryMessage[]> {
  return request<HistoryMessage[]>('/api/chat/history', { headers: authHeader(token) })
}

export const formatPrice = (price: number) => `$${price.toFixed(2)}`
