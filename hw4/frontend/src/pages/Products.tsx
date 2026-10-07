import { Fragment, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchProducts, type Product } from '../api'
import { askDan } from '../askDan'
import { CATEGORIES, SIZES, SWATCHES } from '../catalog'
import Bulldog from '../components/Bulldog'
import ProductCard from '../components/ProductCard'
import Reveal from '../components/Reveal'

type Sort = 'featured' | 'price-asc' | 'price-desc'

// Where the "Ask Dan" tile sits in the grid (after this many products).
const DAN_TILE_AFTER = 8

const SORTS: { id: Sort; label: string }[] = [
  { id: 'featured', label: 'Featured (A–Z)' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
]

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [dense, setDense] = useState(false) // 4-up (default) or 5-up grid
  // Filters live in the URL (?category=hoodie&color=navy&size=M&sort=price-asc&q=...)
  // so a filtered view can be shared, bookmarked, and survives the back button.
  const [params, setParams] = useSearchParams()
  const category = params.get('category') ?? ''
  const color = params.get('color') ?? ''
  const size = params.get('size') ?? ''
  const sort = (params.get('sort') as Sort) || 'featured'
  const search = params.get('q') ?? ''

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  // Everything except category, so each category chip can show its live count.
  const filteredExceptCategory = useMemo(() => {
    const needle = search.toLowerCase().trim()
    return products.filter(
      (p) =>
        (!color || p.color_families?.includes(color)) &&
        (!size || p.sizes_in_stock?.includes(size)) &&
        (!needle ||
          [p.name, p.garment_type, p.description, ...p.colors, ...p.search_tags]
            .join(' ')
            .toLowerCase()
            .includes(needle)),
    )
  }, [products, color, size, search])

  const visible = useMemo(() => {
    const list = filteredExceptCategory.filter((p) => !category || p.category === category)
    if (sort === 'price-asc') return [...list].sort((a, b) => a.price - b.price || a.name.localeCompare(b.name))
    if (sort === 'price-desc') return [...list].sort((a, b) => b.price - a.price || a.name.localeCompare(b.name))
    return list
  }, [filteredExceptCategory, category, sort])

  const countFor = (id: string) => filteredExceptCategory.filter((p) => p.category === id).length
  const colorsInCatalogue = useMemo(
    () => Object.keys(SWATCHES).filter((f) => products.some((p) => p.color_families?.includes(f))),
    [products],
  )
  // Each active filter as a removable pill.
  const pills = [
    category && { key: 'category', label: CATEGORIES.find((c) => c.id === category)?.label },
    color && { key: 'color', label: SWATCHES[color]?.label },
    size && { key: 'size', label: `Size ${size} in stock` },
    search && { key: 'q', label: `"${search}"` },
  ].filter(Boolean) as { key: string; label: string }[]
  const panelCount = (color ? 1 : 0) + (size ? 1 : 0)
  const clearAll = () => setParams({}, { replace: true })

  return (
    <section className="section shop">
      <header className="shop-hero">
        <div>
          <p className="eyebrow">Officially licensed · The whole pack</p>
          <h1>
            The Closet<sup className="mono">({products.length || '…'})</sup>
          </h1>
        </div>
        <div className="shop-hero-side">
          <p className="lead">Yale hoodies, crews, tees and quarter-zips. Filter by style, color, and what's in stock in your size.</p>
          <label className="shop-search">
            <input
              type="search"
              placeholder="Search hockey, bulldog, Davenport…"
              value={search}
              onChange={(e) => setParam('q', e.target.value)}
              aria-label="Search products"
            />
            <span aria-hidden="true">⌕</span>
          </label>
        </div>
      </header>

      <div className="shop-bar">
        <nav className="shop-tabs" aria-label="Category">
          <button className={`shop-tab${!category ? ' active' : ''}`} onClick={() => setParam('category', '')}>
            All<sup>{filteredExceptCategory.length}</sup>
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`shop-tab${category === c.id ? ' active' : ''}`}
              onClick={() => setParam('category', category === c.id ? '' : c.id)}
              disabled={countFor(c.id) === 0 && category !== c.id}
            >
              {c.label}
              <sup>{countFor(c.id)}</sup>
            </button>
          ))}
        </nav>

        <div className="shop-controls">
          <button
            type="button"
            className={`shop-filter-btn${panelOpen ? ' open' : ''}`}
            onClick={() => setPanelOpen((o) => !o)}
            aria-expanded={panelOpen}
            aria-controls="shop-panel"
          >
            Filters{panelCount > 0 && <span className="nav-count">{panelCount}</span>}
            <i aria-hidden="true">{panelOpen ? '−' : '+'}</i>
          </button>
          <label className="shop-sort">
            <span className="mono">Sort</span>
            <select value={sort} onChange={(e) => setParam('sort', e.target.value === 'featured' ? '' : e.target.value)}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="shop-density" role="group" aria-label="Grid size">
            <button type="button" className={!dense ? 'active' : ''} onClick={() => setDense(false)} aria-label="Large grid">
              <span className="density-icon" data-n="4" />
            </button>
            <button type="button" className={dense ? 'active' : ''} onClick={() => setDense(true)} aria-label="Small grid">
              <span className="density-icon" data-n="9" />
            </button>
          </div>
        </div>

        <div id="shop-panel" className={`shop-panel${panelOpen ? ' open' : ''}`}>
          <div className="shop-panel-inner">
            <div className="panel-group" role="group" aria-label="Color">
              <p className="panel-label mono">Color</p>
              <div className="panel-swatches">
                {colorsInCatalogue.map((f) => (
                  <button
                    key={f}
                    className={`swatch-option${color === f ? ' active' : ''}`}
                    onClick={() => setParam('color', color === f ? '' : f)}
                    aria-pressed={color === f}
                  >
                    <span className="swatch" style={{ background: SWATCHES[f].fill }} />
                    {SWATCHES[f].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="panel-group" role="group" aria-label="In stock in my size">
              <p className="panel-label mono">In stock in my size</p>
              <div className="panel-sizes">
                {SIZES.map((z) => (
                  <button
                    key={z}
                    className={`size-tile${size === z ? ' active' : ''}`}
                    onClick={() => setParam('size', size === z ? '' : z)}
                    aria-pressed={size === z}
                  >
                    {z}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading && <p className="status">Fetching the goods…</p>}
      {error && <p className="status error">Couldn't load products ({error}). Is the backend running?</p>}
      {!loading && !error && (
        <div className="results-bar">
          <p className="mono results-count">
            Showing <strong>{visible.length}</strong> of {products.length}
          </p>
          {pills.length > 0 && (
            <div className="filter-pills">
              {pills.map((f) => (
                <button key={f.key} type="button" className="filter-pill" onClick={() => setParam(f.key, '')}>
                  {f.label} <span aria-hidden="true">×</span>
                  <span className="sr-only">Remove filter</span>
                </button>
              ))}
              <button type="button" className="link-button" onClick={clearAll}>
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

      {!loading && !error && visible.length === 0 ? (
        <div className="empty-state">
          <Bulldog small />
          <h3>No matches in the kennel</h3>
          <p>Try another color or size, or ask Dan in the chat for something similar.</p>
          <button className="btn btn-primary" onClick={clearAll}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className={`product-grid shop-grid${dense ? ' dense' : ''}`}>
          {visible.map((p, i) => (
            <Fragment key={p.product_id}>
              {i === DAN_TILE_AFTER && (
                <Reveal className="dan-tile">
                  <p className="eyebrow">Can't decide?</p>
                  <h3>Ask Dan for your size, a swap, or a whole outfit under budget.</h3>
                  <button type="button" className="btn btn-primary" onClick={() => askDan()}>
                    Chat with Dan
                  </button>
                </Reveal>
              )}
              <Reveal delay={(i % 4) * 60}>
                <ProductCard product={p} />
              </Reveal>
            </Fragment>
          ))}
        </div>
      )}
    </section>
  )
}
