// Products the shopper picked to compare side by side. Kept in localStorage so
// the picks survive page changes and reloads.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { ProductSummary } from './api'

export const MAX_COMPARE = 3
const STORAGE_KEY = 'campus-customs:compare'

// Just what the tray needs to draw a thumbnail; the Compare page fetches the rest.
export type ComparePick = Pick<ProductSummary, 'product_id' | 'name' | 'image_url'>

type CompareValue = {
  picks: ComparePick[]
  isPicked: (id: string) => boolean
  toggle: (product: ComparePick) => void
  remove: (id: string) => void
  clear: () => void
  full: boolean
}

const CompareContext = createContext<CompareValue | null>(null)

function loadPicks(): ComparePick[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(saved) ? saved.slice(0, MAX_COMPARE) : []
  } catch {
    return []
  }
}

export function CompareProvider({ children }: { children: ReactNode }) {
  const [picks, setPicks] = useState<ComparePick[]>(loadPicks)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(picks))
  }, [picks])

  const value: CompareValue = {
    picks,
    full: picks.length >= MAX_COMPARE,
    isPicked: (id) => picks.some((p) => p.product_id === id),
    toggle({ product_id, name, image_url }) {
      setPicks((prev) =>
        prev.some((p) => p.product_id === product_id)
          ? prev.filter((p) => p.product_id !== product_id)
          : prev.length >= MAX_COMPARE
            ? prev
            : [...prev, { product_id, name, image_url }],
      )
    },
    remove: (id) => setPicks((prev) => prev.filter((p) => p.product_id !== id)),
    clear: () => setPicks([]),
  }

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>
}

export function useCompare(): CompareValue {
  const ctx = useContext(CompareContext)
  if (!ctx) throw new Error('useCompare must be used inside CompareProvider')
  return ctx
}
