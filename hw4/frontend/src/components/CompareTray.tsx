import { Link, useMatch } from 'react-router-dom'
import { MAX_COMPARE, useCompare } from '../compare'

// Floating tray (bottom left, clear of the chat) with the items picked to compare.
export default function CompareTray() {
  const { picks, remove, clear } = useCompare()
  const onComparePage = useMatch('/compare') !== null
  if (picks.length === 0 || onComparePage) return null

  const ids = picks.map((p) => p.product_id).join(',')
  return (
    <aside className="compare-tray" aria-label="Items to compare">
      <div className="compare-tray-slots">
        {Array.from({ length: MAX_COMPARE }, (_, i) => picks[i]).map((p, i) =>
          p ? (
            <div key={p.product_id} className="compare-tray-slot" title={p.name}>
              <img src={p.image_url} alt={p.name} />
              <button type="button" onClick={() => remove(p.product_id)} aria-label={`Remove ${p.name}`}>
                ×
              </button>
            </div>
          ) : (
            <div key={`empty-${i}`} className="compare-tray-slot is-empty">
              +
            </div>
          ),
        )}
      </div>
      <div className="compare-tray-actions">
        {picks.length < 2 ? (
          <span className="compare-tray-hint">Pick one more to compare</span>
        ) : (
          <Link to={`/compare?ids=${ids}`} className="btn btn-primary">
            Compare {picks.length}
          </Link>
        )}
        <button type="button" className="compare-tray-clear" onClick={clear}>
          Clear
        </button>
      </div>
    </aside>
  )
}
