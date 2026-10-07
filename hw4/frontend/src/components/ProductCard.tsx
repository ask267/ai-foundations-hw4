import { Link } from 'react-router-dom'
import { formatPrice, type ProductSummary } from '../api'
import { LOW_STOCK, SWATCHES } from '../catalog'
import CompareToggle from './CompareToggle'

export default function ProductCard({ product }: { product: ProductSummary }) {
  const soldOut = product.total_stock === 0
  const lowStock = !soldOut && product.total_stock <= LOW_STOCK

  // The compare button sits beside the link (not inside it) so clicking it
  // doesn't open the product page.
  return (
    <div className="product-card-wrap">
    <Link to={`/products/${product.product_id}`} className="product-card">
      <div className="product-card-image">
        <img src={product.image_url} alt={product.name} loading="lazy" />
        {soldOut && <span className="badge badge-muted">Sold out</span>}
        {lowStock && <span className="badge badge-low">Only {product.total_stock} left</span>}
      </div>
      <div className="product-card-body">
        <p className="product-card-type">{product.garment_type}</p>
        <h3>{product.name}</h3>
        <p className="product-card-desc">{product.description}</p>
        <div className="product-card-foot">
          <p className="price">{formatPrice(product.price)}</p>
          {product.color_families && product.color_families.length > 0 && (
            <span className="dots" aria-label={`Colors: ${product.colors.join(', ')}`}>
              {product.color_families.map((f) => (
                <span key={f} className="dot" style={{ background: SWATCHES[f]?.fill }} title={SWATCHES[f]?.label} />
              ))}
            </span>
          )}
        </div>
      </div>
    </Link>
    <CompareToggle product={product} />
    </div>
  )
}
