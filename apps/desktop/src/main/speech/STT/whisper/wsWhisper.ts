import WebSocket from 'ws'
import logger from '../../../logger'
import { whisperServer } from './whisperServer'

let ws: WebSocket | null = null
let wsReconnectAttempts = 0
const WS_MAX_RECONNECT = 5
const WS_RECONNECT_BASE_DELAY = 1000 // ms

const partialCallbacks: ((text: string) => void)[] = []
const finalCallbacks: ((text: string) => void)[] = []

let pendingWakeWord: string | null = null

export function injectWakeWord(word: string): void {
    pendingWakeWord = word
}

// The audio stream always starts with the wake word utterance, so the first
// token from Whisper is always some transcription of it — strip it unconditionally.
function stripFirstToken(text: string): string {
    return text.replace(/^\S+[,\s]*/, '').trim()
}

export async function connectWhisper() {
    if (ws && ws.readyState === WebSocket.OPEN) return

    if (whisperServer.getStatus() === 'stopped') {
        try {
            await whisperServer.start()
        } catch (err) {
            logger.error(
                'Erreur lancement serveur Whisper:' +
                    (err instanceof Error ? err.message : String(err))
            )
            throw err
        }
    }

    while (whisperServer.getStatus() !== 'running') {
        await new Promise((r) => setTimeout(r, 100))
    }

    const connectWS = () => {
        logger.info('Connecting Whisper WS...')
        ws = new WebSocket('ws://localhost:8765')

        ws.on('open', () => {
            wsReconnectAttempts = 0
            logger.info('Connected to ASR server')
        })

        ws.on('error', (err) => {
            logger.error('WebSocket error:' + (err instanceof Error ? err.message : String(err)))
        })

        ws.on('close', (code, reason) => {
            logger.warn('WebSocket closed: ' + code + ' ' + reason.toString())
            if (wsReconnectAttempts < WS_MAX_RECONNECT) {
                wsReconnectAttempts++
                const delay = WS_RECONNECT_BASE_DELAY * wsReconnectAttempts
                logger.info(`Tentative de reconnexion WebSocket dans ${delay}ms...`)
                setTimeout(connectWS, delay)
            } else {
                logger.error('WebSocket: échec de reconnexion après plusieurs tentatives.')
                // TODO: notifier UI ou fallback
            }
        })

        ws.on('message', (data) => {
            try {
                const json = JSON.parse(data.toString())
                if (json.type === 'partial') {
                    const clean = pendingWakeWord ? stripFirstToken(json.text) : json.text
                    const text = pendingWakeWord ? `${pendingWakeWord}, ${clean}` : clean
                    partialCallbacks.forEach((cb) => cb(text))
                }
                if (json.type === 'final') {
                    const clean = pendingWakeWord ? stripFirstToken(json.text) : json.text
                    const text = pendingWakeWord ? `${pendingWakeWord}, ${clean}` : clean
                    pendingWakeWord = null
                    finalCallbacks.forEach((cb) => cb(text.trim()))
                }
            } catch (e) {
                logger.error('WS parse error:' + (e instanceof Error ? e.message : String(e)))
            }
        })
    }

    connectWS()
}

/*
 * AUDIO
 */

export function sendAudio(samples: Float32Array) {
    if (!ws) return

    if (ws.readyState !== WebSocket.OPEN) {
        return
    }

    ws.send(Buffer.from(samples.buffer))
}

/*
 * EVENTS
 */

export function sendSpeechStart() {
    if (!ws) return

    logger.debug('WS -> speech_start')

    ws.send(
        JSON.stringify({
            type: 'speech_start',
            ...(pendingWakeWord ? { initial_prompt: pendingWakeWord, reset: true } : {})
        })
    )
}

export function sendSpeechEnd() {
    if (!ws) return

    logger.debug('WS -> speech_end')

    ws.send(
        JSON.stringify({
            type: 'speech_end'
        })
    )
}

/*
 * CALLBACKS
 */

export function onPartial(callback: (text: string) => void) {
    partialCallbacks.push(callback)
}

export function onFinal(callback: (text: string) => void) {
    finalCallbacks.push(callback)
}

export function disconnectWhisper() {
    if (ws) {
        ws.removeAllListeners()
        ws.close()
        ws = null
    }
    whisperServer.stop()
}
