import type { ProductSummary } from '../api'
import { MAX_COMPARE, useCompare } from '../compare'

// "+ Compare" on a product card or product page. Disabled once the tray is full.
export default function CompareToggle({
  product,
  variant = 'card',
}: {
  product: Pick<ProductSummary, 'product_id' | 'name' | 'image_url'>
  variant?: 'card' | 'inline'
}) {
  const { isPicked, toggle, full } = useCompare()
  const picked = isPicked(product.product_id)
  const disabled = !picked && full

  return (
    <button
      type="button"
      className={`compare-toggle compare-toggle-${variant}${picked ? ' is-picked' : ''}`}
      aria-pressed={picked}
      disabled={disabled}
      title={disabled ? `You can compare up to ${MAX_COMPARE} items` : undefined}
      onClick={() => toggle(product)}
    >
      {picked ? '✓ Comparing' : '+ Compare'}
    </button>
  )
}
