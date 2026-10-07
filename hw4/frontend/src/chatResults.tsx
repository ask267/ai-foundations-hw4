// Products the chat agent found, shared so the page (not just the chat bubble)
// can render them as cards.
import { createContext, useContext, useState, type ReactNode } from 'react'
import type { ProductSummary } from './api'

export type ChatResults = {
  title: string
  products: ProductSummary[]
  version: number // bumps on every new result set, so the panel can scroll into view
}

type ChatResultsValue = {
  results: ChatResults | null
  showResults: (title: string | null, products: ProductSummary[]) => void
  clearResults: () => void
}

const ChatResultsContext = createContext<ChatResultsValue | null>(null)

export function ChatResultsProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<ChatResults | null>(null)

  const value: ChatResultsValue = {
    results,
    showResults(title, products) {
      setResults((prev) => ({
        title: title || 'Picks from Dan',
        products,
        version: (prev?.version ?? 0) + 1,
      }))
    },
    clearResults() {
      setResults(null)
    },
  }

  return <ChatResultsContext.Provider value={value}>{children}</ChatResultsContext.Provider>
}

export function useChatResults(): ChatResultsValue {
  const ctx = useContext(ChatResultsContext)
  if (!ctx) throw new Error('useChatResults must be used inside ChatResultsProvider')
  return ctx
}
