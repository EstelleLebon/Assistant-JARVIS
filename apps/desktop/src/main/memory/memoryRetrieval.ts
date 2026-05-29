import { fetchMemoryContext } from './memoryStore'

// Returns a compact, query-aware memory block ready to inject into a system prompt (≤ 800 chars).
// When `query` is provided, retrieval is ranked by FTS5 relevance to that query.
// Without a query, falls back to the most recent facts and episodes.
export async function getMemoryContext(query?: string, opts: { maxChars?: number } = {}): Promise<string> {
    const { maxChars = 800 } = opts
    const { facts, episodes } = await fetchMemoryContext(query)
    if (!facts.length && !episodes.length) return ''

    const parts: string[] = []
    let totalChars = 0

    const declarative = facts.filter((f) => f.category === 'declarative' || !f.category)
    const behavioral = facts.filter((f) => f.category === 'behavioral')

    const addLines = (items: string[], header: string) => {
        if (!items.length) return
        const lines: string[] = []
        for (const item of items) {
            if (totalChars >= maxChars) break
            lines.push(`- ${item}`)
            totalChars += item.length + 3
        }
        if (lines.length) parts.push(`${header}\n${lines.join('\n')}`)
    }

    addLines(declarative.map((f) => f.content), 'User facts:')
    addLines(episodes.map((e) => `[${e.date}] ${e.content}`), 'Past events:')
    addLines(behavioral.map((f) => f.content), 'Patterns:')

    if (!parts.length) return ''
    return `[Memory]\n${parts.join('\n\n')}`
}
