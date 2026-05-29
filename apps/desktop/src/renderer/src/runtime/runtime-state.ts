export type RuntimeMode = 'idle' | 'listening' | 'thinking' | 'speaking' | 'sleep'

export type ServiceStatus = 'stopped' | 'starting' | 'running' | 'error'
export type ServiceName = 'wakeword' | 'chrome-stt' | 'piper' | 'tools-server' | 'system-tools-server'

export interface RuntimeState {
    mode: RuntimeMode

    wakeWordEnabled: boolean

    microphoneMuted: boolean

    activeTool: string | null

    connectedTools: string[]

    lastInteractionAt: number

    serviceStatus: Record<ServiceName, ServiceStatus>
}

type Listener = (state: RuntimeState) => void

class RuntimeStateStore {
    private state: RuntimeState = {
        mode: 'idle',

        wakeWordEnabled: true,

        microphoneMuted: false,

        activeTool: null,

        connectedTools: [],

        lastInteractionAt: Date.now(),

        serviceStatus: {
            wakeword: 'stopped',
            'chrome-stt': 'stopped',
            piper: 'stopped',
            'tools-server': 'stopped',
            'system-tools-server': 'stopped'
        }
    }

    private listeners = new Set<Listener>()

    getState() {
        return this.state
    }

    subscribe(listener: Listener) {
        this.listeners.add(listener)

        return () => {
            this.listeners.delete(listener)
        }
    }

    private notify() {
        for (const listener of this.listeners) {
            listener(this.state)
        }
    }

    setState(partial: Partial<RuntimeState>) {
        this.state = {
            ...this.state,
            ...partial
        }

        this.notify()
    }
}

export const runtimeState = new RuntimeStateStore()
