import { useEffect, useState } from 'react'
import OrbCanvas from './orb/OrbCanvas'
import useSessionStore from './store/sessionStore'
import useNotificationStore from './store/notificationStore'
import ConversationPanel from './components/panels/ConversationView/ConversationPanel'
import NotificationPanel from './components/panels/NotificationPanel'
import SettingsPanel from './components/panels/SettingsPanel'
import StatusPanel from './components/panels/StatusPanel/StatusPanel'
import ToolPanelContainer from './components/panels/ToolPanels/ToolPanelContainer'
import useToolPanelStore from './store/toolPanelStore'
import { eventBus } from './runtime/event-bus'
import { runtimeState } from './runtime/runtime-state'
import type { ServiceName, ServiceStatus } from './runtime/runtime-state'
import { orbController } from './orb/OrbController'

function App() {
    const [showSettings, setShowSettings] = useState(true)
    const [showStatus, setShowStatus] = useState(true)
    const [startupComplete, setStartupComplete] = useState(false)
    const { addNotification, notifications } = useNotificationStore()
    const { addToolPanel } = useToolPanelStore()
    const {
        setPartial,
        appendSessionFinal,
        commitSession,
        startAssistantStream,
        appendAssistantToken,
        finalizeAssistantStream,
        addToolCall,
        updateToolResult,
        addAssistantMessage,
        setError,
        clearMessages,
        setLlmQueued
    } = useSessionStore()

    useEffect(() => {
        const unsubStartup = eventBus.on('startup-complete', () => {
            setStartupComplete(true)
            window.jarvis.notifyStartupComplete()
        })
        const removeNotification = window.jarvis.onNotification(addNotification)
        return () => {
            unsubStartup()
            removeNotification?.()
        }
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
            setLlmQueued(false)
            eventBus.emit('thinking-start', undefined)
        })
        const removeLlmQueued = window.electron.ipcRenderer.on('assistant:llm_queued', () => {
            setLlmQueued(true)
        })
        const removeThinkingEnd = window.electron.ipcRenderer.on('assistant:llm_response', () =>
            eventBus.emit('thinking-end', undefined)
        )
        const removeSpeakingStart = window.electron.ipcRenderer.on(
            'assistant:speaking_start',
            () => {
                console.log(
                    '[App:DEBUG] IPC assistant:speaking_start received → emitting speaking-start'
                )
                eventBus.emit('speaking-start', undefined)
                runtimeState.setState({
                    serviceStatus: { ...runtimeState.getState().serviceStatus, piper: 'running' }
                })
            }
        )
        const removeSpeakingEnd = window.electron.ipcRenderer.on('assistant:speaking_end', () => {
            console.log('[App:DEBUG] IPC assistant:speaking_end received → emitting speaking-end')
            eventBus.emit('speaking-end', undefined)
            runtimeState.setState({
                serviceStatus: { ...runtimeState.getState().serviceStatus, piper: 'stopped' }
            })
        })
        const removeError = window.electron.ipcRenderer.on(
            'assistant:llm_error',
            (_, { message }: { message: string }) => {
                setLlmQueued(false)
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
            (
                _,
                { id, tool, args }: { id: number; tool: string; args: Record<string, unknown> }
            ) => {
                addToolCall(id, tool, args)
                eventBus.emit('tool-running', { tool })
            }
        )
        const removeToolResult = window.electron.ipcRenderer.on(
            'assistant:tool_result',
            (
                _,
                {
                    id,
                    tool,
                    result,
                    panel
                }: {
                    id: number
                    tool: string
                    result: string
                    panel?: { type: string; data: unknown }
                }
            ) => {
                updateToolResult(id, result)
                if (panel) addToolPanel(id, tool, panel.type, panel.data)
                eventBus.emit('tool-finished', { tool })
            }
        )
        const removeSpeechExpired = window.electron.ipcRenderer.on(
            'assistant:speech_expired',
            () => {
                setLlmQueued(false)
                eventBus.emit('speech-expired', undefined)
            }
        )
        const removeInsights = window.electron.ipcRenderer.on(
            'conversation:insights',
            (_, { count, entries }: { count: number; entries: unknown[] }) => {
                console.log(`[insights] ${count} memoire(s) extraite(s)`, entries)
            }
        )
        const removeReminder = window.electron.ipcRenderer.on(
            'assistant:reminder',
            (_, { text }: { text: string }) => addAssistantMessage(`⏰ Rappel : ${text}`)
        )
        return () => {
            removeWake()
            removeSpeechStart()
            removeSpeechEnd()
            removeSpeechExpired()
            removeInsights()
            removeReminder()
            removeThinking()
            removeLlmQueued()
            removeThinkingEnd()
            removeSpeakingStart()
            removeSpeakingEnd()
            removeError()
            removeServiceStatus()
            removeCleared()
            removeToolCall()
            removeToolResult()
        }
    }, [
        clearMessages,
        commitSession,
        addToolCall,
        updateToolResult,
        addToolPanel,
        addNotification,
        addAssistantMessage,
        setLlmQueued
    ])

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

        const removeAudioLevel = window.jarvis.onAudioLevel((level) =>
            orbController.setVolume(level)
        )

        return () => {
            removeStreamStart()
            removeToken()
            removeResponse()
            removePartialTranscript()
            removeFinalTranscript()
            removeAudioLevel()
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
                    <ToolPanelContainer />
                </>
            )}
        </div>
    )
}

export default App
