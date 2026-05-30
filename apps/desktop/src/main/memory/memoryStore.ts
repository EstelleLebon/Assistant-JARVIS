import logger from '../logger'

const BASE = 'http://localhost:3001'

export type MemoryType = 'declarative' | 'episodic' | 'behavioral'

export interface MemoryEntry {
    type: MemoryType
    content: string
    importance: number // 1–5
    tags?: string[]
}

// Map our types to tools-server endpoints
async function saveFact(content: string, category: string, confidence: number): Promise<void> {
    await fetch(`${BASE}/tools/memory/facts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, category, confidence: confidence / 5 }),
        signal: AbortSignal.timeout(5_000)
    })
}

async function saveEpisode(content: string): Promise<void> {
    const date = new Date().toISOString().substring(0, 10)
    await fetch(`${BASE}/tools/memory/episodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, date }),
        signal: AbortSignal.timeout(5_000)
    })
}

export async function addMemories(entries: MemoryEntry[]): Promise<void> {
    if (!entries.length) return

    const saves = entries.map((e) => {
        if (e.type === 'episodic') {
            return saveEpisode(e.content)
        } else {
            // declarative + behavioral → facts with category
            return saveFact(e.content, e.type, e.importance)
        }
    })

    const results = await Promise.allSettled(saves)
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed > 0) logger.warn(`[memoryStore] ${failed}/${entries.length} saves failed`)
    else logger.info(`[memoryStore] Saved ${entries.length} memories to tools-server`)
}

export interface MemoryContext {
    facts: { content: string; category: string; confidence: number }[]
    episodes: { content: string; date: string }[]
}

export async function fetchMemoryContext(query?: string): Promise<MemoryContext> {
    try {
        const url = query
            ? `${BASE}/tools/memory/context?q=${encodeURIComponent(query)}&limit=5`
            : `${BASE}/tools/memory/context`
        const res = await fetch(url, { signal: AbortSignal.timeout(3_000) })
        if (!res.ok) return { facts: [], episodes: [] }
        const json = (await res.json()) as any
        return json.data ?? { facts: [], episodes: [] }
    } catch {
        return { facts: [], episodes: [] }
    }
}
