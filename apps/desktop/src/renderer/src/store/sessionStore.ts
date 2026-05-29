import { create } from 'zustand'

export interface ToolMessage {
    id: number
    role: 'tool'
    toolName: string
    toolArgs: Record<string, unknown>
    toolResult?: string
}

export interface TextMessage {
    id: number
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
    appendSessionFinal: (text: string) => void
    setPartial: (text: string) => void
    commitSession: () => void
    startAssistantStream: () => void
    appendAssistantToken: (token: string) => void
    finalizeAssistantStream: (text: string) => void
    addToolCall: (id: number, toolName: string, toolArgs: Record<string, unknown>) => void
    updateToolResult: (id: number, toolResult: string) => void
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
                messages: [...state.messages, { id: Date.now(), role: 'user', text }],
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
            messages: [...state.messages, { id: Date.now(), role: 'assistant', text }],
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

    setError: (message) => set({ errorMessage: message }),

    clearError: () => set({ errorMessage: null }),

    clearMessages: () =>
        set({ messages: [], sessionText: '', partialTranscript: '', streamingMessage: null, errorMessage: null })
}))

export default useSessionStore
