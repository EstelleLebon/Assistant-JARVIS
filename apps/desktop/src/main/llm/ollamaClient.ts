import logger from '../logger'
import { createSystemPrompt, type ModelType } from '../speech/conversation/systemPrompt'
import { countTokensRemote, TokenizerModel } from './tokenizerClient'
import { getMemoryContext } from '../memory/memoryRetrieval'

function estimateTokens(model: TokenizerModel, text: string): number {
    // Estimation simple : Llama/Mistral ≈ 4, Qwen ≈ 3.5
    if (model === 'qwen') return Math.ceil(text.length / 3.5)
    return Math.ceil(text.length / 4)
}

async function countTokensWithTimeout(
    model: TokenizerModel,
    text: string,
    timeoutMs = 3000
): Promise<number> {
    return Promise.race([
        countTokensRemote(model, text),
        new Promise<number>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), timeoutMs)
        )
    ]).catch(() => estimateTokens(model, text))
}

interface OllamaMessage {
    role: 'user' | 'assistant' | 'system'
    content: string
}

const OLLAMA_URL = 'http://localhost:11434/api/chat'
const MODEL: ModelType = 'llama-fast-assistant'

export async function askOllamaStream(
    history: OllamaMessage[],
    onToken: (token: string) => void,
    modelOptions: {
        model?: ModelType
        lang?: string
        enableFunctionCalling?: boolean
        tools?: import('../tools/toolsCatalogue').ToolDef[]
    } = {}
): Promise<string> {
    const lastUserQuery = [...history].reverse().find((m) => m.role === 'user')?.content
    const memoryContext = await getMemoryContext(lastUserQuery)
    const messages: OllamaMessage[] = [
        {
            role: 'system',
            content: createSystemPrompt({
                ...modelOptions,
                memoryContext: memoryContext || undefined
            })
        },
        ...history
    ]

    logger.debug(`[ollamaClient] Streaming ${messages.length} messages to Ollama`)

    const finalModel = modelOptions.model || MODEL
    logger.debug(`[ollamaClient] Using model: ${finalModel}`)

    const CTX_SIZES: Record<string, number> = {
        'llama-fast-assistant': 8192,
        'qwen-main-assistant': 8192,
        'mistral-agent': 8192
    }
    const ctxMaxSize = CTX_SIZES[finalModel] ?? 8192
    logger.debug(`[ollamaClient] Max tokens set to: ${ctxMaxSize}`)

    // Map ModelType to TokenizerModel
    function toTokenizerModel(model: ModelType): TokenizerModel {
        switch (model) {
            case 'llama-fast-assistant':
                return 'llama3'
            case 'mistral-agent':
                return 'mistral'
            case 'qwen-main-assistant':
                return 'qwen'
            default:
                throw new Error('Unknown model: ' + model)
        }
    }

    // Trim messages to fit context window
    const trimmedMessages = [...messages]
    async function countMessagesTokens(
        model: ModelType,
        msgs: { content: string }[]
    ): Promise<number> {
        let total = 0
        const tkModel = toTokenizerModel(model)
        for (const msg of msgs) {
            total += await countTokensWithTimeout(tkModel, msg.content)
        }
        return total
    }

    let totalTokens = await countMessagesTokens(finalModel, trimmedMessages)
    let removed = 0
    while (totalTokens > ctxMaxSize && trimmedMessages.length > 1) {
        // Always keep system prompt (index 0), remove oldest user/assistant message
        trimmedMessages.splice(1, 1)
        removed++
        totalTokens = await countMessagesTokens(finalModel, trimmedMessages)
    }
    if (removed > 0) {
        logger.warn(
            `\n[ollamaClient] Trimmed ${removed} messages to fit context (${totalTokens}/${ctxMaxSize} tokens)`
        )
    } else {
        logger.debug(`[ollamaClient] Total tokens: ${totalTokens}`)
    }

    logger.debug(
        `[ollamaClient] Final messages sent to Ollama:\n${trimmedMessages
            .map((m) => `${m.role}: ${m.content}`)
            .join('\n')}`
    )

    const abort = new AbortController()
    const abortTimer = setTimeout(() => abort.abort(), 30_000)

    let res: Response
    try {
        res = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: finalModel,
                messages: trimmedMessages,
                stream: true,
                // Disable Qwen3 extended thinking — adds hundreds of tokens of latency for voice use
                ...(finalModel === 'qwen-main-assistant' ? { think: false } : {})
            }),
            signal: abort.signal
        })
    } finally {
        clearTimeout(abortTimer)
    }

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
