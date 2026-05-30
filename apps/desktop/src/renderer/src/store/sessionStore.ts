import { create } from 'zustand'

export interface ToolMessage {
    id: number
    role: 'tool'
    toolName: string
    toolArgs: Record<string, unknown>
    toolResult?: string
}

export interface TextMessage {
    id: string
    role: 'user' | 'assistant'
    text: string
}

export type Message = TextMessage | ToolMessage

interface SessionStore {
    messages: Message[]
    sessionText: string
    partialTranscript: string
    streamingMessage: string | null
    errorMessage: string | null
    llmQueued: boolean
    llmQueuedSince: number | null
    setLlmQueued: (v: boolean) => void
    appendSessionFinal: (text: string) => void
    setPartial: (text: string) => void
    commitSession: () => void
    startAssistantStream: () => void
    appendAssistantToken: (token: string) => void
    finalizeAssistantStream: (text: string) => void
    addToolCall: (id: number, toolName: string, toolArgs: Record<string, unknown>) => void
    updateToolResult: (id: number, toolResult: string) => void
    addAssistantMessage: (text: string) => void
    setError: (message: string) => void
    clearError: () => void
    clearMessages: () => void
}

const useSessionStore = create<SessionStore>((set) => ({
    messages: [],
    sessionText: '',
    partialTranscript: '',
    streamingMessage: null,
    errorMessage: null,
    llmQueued: false,
    llmQueuedSince: null,
    setLlmQueued: (v) => set({ llmQueued: v, llmQueuedSince: v ? Date.now() : null }),

    appendSessionFinal: (text) =>
        set((state) => ({
            sessionText: state.sessionText ? state.sessionText + ' ' + text : text,
            partialTranscript: ''
        })),

    setPartial: (text) => set({ partialTranscript: text }),

    commitSession: () =>
        set((state) => {
            const text = state.sessionText.trim()
            if (!text) return { sessionText: '', partialTranscript: '' }
            return {
                messages: [...state.messages, { id: crypto.randomUUID(), role: 'user', text }],
                sessionText: '',
                partialTranscript: ''
            }
        }),

    startAssistantStream: () => set({ streamingMessage: '' }),

    appendAssistantToken: (token) =>
        set((state) => ({
            streamingMessage: (state.streamingMessage ?? '') + token
        })),

    finalizeAssistantStream: (text) =>
        set((state) => ({
            messages: [...state.messages, { id: crypto.randomUUID(), role: 'assistant', text }],
            streamingMessage: null
        })),

    addToolCall: (id, toolName, toolArgs) =>
        set((state) => ({
            messages: [...state.messages, { id, role: 'tool', toolName, toolArgs }]
        })),

    updateToolResult: (id, toolResult) =>
        set((state) => ({
            messages: state.messages.map((m) =>
                m.id === id && m.role === 'tool' ? { ...m, toolResult } : m
            )
        })),

    addAssistantMessage: (text) =>
        set((state) => ({
            messages: [...state.messages, { id: crypto.randomUUID(), role: 'assistant', text }]
        })),

    setError: (message) => set({ errorMessage: message }),

    clearError: () => set({ errorMessage: null }),

    clearMessages: () =>
        set({
            messages: [],
            sessionText: '',
            partialTranscript: '',
            streamingMessage: null,
            errorMessage: null,
            llmQueued: false,
            llmQueuedSince: null
        })
}))

export default useSessionStore
