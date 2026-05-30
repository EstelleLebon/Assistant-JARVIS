import logger from '../logger'

type Priority = 'conversation' | 'background'

interface LLMTask {
    priority: Priority
    run: () => Promise<void>
    onQueued?: () => void
    onError?: (err: unknown) => void
}

class LLMQueue {
    private running = false
    private runningPriority: Priority | null = null
    private convPending: LLMTask | null = null
    private bgPending: LLMTask[] = []

    enqueue(task: LLMTask): void {
        if (task.priority === 'conversation') {
            if (this.convPending) {
                logger.debug('[llmQueue] Replacing stale pending conversation task')
            }
            this.convPending = task
        } else {
            if (this.bgPending.length >= 3) {
                logger.debug('[llmQueue] Background queue full, dropping task')
                return
            }
            this.bgPending.push(task)
        }

        if (this.running) {
            task.onQueued?.()
        } else {
            this.drain()
        }
    }

    private async drain(): Promise<void> {
        // Conversation always drains before background
        const next = this.convPending ?? this.bgPending.shift() ?? null
        if (!next) {
            this.running = false
            this.runningPriority = null
            return
        }
        if (next === this.convPending) this.convPending = null

        this.running = true
        this.runningPriority = next.priority

        try {
            await next.run()
        } catch (err) {
            logger.error('[llmQueue] Task error: ' + String(err))
            next.onError?.(err)
        }

        this.runningPriority = null
        this.drain()
    }

    /** True if a conversation task is currently running or waiting to run. */
    isConversationActive(): boolean {
        return this.runningPriority === 'conversation' || this.convPending !== null
    }

    isRunning(): boolean {
        return this.running
    }
}

export const llmQueue = new LLMQueue()
