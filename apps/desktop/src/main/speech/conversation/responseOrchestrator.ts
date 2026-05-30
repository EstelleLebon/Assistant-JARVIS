import { askOllamaStream } from '../../llm/ollamaClient'
import { queueSpeak, stopSpeaking, isTTSPlaying, ttsEvents, extractTTSChunks } from '../TTS/ttsPlayer'
import logger from '../../logger'
import type Conversation from './Conversation'
import { executeTool, type ToolCallRequest } from '../../tools/toolsClient'
import { getAllTools, getToolByName } from '../../tools/toolsCatalogue'

const MAX_TOOL_ROUNDS = 20

function parseToolCall(text: string): ToolCallRequest | null {
    const trimmed = text.trim()
    if (!trimmed.includes('"tool"')) return null
    try {
        const parsed = JSON.parse(trimmed)
        if (typeof parsed.tool === 'string') {
            return { tool: parsed.tool, args: parsed.args ?? {} }
        }
    } catch {
        // not valid JSON
    }
    return null
}

/** Extract a tool call from a mixed response (text + JSON on its own line). */
function extractToolCall(text: string): { toolCall: ToolCallRequest | null; spokenText: string } {
    const lines = text.split('\n')
    const textLines: string[] = []
    let toolCall: ToolCallRequest | null = null

    for (const line of lines) {
        const call = parseToolCall(line.trim())
        if (call && !toolCall) {
            toolCall = call
        } else {
            textLines.push(line)
        }
    }

    return { toolCall, spokenText: textLines.join('\n').trim() }
}

/** Strip JSON tool-call lines from text before sending to TTS. */
function stripToolCallLines(text: string): string {
    return text
        .split('\n')
        .filter((line) => !parseToolCall(line.trim()))
        .join('\n')
}

export async function handleUserMessage(
    text: string,
    conversation: Conversation,
    emit: (channel: string, payload?: any) => void,
    onDone: () => void
): Promise<void> {
    conversation.addUserMessage(text)
    emit('assistant:thinking_start')

    const modelOptions = {
        model: 'qwen-main-assistant' as const,
        tools: getAllTools(),
        enableFunctionCalling: true
    }

    let toolRound = 0
    let anySpeakQueued = false

    const speakTracked = (chunk: string) => {
        const t = chunk.trim()
        if (t) {
            anySpeakQueued = true
            queueSpeak(t)
        }
    }

    const runLLM = async (): Promise<void> => {
        try {
            let sentenceBuffer = ''
            let firstToken = true
            let fullResponse = ''
            let pendingPhraseQueued = false

            const tryQueuePendingPhrase = (text: string) => {
                if (pendingPhraseQueued) return
                const trimmed = text.trim()
                if (!trimmed.includes('"tool"')) return

                // Extract tool name early from partial JSON (before closing '}')
                const toolNameMatch = trimmed.match(/"tool"\s*:\s*"([^"]+)"/)
                if (!toolNameMatch) return

                const toolName = toolNameMatch[1]
                const toolDef = getToolByName(toolName)
                if (!toolDef?.pendingPhrase) return

                // For args we need complete JSON — use partial args or empty fallback
                let args: Record<string, unknown> = {}
                if (trimmed.includes('}')) {
                    const { toolCall } = extractToolCall(trimmed)
                    if (toolCall) args = toolCall.args ?? {}
                }

                pendingPhraseQueued = true
                let phrase = toolDef.pendingPhrase(args)
                if (phrase.includes('undefined')) {
                    // Args incomplete — strip from undefined onward and close with ellipsis
                    phrase = phrase.replace(/\s*["«]?undefined["»]?.*$/, '...').trim()
                }
                speakTracked(phrase)
                logger.info(`[responseOrchestrator] Pending phrase queued early mid-stream for "${toolName}"`)
            }

            const reply = await askOllamaStream(
                [...conversation.getHistory()],
                (token) => {
                    fullResponse += token

                    // Pure tool call (response starts with '{') — skip text TTS, but try pending phrase
                    if (fullResponse.trimStart().startsWith('{')) {
                        tryQueuePendingPhrase(fullResponse)
                        return
                    }

                    // Mixed response: stop streaming to TTS once a tool call line appears
                    if (fullResponse.includes('"tool"') && fullResponse.includes('\n{')) {
                        tryQueuePendingPhrase(fullResponse)
                        return
                    }

                    if (firstToken) {
                        emit('assistant:llm_stream_start')
                        firstToken = false
                    }
                    emit('assistant:llm_token', { token })

                    sentenceBuffer += token
                    const { chunks, remaining } = extractTTSChunks(sentenceBuffer)
                    for (const chunk of chunks) speakTracked(stripToolCallLines(chunk))
                    sentenceBuffer = remaining
                },
                modelOptions
            )

            const { toolCall, spokenText } = extractToolCall(reply)

            if (toolCall && toolRound < MAX_TOOL_ROUNDS) {
                toolRound++
                const toolId = Date.now()
                logger.info(
                    `[responseOrchestrator] Tool call detected: ${toolCall.tool} (round ${toolRound})`
                )

                // Speak any text that preceded the tool call JSON
                if (spokenText) speakTracked(spokenText)

                emit('assistant:tool_call', {
                    id: toolId,
                    tool: toolCall.tool,
                    args: toolCall.args
                })

                // Speak pending phrase only if not already queued mid-stream
                const toolDef = getToolByName(toolCall.tool)
                if (toolDef?.pendingPhrase && !pendingPhraseQueued) {
                    const phrase = toolDef.pendingPhrase(toolCall.args ?? {})
                    speakTracked(phrase)
                }

                // Add assistant tool call to history (raw reply preserved for context)
                conversation.addAssistantMessage(reply)

                // Execute the tool (TTS plays concurrently)
                const { result, panel } = await executeTool(toolCall)
                logger.info(`[responseOrchestrator] Tool result: ${result.slice(0, 200)}`)

                emit('assistant:tool_result', { id: toolId, tool: toolCall.tool, result, panel })

                conversation.addUserMessage(`[Tool result for ${toolCall.tool}]\n${result}`)

                return runLLM()
            }

            // Normal text response — flush remaining TTS buffer (strip any stray JSON lines)
            const remaining = stripToolCallLines(sentenceBuffer).trim()
            if (remaining) {
                speakTracked(remaining)
            }

            conversation.addAssistantMessage(reply)
            emit('assistant:llm_response', { text: reply })

            if (anySpeakQueued) {
                const finish = () => {
                    logger.info('[responseOrchestrator] TTS done — assistant sleeping')
                    onDone()
                }
                // Race guard: TTS may have already finished for short responses
                if (!isTTSPlaying()) {
                    finish()
                } else {
                    ttsEvents.once('speaking-end', finish)
                }
            } else {
                // Nothing was spoken (empty or pure-tool response) — complete immediately
                logger.info('[responseOrchestrator] No TTS queued — assistant sleeping')
                onDone()
            }
        } catch (err) {
            logger.error('[responseOrchestrator] Ollama error: ' + String(err))
            stopSpeaking()
            emit('assistant:llm_error', { message: String(err) })
            onDone()
        }
    }

    await runLLM()
}
