import { type ReactNode } from 'react'

// Minimal, safe markdown for chat replies: paragraphs, bullet/numbered lists,
// **bold**, *italic*, and `code`. No raw HTML is ever injected.

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i}>{part.slice(1, -1)}</code>
    }
    return <span key={i}>{part}</span>
  })
}

const BULLET = /^\s*[-*]\s+(.*)$/
const NUMBERED = /^\s*\d+\.\s+(.*)$/

export default function Markdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let paragraph: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    blocks.push(
      <p key={`p-${blocks.length}`}>
        {paragraph.map((line, i) => (
          <span key={i}>
            {i > 0 && <br />}
            {renderInline(line)}
          </span>
        ))}
      </p>,
    )
    paragraph = []
  }

  const flushList = () => {
    if (!list) return
    const items = list.items.map((item, i) => <li key={i}>{renderInline(item)}</li>)
    blocks.push(
      list.ordered ? <ol key={`l-${blocks.length}`}>{items}</ol> : <ul key={`l-${blocks.length}`}>{items}</ul>,
    )
    list = null
  }

  for (const line of lines) {
    const bullet = line.match(BULLET)
    const numbered = line.match(NUMBERED)

    if (bullet || numbered) {
      flushParagraph()
      const ordered = Boolean(numbered)
      const content = (bullet ? bullet[1] : numbered![1]).trim()
      if (!list || list.ordered !== ordered) {
        flushList()
        list = { ordered, items: [] }
      }
      list.items.push(content)
    } else if (line.trim() === '') {
      flushParagraph()
      flushList()
    } else {
      flushList()
      paragraph.push(line)
    }
  }
  flushParagraph()
  flushList()

  return <div className="markdown">{blocks}</div>
}
