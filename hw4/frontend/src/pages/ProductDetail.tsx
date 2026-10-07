import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchProduct, fetchSimilar, formatPrice, type Product, type SimilarProduct } from '../api'
import { askDan } from '../askDan'
import CompareToggle from '../components/CompareToggle'
import ProductCard from '../components/ProductCard'

export default function ProductDetail() {
  const { productId = '' } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [similar, setSimilar] = useState<SimilarProduct[]>([])

  useEffect(() => {
    setProduct(null)
    setError(null)
    setSelectedSize(null)
    setSimilar([])
    fetchProduct(productId)
      .then(setProduct)
      .catch((err: Error) => setError(err.message))
    fetchSimilar(productId)
      .then(setSimilar)
      .catch(() => setSimilar([]))
  }, [productId])

  if (error) {
    return (
      <section className="section">
        <p className="status error">We couldn't find that product ({error}).</p>
        <Link to="/products" className="link">
          ← Back to products
        </Link>
      </section>
    )
  }

  if (!product) {
    return <p className="status section">Sniffing out that product…</p>
  }

  const inventory = product.inventory ?? []
  const selected = inventory.find((i) => i.size === selectedSize)

  return (
    <section className="section">
      <Link to="/products" className="link">
        ← Back to products
      </Link>

      <div className="detail">
        <div className="detail-image">
          <img src={product.image_url} alt={product.name} />
        </div>

        <div className="detail-info">
          <p className="eyebrow">{product.garment_type}</p>
          <h1>{product.name}</h1>
          <div className="detail-price-row">
            <p className="detail-price">{formatPrice(product.price)}</p>
            <CompareToggle product={product} variant="inline" />
          </div>
          <p className="detail-desc">{product.description}</p>

          <div className="detail-block">
            <h3>Colors</h3>
            <div className="chips">
              {product.colors.map((c) => (
                <span key={c} className="chip">
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className="detail-block">
            <h3>Size &amp; stock</h3>
            {inventory.length === 0 ? (
              <p className="status">No size info yet.</p>
            ) : (
              <div className="sizes">
                {inventory.map((i) => (
                  <button
                    key={i.size}
                    className={`size${i.quantity === 0 ? ' size-out' : ''}${selectedSize === i.size ? ' size-selected' : ''}`}
                    disabled={i.quantity === 0}
                    onClick={() => setSelectedSize(i.size)}
                    title={i.quantity === 0 ? 'Sold out' : `${i.quantity} in stock`}
                  >
                    <strong>{i.size}</strong>
                    <span>{i.quantity === 0 ? 'Sold out' : `${i.quantity} left`}</span>
                  </button>
                ))}
              </div>
            )}
            <p className="status">
              {selected
                ? `Size ${selected.size}: ${selected.quantity} in stock`
                : `${product.total_stock} total in stock across all sizes`}
            </p>
          </div>

          <div className="ask-dan-card">
            <div>
              <strong>Not sure about fit, color, or your size?</strong>
              <span>Dan knows this item's real stock and can find a swap if it doesn't fit.</span>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => askDan()}>
              🐾 Ask Dan about this
            </button>
          </div>

          <div className="detail-block">
            <h3>Tags</h3>
            <div className="chips">
              {product.search_tags.map((t) => (
                <span key={t} className="chip chip-muted">
                  #{t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {similar.length > 0 && (
        <div className="similar">
          <div className="section-head">
            <div>
              <p className="eyebrow">In stock now</p>
              <h2>You might also like</h2>
            </div>
          </div>
          <div className="product-grid">
            {similar.map((p) => (
              <div key={p.product_id} className="similar-item">
                <ProductCard product={p} />
                <div className="why">
                  {p.why.slice(0, 2).map((w) => (
                    <span key={w} className="chip chip-muted">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
