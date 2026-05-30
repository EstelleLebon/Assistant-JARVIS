import logger from './logger'
import type { ConversationMessage } from './speech/conversation/Message'
import { extractMemoriesFromConversation } from './memory/memoryExtractor'
import { addMemories } from './memory/memoryStore'
import { getToolServerStatuses } from './tools/toolsServerManager'
import { addReminder, getDueReminders, markDelivered } from './heartbeat/reminderStore'
import { canNotify, recordNotification } from './heartbeat/attentionEngine'
import { sendNotification } from './notifications'
import { llmQueue } from './llm/llmQueue'

// ─── Task types ───────────────────────────────────────────────────────────────

export type Task =
    | { type: 'extract-insights'; payload: { messages: ConversationMessage[] } }
    | { type: 'extract-insights-partial'; payload: { messages: ConversationMessage[] } }
    | { type: 'heartbeat'; payload?: undefined }
    | { type: 'check-reminders'; payload?: undefined }
    | { type: 'add-reminder'; payload: { text: string; dueAt: number } }

type EmitFn = (channel: string, payload?: any) => void
type DeliverFn = (text: string) => void

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleExtractInsights(messages: ConversationMessage[], emit: EmitFn): Promise<void> {
    if (messages.length === 0) return

    const transcript = messages
        .map((m) => `${m.role === 'user' ? 'User' : 'Jarvis'}: ${m.content}`)
        .join('\n')

    await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
            logger.warn('[taskQueue] Memory extraction timeout (60s) — skipping')
            resolve()
        }, 60_000)
        llmQueue.enqueue({
            priority: 'background',
            run: async () => {
                try {
                    const entries = await extractMemoriesFromConversation(transcript)
                    if (entries.length === 0) {
                        logger.info(
                            '[taskQueue] No memories worth extracting from this conversation'
                        )
                    } else {
                        addMemories(entries)
                        logger.info(`[taskQueue] Extracted and saved ${entries.length} memories`)
                        emit('conversation:insights', { count: entries.length, entries })
                    }
                } finally {
                    clearTimeout(timeout)
                    resolve()
                }
            }
        })
    })
}

async function handleHeartbeat(emit: EmitFn): Promise<void> {
    const status: Record<string, boolean> = {}

    try {
        const res = await fetch('http://localhost:11434/api/tags', {
            signal: AbortSignal.timeout(5_000)
        })
        status.ollama = res.ok
    } catch {
        status.ollama = false
    }

    const toolStatuses = await getToolServerStatuses()
    Object.assign(status, toolStatuses)

    const down = Object.entries(status)
        .filter(([, ok]) => !ok)
        .map(([k]) => k)
    if (down.length > 0) {
        logger.warn('[taskQueue] Heartbeat — services down: ' + down.join(', '))
    } else {
        logger.debug('[taskQueue] Heartbeat — all services up')
    }

    emit('service:heartbeat', status)
}

async function handleCheckReminders(emit: EmitFn, deliver: DeliverFn): Promise<void> {
    const due = getDueReminders()
    for (const reminder of due) {
        if (!canNotify()) break
        logger.info(`[taskQueue] Delivering reminder: "${reminder.text}"`)
        markDelivered(reminder.id)
        recordNotification()
        deliver(reminder.text)
        sendNotification('Rappel', reminder.text)
        emit('assistant:reminder', { text: reminder.text, timestamp: Date.now() })
    }
}

async function handleAddReminder(text: string, dueAt: number): Promise<void> {
    addReminder(text, dueAt)
}

// ─── Queue implementation ─────────────────────────────────────────────────────

const queue: Task[] = []
let running = false
let stopped = false
let draining = false
let emitFn: EmitFn = () => {}
let deliverFn: DeliverFn = () => {}

async function processNext(): Promise<void> {
    if (stopped || queue.length === 0) {
        running = false
        return
    }

    running = true
    const task = queue.shift()!
    logger.debug(`[taskQueue] Processing task: ${task.type}`)

    try {
        if (task.type === 'extract-insights' || task.type === 'extract-insights-partial') {
            await handleExtractInsights(task.payload.messages, emitFn)
        } else if (task.type === 'heartbeat') {
            await handleHeartbeat(emitFn)
        } else if (task.type === 'check-reminders') {
            await handleCheckReminders(emitFn, deliverFn)
        } else if (task.type === 'add-reminder') {
            await handleAddReminder(task.payload.text, task.payload.dueAt)
        }
    } catch (err) {
        logger.error(`[taskQueue] Task "${task.type}" failed: ` + String(err))
    }

    setImmediate(() => processNext())
}

export function pushTask(task: Task): void {
    if (stopped || draining) return
    queue.push(task)
    logger.debug(`[taskQueue] Task queued: ${task.type} (queue length: ${queue.length})`)
    if (!running) processNext()
}

export function startTaskQueue(emit: EmitFn, deliver: DeliverFn = () => {}): void {
    emitFn = emit
    deliverFn = deliver
    stopped = false
    logger.info('[taskQueue] Started')
}

export function stopTaskQueue(): void {
    stopped = true
    queue.length = 0
    logger.info('[taskQueue] Stopped')
}

// Waits for the current queue to drain, then stops. Use on app shutdown.
// stopped is set only after drain so in-flight and already-queued tasks can complete.
export function drainAndStop(): Promise<void> {
    draining = true // block new pushes, but let queued tasks finish
    if (!running && queue.length === 0) {
        stopped = true
        return Promise.resolve()
    }
    return new Promise((resolve) => {
        const check = setInterval(() => {
            if (!running && queue.length === 0) {
                clearInterval(check)
                stopped = true
                resolve()
            }
        }, 100)
    })
}
