const DEFAULT_SESSION_TIMEOUT_MS = 2000
const DEFAULT_PARTIAL_TIMEOUT_MS = 4000
const DEFAULT_INITIAL_TIMEOUT_MS = 8000

export default class SpeechSession {
    private active = false
    private accumulated: string[] = []
    private sessionTimeout: NodeJS.Timeout | null = null

    constructor(
        private readonly onEnd: (text: string) => void,
        private readonly onPartialCb: (text: string) => void,
        private readonly onExpire: () => void,
        private readonly timeoutMs: number = DEFAULT_SESSION_TIMEOUT_MS
    ) {}

    start() {
        this.active = true
        this.accumulated = []
        this.sessionTimeout = setTimeout(() => this.end(), DEFAULT_INITIAL_TIMEOUT_MS)
    }

    isActive() {
        return this.active
    }

    onSpeechStart() {
        if (!this.active) return
        this.clearTimeout()
    }

    onPartial(text: string) {
        if (!this.active) return
        this.resetTimeout(DEFAULT_PARTIAL_TIMEOUT_MS)
        this.onPartialCb(text)
    }

    onFinal(text: string) {
        if (!this.active) return
        this.accumulated.push(text)
        this.resetTimeout()
    }

    stop() {
        this.active = false
        this.clearTimeout()
        this.accumulated = []
    }

    private resetTimeout(ms: number = this.timeoutMs) {
        this.clearTimeout()
        this.sessionTimeout = setTimeout(() => {
            this.end()
        }, ms)
    }

    private clearTimeout() {
        if (this.sessionTimeout) {
            clearTimeout(this.sessionTimeout)
            this.sessionTimeout = null
        }
    }

    private end() {
        if (!this.active) return
        this.active = false
        this.clearTimeout()
        const text = this.accumulated.join(' ').trim()
        this.accumulated = []
        if (text) {
            this.onEnd(text)
        } else {
            this.onExpire()
        }
    }
}
