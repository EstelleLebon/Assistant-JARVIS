export type RuntimeMode =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "sleep"

export interface RuntimeState {
  mode: RuntimeMode

  wakeWordEnabled: boolean

  microphoneMuted: boolean

  activeTool: string | null

  connectedTools: string[]

  lastInteractionAt: number
}

type Listener = (state: RuntimeState) => void

class RuntimeStateStore {
  private state: RuntimeState = {
    mode: "idle",

    wakeWordEnabled: true,

    microphoneMuted: false,

    activeTool: null,

    connectedTools: [],

    lastInteractionAt: Date.now(),
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
      ...partial,
    }

    this.notify()
  }
}

export const runtimeState = new RuntimeStateStore()