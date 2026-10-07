import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchProduct, formatPrice, type Product } from '../api'
import { askDan } from '../askDan'
import { SIZES, SWATCHES } from '../catalog'
import { MAX_COMPARE, useCompare } from '../compare'
import Bulldog from '../components/Bulldog'

const qtyIn = (p: Product, size: string) => p.inventory?.find((i) => i.size === size)?.quantity ?? 0

// Ids of the products that hold the best value, or none when it's a tie for everyone.
function winners(products: Product[], score: (p: Product) => number): Set<string> {
  const best = Math.max(...products.map(score))
  const top = products.filter((p) => score(p) === best)
  return new Set(top.length === products.length ? [] : top.map((p) => p.product_id))
}

export default function Compare() {
  const [params, setParams] = useSearchParams()
  const { picks, remove } = useCompare()
  // The URL is the source of truth (so a comparison can be shared); fall back to the tray.
  const ids = (params.get('ids') ?? picks.map((p) => p.product_id).join(','))
    .split(',')
    .filter(Boolean)
    .slice(0, MAX_COMPARE)
  const idKey = ids.join(',')
  const size = params.get('size') ?? ''

  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!idKey) {
      setProducts([])
      return
    }
    setProducts(null)
    Promise.all(idKey.split(',').map(fetchProduct))
      .then(setProducts)
      .catch((err: Error) => setError(err.message))
  }, [idKey])

  function setSize(next: string) {
    const p = new URLSearchParams(params)
    if (next && next !== size) p.set('size', next)
    else p.delete('size')
    setParams(p, { replace: true })
  }

  function drop(id: string) {
    remove(id)
    const p = new URLSearchParams(params)
    p.set('ids', ids.filter((x) => x !== id).join(','))
    setParams(p, { replace: true })
  }

  if (error) return <p className="status error section">Couldn't load those products ({error}).</p>
  if (!products) return <p className="status section">Lining them up side by side…</p>

  if (products.length < 2) {
    return (
      <section className="section">
        <div className="empty-state">
          <Bulldog />
          <h2>Pick at least two items to compare</h2>
          <p>Tap “+ Compare” on any product card. Your picks wait in the tray at the bottom of the page.</p>
          <Link to="/products" className="btn btn-primary">
            Browse products
          </Link>
        </div>
      </section>
    )
  }

  const cheapest = winners(products, (p) => -p.price)
  const mostStock = winners(products, (p) => p.total_stock)
  const mostColors = winners(products, (p) => p.colors.length)
  const hasSize = size ? products.filter((p) => qtyIn(p, size) > 0) : []
  const names = products.map((p) => p.name)
  const askQuestion =
    `Help me choose between ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` +
    (size ? ` in size ${size}` : '') +
    '. Which would you pick and why?'

  const cols = { gridTemplateColumns: `minmax(110px, 0.7fr) repeat(${products.length}, minmax(180px, 1fr))` }
  const row = (label: ReactNode, cell: (p: Product) => ReactNode, className = '') => (
    <div className={`compare-row ${className}`} style={cols}>
      <div className="compare-label">{label}</div>
      {products.map((p) => (
        <div key={p.product_id} className="compare-cell">
          {cell(p)}
        </div>
      ))}
    </div>
  )

  return (
    <section className="section compare-page">
      <div className="section-head">
        <div>
          <p className="eyebrow">Side by side</p>
          <h1>Compare</h1>
          <p className="status">Price, colors, and real stock in every size, straight from the shop.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => askDan(askQuestion)}>
          🐾 Ask Dan to help me choose
        </button>
      </div>

      <div className="compare-size-picker">
        <span>Your size</span>
        {SIZES.map((s) => (
          <button
            key={s}
            type="button"
            className={`size-pill${size === s ? ' is-active' : ''}`}
            aria-pressed={size === s}
            onClick={() => setSize(s)}
          >
            {s}
          </button>
        ))}
        {size && (
          <p className="compare-verdict" role="status">
            {hasSize.length === 0
              ? `None of these are in stock in ${size}.`
              : hasSize.length === products.length
                ? `All ${products.length} are in stock in ${size}.`
                : `Only ${hasSize.map((p) => p.name).join(' and ')} ${hasSize.length === 1 ? 'is' : 'are'} in stock in ${size}.`}
          </p>
        )}
      </div>

      <div className="compare-table" role="table" aria-label="Product comparison">
        {row(
          '',
          (p) => (
            <div className="compare-product">
              <button type="button" className="compare-remove" onClick={() => drop(p.product_id)} aria-label={`Remove ${p.name}`}>
                ×
              </button>
              <Link to={`/products/${p.product_id}`} className="compare-image">
                <img src={p.image_url} alt={p.name} />
              </Link>
              <p className="product-card-type">{p.garment_type}</p>
              <Link to={`/products/${p.product_id}`} className="compare-name">
                {p.name}
              </Link>
            </div>
          ),
          'compare-head',
        )}
        {row('Price', (p) => (
          <>
            <span className="price">{formatPrice(p.price)}</span>
            {cheapest.has(p.product_id) && <span className="win">Lowest price</span>}
          </>
        ))}
        {row('Colors', (p) => (
          <>
            <span className="dots">
              {(p.color_families ?? []).map((f) => (
                <span key={f} className="dot" style={{ background: SWATCHES[f]?.fill }} title={SWATCHES[f]?.label} />
              ))}
            </span>
            <span className="compare-desc">{p.colors.join(', ')}</span>
            {mostColors.has(p.product_id) && <span className="win">Most colors</span>}
          </>
        ))}
        {SIZES.map((s) =>
          row(
            s,
            (p) => {
              const q = qtyIn(p, s)
              return (
                <span className={`stock-cell${q === 0 ? ' is-out' : q <= 5 ? ' is-low' : ''}`}>
                  {q === 0 ? 'Sold out' : `${q} left`}
                </span>
              )
            },
            `compare-size-row${size === s ? ' is-highlight' : ''}`,
          ),
        )}
        {row('Total stock', (p) => (
          <>
            <strong>{p.total_stock}</strong>
            {mostStock.has(p.product_id) && <span className="win">Most in stock</span>}
          </>
        ))}
        {row('About', (p) => <p className="compare-desc">{p.description}</p>)}
      </div>
    </section>
  )
}
