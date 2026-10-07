import { useEffect, useRef } from 'react'
import { useChatResults } from '../chatResults'
import ProductCard from './ProductCard'

export const CHAT_RESULTS_ID = 'chat-results'

// The chat agent's product matches, rendered on the page with the same cards as
// the Products page, so each one opens its detail page.
export default function ChatResults() {
  const { results, clearResults } = useChatResults()
  const ref = useRef<HTMLElement>(null)
  const version = results?.version

  // Bring each new set of results into view.
  useEffect(() => {
    if (version) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [version])

  if (!results) return null

  const count = results.products.length
  return (
    <section id={CHAT_RESULTS_ID} ref={ref} className="chat-results" aria-live="polite">
      <div className="section-head">
        <div>
          <p className="eyebrow">From your chat with Dan</p>
          <h2>{results.title}</h2>
          <p className="status">
            {count} {count === 1 ? 'product' : 'products'}
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={clearResults}>
          Clear
        </button>
      </div>
      <div className="product-grid">
        {results.products.map((p) => (
          <ProductCard key={p.product_id} product={p} />
        ))}
      </div>
    </section>
  )
}
