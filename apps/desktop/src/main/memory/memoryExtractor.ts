import logger from '../logger'
import type { MemoryEntry } from './memoryStore'

interface ExtractedMemory {
    type: 'declarative' | 'episodic' | 'behavioral'
    content: string
    importance: number
    tags?: string[]
}

const EXTRACTION_PROMPT = `You are a memory extraction system for a personal AI assistant named Jarvis.

Analyze the conversation below and extract the most valuable information to remember long-term.

Categorize each memory as one of:
- declarative: stable facts about the user (preferences, tools, setup, name, work, hobbies)
- episodic: significant events, decisions, problems solved, projects discussed
- behavioral: usage patterns, routines, communication style, recurring topics

Rules:
- Extract only what is genuinely useful to remember across future conversations
- Skip greetings, small talk, and trivial exchanges
- Be specific and factual — no vague summaries
- Each entry must be a single self-contained sentence
- Importance: 1 (low) to 5 (critical) — prefer 3+ for things worth keeping

Output ONLY a JSON array, no preamble, no markdown fences:
[
  {"type": "declarative", "content": "...", "importance": 4, "tags": ["tech"]},
  {"type": "episodic", "content": "...", "importance": 3},
  ...
]

If there is nothing worth remembering, output: []

Conversation:
`

export async function extractMemoriesFromConversation(
    transcript: string,
    ollamaModel = 'llama3.1:8b'
): Promise<Omit<MemoryEntry, 'id' | 'timestamp'>[]> {
    const prompt = EXTRACTION_PROMPT + transcript

    const res = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: ollamaModel,
            messages: [{ role: 'user', content: prompt }],
            stream: true
        }),
        signal: AbortSignal.timeout(45_000)
    })

    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`)

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let raw = ''

    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
            if (!line.trim()) continue
            try {
                raw += JSON.parse(line).message?.content ?? ''
            } catch {
                // partial JSON chunk
            }
        }
    }

    const jsonStart = raw.indexOf('[')
    const jsonEnd = raw.lastIndexOf(']')
    if (jsonStart === -1 || jsonEnd === -1) {
        logger.warn('[memoryExtractor] No JSON array found in LLM output')
        return []
    }

    const extracted: ExtractedMemory[] = JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
    return extracted.filter(
        (e) =>
            (e.type === 'declarative' || e.type === 'episodic' || e.type === 'behavioral') &&
            typeof e.content === 'string' &&
            e.content.trim().length > 0 &&
            typeof e.importance === 'number'
    )
}
