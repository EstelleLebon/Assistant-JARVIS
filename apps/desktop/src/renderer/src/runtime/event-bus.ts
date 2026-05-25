import { runtimeState } from './runtime-state'

type RuntimeEvents = {
    'wake-word-detected': void
    'speech-start': void
    'speech-end': void
    'thinking-start': void
    'thinking-end': void
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

    on<K extends EventKey>(event: K, callback: EventCallback<K>) {
        if (!this.listeners[event]) {
            this.listeners[event] = []
        }

        this.listeners[event]?.push(callback)
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
                    mode: 'speaking'
                })
                break

            case 'speech-end':
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
