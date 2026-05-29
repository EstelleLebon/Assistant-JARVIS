import { ipcMain } from 'electron'
import {
    stopSpeaking,
    replaySpeak,
    setTTSVolume,
    ttsEvents,
    isTTSPlaying
} from '../speech/TTS/ttsPlayer'
import { handleUserMessage } from '../speech/conversation/responseOrchestrator'
import SpeechSession from '../speech/conversation/SpeechSession'
import logger from '../logger'
import type Conversation from '../speech/conversation/Conversation'
import { pushTask } from '../taskQueue'

interface IpcHandlerDeps {
    conversation: Conversation
    getSpeechSession: () => SpeechSession | null
    setSpeechSession: (s: SpeechSession | null) => void
    emit: (channel: string, payload?: any) => void
    emitToStt: (channel: string) => void
}

interface IpcHandlerResult {
    handleWake: () => void
    handleSttEvent: (type: 'partial' | 'final', text: string) => void
}

export function registerIpcHandlers(deps: IpcHandlerDeps): IpcHandlerResult {
    const { conversation, getSpeechSession, setSpeechSession, emit, emitToStt } = deps

    let micMuted = false
    let startupComplete = false
    let llmBusy = false

    ipcMain.on('app:startup-complete', () => {
        startupComplete = true
        logger.info('[ipc] Startup complete — wake word now active')
    })

    // --- STT event handler (called from Chrome sidecar AND IPC) ---

    function handleWake(): void {
        if (!startupComplete) return
        if (micMuted) return
        if (llmBusy) return
        if (getSpeechSession()?.isActive()) return
        if (isTTSPlaying()) stopSpeaking()

        logger.info('[ipc] Wake word detected')
        emit('assistant:wake')

        const session = new SpeechSession(
            (accumulated) => {
                logger.info('[ipc] Session ended with: ' + accumulated)
                llmBusy = true
                handleUserMessage(accumulated, conversation, emit, () => {
                    llmBusy = false
                    emitToStt('stt:session-end')
                })
            },
            (partial) => {
                emit('assistant:partial_transcript', { text: partial })
            },
            () => {
                logger.info('[ipc] Session expired with no transcript')
                emitToStt('stt:session-end')
                emit('assistant:speech_expired')
            }
        )
        setSpeechSession(session)
        session.start()
        emit('assistant:speech_start')
        emitToStt('stt:session-start')
    }

    function handleSttEvent(type: 'partial' | 'final', text: string): void {
        if (type === 'partial') {
            getSpeechSession()?.onPartial(text)
            return
        }

        if (type === 'final') {
            const session = getSpeechSession()
            if (!session?.isActive()) return
            logger.info('[ipc] STT final: ' + text)
            emit('assistant:final_transcript', { text })
            session.onFinal(text)
        }
    }

    // Expose via IPC as well (for future use / testing)
    ipcMain.on('stt:wake', () => handleWake())
    ipcMain.on('stt:partial', (_e, text: string) => handleSttEvent('partial', text))
    ipcMain.on('stt:final', (_e, text: string) => handleSttEvent('final', text))

    ipcMain.on(
        'stt:log',
        (_e, { level, msg }: { level: 'info' | 'warn' | 'error'; msg: string }) => {
            logger[level]('[STT] ' + msg)
        }
    )

    // --- UI controls ---

    ipcMain.on('ping', () => logger.info('[ipc] pong'))

    ipcMain.on('tts:set-volume', (_, { volume }: { volume: number }) => {
        setTTSVolume(volume)
    })

    ipcMain.on('tts:replay', (_, { text }: { text: string }) => {
        replaySpeak(text)
        ttsEvents.once('speaking-end', () => emit('assistant:speaking_end'))
        emit('assistant:speaking_start')
    })

    ipcMain.on('assistant:user_text', (_e, text: string) => {
        logger.info(`[ipc] User text received: ${text}`)
        handleUserMessage(text, conversation, emit, () => {})
    })

    ipcMain.on('mic:set-muted', (_, { muted }: { muted: boolean }) => {
        micMuted = muted
        logger.info(`[ipc] Mic ${muted ? 'muted' : 'unmuted'}`)
        if (muted) {
            getSpeechSession()?.stop()
            setSpeechSession(null)
            emitToStt('stt:session-end')
        }
    })

    ipcMain.on('conversation:clear', () => {
        logger.info('[ipc] Conversation cleared')
        getSpeechSession()?.stop()
        setSpeechSession(null)
        stopSpeaking()
        const snapshot = conversation.getHistory()
        conversation.clear()
        emitToStt('stt:session-end')
        emit('conversation:cleared')
        pushTask({ type: 'extract-insights', payload: { messages: snapshot } })
    })

    return { handleWake, handleSttEvent }
}
