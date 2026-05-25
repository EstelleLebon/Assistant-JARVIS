import { useEffect } from 'react'
import OrbCanvas from './orb/OrbCanvas'
import StatusPanel from './components/StatusPanel'
import { startMicrophone } from './audio/microphone'
import useSessionStore from './store/sessionStore'
import ConversationView from './components/ConversationView'
import { eventBus } from './runtime/event-bus'

function App() {
    const {
        setPartial,
        addUserMessage,
        startAssistantStream,
        appendAssistantToken,
        finalizeAssistantStream
    } = useSessionStore()

    useEffect(() => {
        startMicrophone((chunk) => {
            window.jarvis.sendAudioChunk(chunk)
        })
    }, [])

    useEffect(() => {
        const removeWake = window.electron.ipcRenderer.on('assistant:wake', () =>
            eventBus.emit('wake-word-detected', undefined)
        )
        const removeSpeechStart = window.electron.ipcRenderer.on('assistant:speech_start', () =>
            eventBus.emit('speech-start', undefined)
        )
        const removeSpeechEnd = window.electron.ipcRenderer.on('assistant:speech_end', () =>
            eventBus.emit('speech-end', undefined)
        )
        const removeThinking = window.electron.ipcRenderer.on('assistant:thinking_start', () =>
            eventBus.emit('thinking-start', undefined)
        )
        const removeThinkingEnd = window.electron.ipcRenderer.on('assistant:llm_response', () =>
            eventBus.emit('thinking-end', undefined)
        )
        const removeSpeakingStart = window.electron.ipcRenderer.on('assistant:speaking_start', () =>
            eventBus.emit('speaking-start', undefined)
        )
        const removeSpeakingEnd = window.electron.ipcRenderer.on('assistant:speaking_end', () =>
            eventBus.emit('speaking-end', undefined)
        )
        const removeError = window.electron.ipcRenderer.on(
            'assistant:llm_error',
            (_, { message }: { message: string }) => eventBus.emit('error', { message })
        )

        return () => {
            removeWake()
            removeSpeechStart()
            removeSpeechEnd()
            removeThinking()
            removeThinkingEnd()
            removeSpeakingStart()
            removeSpeakingEnd()
            removeError()
        }
    }, [])

    useEffect(() => {
        const removePartial = window.electron.ipcRenderer.on(
            'assistant:partial_transcript',
            (_, { text }: { text: string }) => setPartial(text)
        )
        const removeFinal = window.electron.ipcRenderer.on(
            'assistant:final_transcript',
            (_, { text }: { text: string }) => addUserMessage(text)
        )
        const removeStreamStart = window.electron.ipcRenderer.on('assistant:llm_stream_start', () =>
            startAssistantStream()
        )
        const removeToken = window.electron.ipcRenderer.on(
            'assistant:llm_token',
            (_, { token }: { token: string }) => appendAssistantToken(token)
        )
        const removeResponse = window.electron.ipcRenderer.on(
            'assistant:llm_response',
            (_, { text }: { text: string }) => finalizeAssistantStream(text)
        )

        return () => {
            removePartial()
            removeFinal()
            removeStreamStart()
            removeToken()
            removeResponse()
        }
    }, [
        addUserMessage,
        setPartial,
        startAssistantStream,
        appendAssistantToken,
        finalizeAssistantStream
    ])

    return (
        <div className="app">
            <OrbCanvas />
            <ConversationView />
            <StatusPanel />
        </div>
    )
}

export default App
