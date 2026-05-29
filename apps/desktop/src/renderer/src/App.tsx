import { useEffect, useState } from 'react'
import OrbCanvas from './orb/OrbCanvas'
import useSessionStore from './store/sessionStore'
import useNotificationStore from './store/notificationStore'
import ConversationPanel from './components/panels/ConversationView/ConversationPanel'
import NotificationPanel from './components/panels/NotificationPanel'
import SettingsPanel from './components/panels/SettingsPanel'
import StatusPanel from './components/panels/StatusPanel/StatusPanel'
import { eventBus } from './runtime/event-bus'
import { runtimeState } from './runtime/runtime-state'
import type { ServiceName, ServiceStatus } from './runtime/runtime-state'

function App() {
    const [showSettings, setShowSettings] = useState(true)
    const [showStatus, setShowStatus] = useState(true)
    const [startupComplete, setStartupComplete] = useState(false)
    const { addNotification, notifications } = useNotificationStore()
    const {
        setPartial,
        appendSessionFinal,
        commitSession,
        startAssistantStream,
        appendAssistantToken,
        finalizeAssistantStream,
        addToolCall,
        updateToolResult,
        setError,
        clearMessages
    } = useSessionStore()

    useEffect(() => {
        eventBus.on('startup-complete', () => {
            setStartupComplete(true)
            window.jarvis.notifyStartupComplete()
        })
        window.jarvis.onNotification(addNotification)
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
        const removeThinking = window.electron.ipcRenderer.on('assistant:thinking_start', () => {
            commitSession()
            eventBus.emit('thinking-start', undefined)
        })
        const removeThinkingEnd = window.electron.ipcRenderer.on('assistant:llm_response', () =>
            eventBus.emit('thinking-end', undefined)
        )
        const removeSpeakingStart = window.electron.ipcRenderer.on('assistant:speaking_start', () => {
            eventBus.emit('speaking-start', undefined)
            runtimeState.setState({ serviceStatus: { ...runtimeState.getState().serviceStatus, piper: 'running' } })
        })
        const removeSpeakingEnd = window.electron.ipcRenderer.on('assistant:speaking_end', () => {
            eventBus.emit('speaking-end', undefined)
            runtimeState.setState({ serviceStatus: { ...runtimeState.getState().serviceStatus, piper: 'stopped' } })
        })
        const removeError = window.electron.ipcRenderer.on(
            'assistant:llm_error',
            (_, { message }: { message: string }) => {
                eventBus.emit('error', { message })
                setError(message)
            }
        )
        const removeServiceStatus = window.electron.ipcRenderer.on(
            'service:status',
            (_, { service, status }: { service: ServiceName; status: ServiceStatus }) => {
                runtimeState.setState({
                    serviceStatus: {
                        ...runtimeState.getState().serviceStatus,
                        [service]: status
                    }
                })
            }
        )
        const removeCleared = window.electron.ipcRenderer.on('conversation:cleared', () =>
            clearMessages()
        )
        const removeToolCall = window.electron.ipcRenderer.on(
            'assistant:tool_call',
            (_, { id, tool, args }: { id: number; tool: string; args: Record<string, unknown> }) =>
                addToolCall(id, tool, args)
        )
        const removeToolResult = window.electron.ipcRenderer.on(
            'assistant:tool_result',
            (_, { id, result }: { id: number; result: string }) => updateToolResult(id, result)
        )
        const removeSpeechExpired = window.electron.ipcRenderer.on('assistant:speech_expired', () =>
            eventBus.emit('speech-expired', undefined)
        )
        return () => {
            removeWake()
            removeSpeechStart()
            removeSpeechEnd()
            removeSpeechExpired()
            removeThinking()
            removeThinkingEnd()
            removeSpeakingStart()
            removeSpeakingEnd()
            removeError()
            removeServiceStatus()
            removeCleared()
            removeToolCall()
            removeToolResult()
        }
    }, [clearMessages, commitSession, addToolCall, updateToolResult])

    // LLM events only (transcription handled by webkitSpeechRecognition and/or IPC from main)
    useEffect(() => {
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

        const removePartialTranscript = window.electron.ipcRenderer.on(
            'assistant:partial_transcript',
            (_, { text }: { text: string }) => setPartial(text)
        )
        // Final transcript: only display, main process already handles LLM via SpeechSession
        const removeFinalTranscript = window.electron.ipcRenderer.on(
            'assistant:final_transcript',
            (_, { text }: { text: string }) => appendSessionFinal(text)
        )

        return () => {
            removeStreamStart()
            removeToken()
            removeResponse()
            removePartialTranscript()
            removeFinalTranscript()
        }
    }, [
        startAssistantStream,
        appendAssistantToken,
        finalizeAssistantStream,
        setPartial,
        appendSessionFinal
    ])

    return (
        <div className="app">
            <OrbCanvas />
            {startupComplete && (
                <>
                    <ConversationPanel />
                    <SettingsPanel
                        visible={showSettings}
                        onClose={() => setShowSettings(false)}
                        onShow={() => setShowSettings(true)}
                    />
                    <StatusPanel
                        visible={showStatus}
                        onClose={() => setShowStatus(false)}
                        onShow={() => setShowStatus(true)}
                    />
                    {notifications.length > 0 && <NotificationPanel />}
                </>
            )}
        </div>
    )
}

export default App
