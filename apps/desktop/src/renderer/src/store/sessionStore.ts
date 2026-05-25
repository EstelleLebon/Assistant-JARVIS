import { create } from 'zustand'

type Role = 'user' | 'assistant'

interface Message {
    id: number
    role: Role
    text: string
}

interface SessionStore {
    messages: Message[]
    partialTranscript: string
    streamingMessage: string | null
    addUserMessage: (text: string) => void
    setPartial: (text: string) => void
    startAssistantStream: () => void
    appendAssistantToken: (token: string) => void
    finalizeAssistantStream: (text: string) => void
    addAssistantMessage: (text: string) => void
}

const useSessionStore = create<SessionStore>((set) => ({
    messages: [],
    partialTranscript: '',
    streamingMessage: null,

    addUserMessage: (text) =>
        set((state) => ({
            messages: [...state.messages, { id: Date.now(), role: 'user', text }],
            partialTranscript: ''
        })),

    setPartial: (text) => set({ partialTranscript: text }),

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

    addAssistantMessage: (text) =>
        set((state) => ({
            messages: [...state.messages, { id: Date.now(), role: 'assistant', text }]
        }))
}))

export default useSessionStore
