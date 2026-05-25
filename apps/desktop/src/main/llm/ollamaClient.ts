import logger from '../logger'

interface OllamaMessage {
    role: 'user' | 'assistant' | 'system'
    content: string
}

const OLLAMA_URL = 'http://localhost:11434/api/chat'
const MODEL = 'llama3.1:8b'

const SYSTEM_PROMPT =
    'Tu es Jarvis, un assistant vocal intelligent. Réponds de façon concise et naturelle, en une ou deux phrases maximum.'

export async function askOllamaStream(
    history: OllamaMessage[],
    onToken: (token: string) => void
): Promise<string> {
    const messages: OllamaMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...history]

    logger.debug(`[ollamaClient] Streaming ${messages.length} messages to Ollama`)

    const res = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, messages, stream: true })
    })

    if (!res.ok) {
        throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`)
    }

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let fullText = ''

    while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
            if (!line.trim()) continue
            try {
                const json = JSON.parse(line)
                const token: string = json.message?.content ?? ''
                if (token) {
                    fullText += token
                    onToken(token)
                }
            } catch {
                // partial JSON line, skip
            }
        }
    }

    logger.debug('[ollamaClient] Full reply: ' + fullText)
    return fullText
}
