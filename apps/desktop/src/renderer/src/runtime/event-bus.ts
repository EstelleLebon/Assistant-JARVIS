import { runtimeState } from './runtime-state'

type RuntimeEvents = {
    'startup-complete': void
    'wake-word-detected': void
    'speech-start': void
    'speech-end': void
    'speech-expired': void
    'thinking-start': void
    'thinking-end': void
    'speaking-start': void
    'speaking-end': void
    'tool-running': { tool: string }
    'tool-finished': { tool: string }
    error: { message: string }
}

type EventKey = keyof RuntimeEvents

type EventCallback<K extends EventKey> = (payload: RuntimeEvents[K]) => void

class EventBus {
    private listeners: {
        [K in EventKey]?: EventCallback<K>[]
    } = {}

    on<K extends EventKey>(event: K, callback: EventCallback<K>): () => void {
        if (!this.listeners[event]) {
            this.listeners[event] = []
        }
        this.listeners[event]?.push(callback)
        return () => {
            const arr = this.listeners[event] as EventCallback<K>[] | undefined
            if (arr) {
                const idx = arr.indexOf(callback)
                if (idx !== -1) arr.splice(idx, 1)
            }
        }
    }

    emit<K extends EventKey>(event: K, payload: RuntimeEvents[K]) {
        switch (event) {
            case 'wake-word-detected':
                runtimeState.setState({
                    mode: 'listening',
                    lastInteractionAt: Date.now()
                })
                break

            case 'thinking-start':
                runtimeState.setState({
                    mode: 'thinking'
                })
                break

            case 'speech-start':
                runtimeState.setState({
                    mode: 'listening'
                })
                break

            case 'speech-end':
                // stay in listening until thinking-start fires
                break

            case 'speech-expired':
                runtimeState.setState({ mode: 'idle' })
                break

            case 'speaking-start':
                console.log('[EventBus:DEBUG] speaking-start → runtimeState.mode = speaking')
                runtimeState.setState({
                    mode: 'speaking'
                })
                break

            case 'speaking-end':
                console.log('[EventBus:DEBUG] speaking-end → runtimeState.mode = idle')
                runtimeState.setState({
                    mode: 'idle'
                })
                break
        }
        this.listeners[event]?.forEach((callback) => {
            callback(payload)
        })
    }
}

export const eventBus = new EventBus()
