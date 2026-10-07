import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { fetchChatHistory, formatPrice, sendChat, type Bundle, type ProductSummary } from '../api'
import { ASK_DAN_EVENT } from '../askDan'
import { useAuth, type User } from '../auth'
import { useChatResults } from '../chatResults'
import Bulldog from './Bulldog'
import Markdown from './Markdown'

type Message = {
  role: 'user' | 'assistant'
  content: string
  products?: ProductSummary[] // cards this reply put on the page
  title?: string | null
  bundle?: Bundle | null // build_bundle receipt; totals computed by the backend
  shielded?: string[] // sensitive info the shield removed from this (user) message
}

// Page-aware quick replies: one tap sends a question the agent can answer well.
// On a product page, "this" resolves through the page context sent with each message.
const PRODUCT_PAGE_SUGGESTIONS = [
  'What sizes are in stock?',
  'Does this come in other colors?',
  'Show me similar styles',
  'How much is this?',
]
const SHOP_SUGGESTIONS = [
  'What hoodies do you have?',
  'Navy crewnecks under $60',
  'Hoodie + tee for my dad in L, under $120',
  'Anything with a bulldog?',
]

const greetingFor = (user: User | null): Message => ({
  role: 'assistant',
  content: user
    ? `Welcome back, ${user.first_name || user.name}! 🐾 Ask me about hoodies, tees, sizes, anything Bulldog.`
    : "Hey there! I'm Dan, the Campus Customs helper 🐾 Ask me about hoodies, tees, sizes, anything Bulldog.",
})

export default function ChatWidget() {
  const { user, token } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>(() => [greetingFor(user)])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { showResults, clearResults } = useChatResults()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const onDetailPage = useMatch('/products/:productId') !== null

  // Logged in: reload the saved chat from the database. Logged out: start fresh.
  useEffect(() => {
    if (!token) {
      setMessages([greetingFor(null)])
      clearResults()
      return
    }
    let cancelled = false
    setLoadingHistory(true)
    fetchChatHistory(token)
      .then((history) => {
        if (cancelled) return
        setMessages([
          greetingFor(user),
          ...history.map((m) => ({ role: m.role, content: m.content, products: m.products })),
        ])
      })
      .catch(() => {
        if (!cancelled) setMessages([greetingFor(user)])
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false)
      })
    return () => {
      cancelled = true
    }
    // Re-run only when the session changes, not on every user-object render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking, open])

  // Show a reply's cards on the page (results are hidden on detail pages, so
  // jump to Products there). ChatResults scrolls itself into view.
  function viewResults(m: Message) {
    if (!m.products?.length) return
    showResults(m.title ?? null, m.products)
    if (onDetailPage) navigate('/products')
  }

  async function send(raw: string) {
    const text = raw.trim()
    if (!text || thinking || loadingHistory) return

    // Guests' context is the conversation so far; logged-in context is loaded server-side.
    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    setThinking(true)
    try {
      const data = await sendChat(text, { history, path: pathname, token })
      // Contract: the agent's product matches go to the page as cards.
      if (data.products.length > 0) showResults(data.results_title, data.products)
      setMessages((prev) => {
        const next = [...prev]
        // Sensitive-info shield: show the shopper what was actually sent.
        if (data.redactions.length > 0 && data.shielded_message) {
          const last = next.map((m) => m.role).lastIndexOf('user')
          next[last] = { role: 'user', content: data.shielded_message, shielded: data.redactions }
        }
        next.push({
          role: 'assistant',
          content: data.reply,
          products: data.products,
          title: data.results_title,
          bundle: data.bundle,
        })
        return next
      })
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Ruh-roh, I couldn't reach the backend. Is the API running on port 8000?" },
      ])
    } finally {
      setThinking(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    send(input)
  }

  // "Ask Dan about this" (and anything else) can open the chat via askDan().
  const sendRef = useRef(send)
  useEffect(() => {
    sendRef.current = send
  })
  useEffect(() => {
    function onAsk(e: Event) {
      setOpen(true)
      const message = (e as CustomEvent<{ message?: string }>).detail?.message
      if (message) sendRef.current(message)
    }
    window.addEventListener(ASK_DAN_EVENT, onAsk)
    return () => window.removeEventListener(ASK_DAN_EVENT, onAsk)
  }, [])

  const suggestions = onDetailPage ? PRODUCT_PAGE_SUGGESTIONS : SHOP_SUGGESTIONS

  return (
    <div className="chat-widget">
      {open && (
        <section className="chat-panel" aria-label="Campus Customs chat">
          <header className="chat-header">
            <div className="chat-header-title">
              <Bulldog small />
              <div>
                <strong>Ask Dan</strong>
                <span>{user ? `Chatting as ${user.first_name || user.name} · saved` : 'Guest chat · not saved'}</span>
              </div>
            </div>
            <button className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat">
              ×
            </button>
          </header>

          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className="chat-turn">
                <div className={`chat-bubble chat-${m.role}`}>
                  {m.role === 'assistant' ? <Markdown text={m.content} /> : m.content}
                </div>
                {m.bundle && <BundleReceipt bundle={m.bundle} />}
                {m.shielded && (
                  <p className="shield-note" role="status">
                    🛡️ We removed your {m.shielded.join(' and ')} before sending. Never share these in chat.
                  </p>
                )}
                {m.products?.length ? (
                  <button type="button" className="chat-results-link" onClick={() => viewResults(m)}>
                    🐾 View {m.products.length} {m.products.length === 1 ? 'product' : 'products'} on the page ↓
                  </button>
                ) : null}
              </div>
            ))}
            {thinking && (
              <div className="chat-bubble chat-assistant chat-thinking">
                <span />
                <span />
                <span />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {!thinking && !loadingHistory && (
            <div className="quick-replies" aria-label="Suggested questions">
              {suggestions.map((q) => (
                <button key={q} type="button" className="quick-reply" onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <form className="chat-input" onSubmit={handleSubmit}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a product…"
              aria-label="Chat message"
              autoFocus
            />
            <button type="submit" disabled={!input.trim() || thinking || loadingHistory}>
              Send
            </button>
          </form>
        </section>
      )}

      <div className="chat-launcher">
        {!open && (
          <button type="button" className="chat-label" onClick={() => setOpen(true)}>
            {onDetailPage ? 'Questions about this item? Ask Dan' : 'Ask Dan 🐾'}
          </button>
        )}
        <button
          className="chat-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close chat' : 'Open chat'}
        >
          {open ? '×' : '💬'}
        </button>
      </div>
    </div>
  )
}

// The bundle as a receipt: every line and the total come straight from the
// build_bundle tool's result, not from the model's text.
function BundleReceipt({ bundle }: { bundle: Bundle }) {
  const over = !bundle.within_budget
  return (
    <div className={`bundle-receipt${over ? ' is-over' : ''}`}>
      <p className="bundle-receipt-head">
        <span>🧾 Bundle</span>
        <span>Budget {formatPrice(bundle.budget)}</span>
      </p>
      <ul>
        {bundle.items.map((item) => (
          <li key={item.product_id}>
            <Link to={`/products/${item.product_id}`}>
              {item.label && <em>{item.label}</em>}
              {item.name}
              {item.size && (
                <small>
                  {' '}
                  · {item.size} ({item.size_quantity} left)
                </small>
              )}
            </Link>
            <span>{formatPrice(item.price)}</span>
          </li>
        ))}
      </ul>
      <p className="bundle-receipt-total">
        <span>Total</span>
        <strong>{formatPrice(bundle.total)}</strong>
      </p>
      <p className="bundle-receipt-left">
        {over
          ? `${formatPrice(-bundle.remaining)} over budget (cheapest possible)`
          : `${formatPrice(bundle.remaining)} left in your budget`}
        {!over && (
          <small>
            {' '}
            · best of {bundle.combinations_checked.toLocaleString()}{' '}
            {bundle.combinations_checked === 1 ? 'combo that fits' : 'combos that fit'}
          </small>
        )}
      </p>
    </div>
  )
}
