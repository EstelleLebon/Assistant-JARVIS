import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

import icon from '../../resources/icon.png?asset'

import { startWakeWord, pauseWakeWord, resumeWakeWord } from './speech/STT/wakeword/wakewordProcess'

import { startVAD } from './speech/STT/vad/vadProcess'

import {
    connectWhisper,
    disconnectWhisper,
    sendAudio,
    sendSpeechStart,
    sendSpeechEnd,
    onPartial,
    onFinal,
    injectWakeWord
} from './speech/STT/whisper/wsWhisper'

import { startMicrophone } from './speech/STT/audio/microphone'

import logger from './logger'
import { askOllamaStream } from './llm/ollamaClient'
import { initTTS, queueSpeak, stopSpeaking, ttsEvents } from './speech/TTS/ttsPlayer'

/*
 * TTS chunk extraction
 * Hard split: . ! ? … ; followed by space
 * Soft split: , — \n only if segment >= MIN_SOFT_CHARS
 */
const MIN_SOFT_CHARS = 20

function extractTTSChunks(buffer: string): { chunks: string[]; remaining: string } {
    const chunks: string[] = []
    let segStart = 0
    let i = 0

    while (i < buffer.length) {
        const ch = buffer[i]
        const isHard = '.!?…;'.includes(ch)
        const isSoft = ch === ',' || ch === '—' || ch === '\n'

        if (isHard || (isSoft && i - segStart >= MIN_SOFT_CHARS)) {
            // consume consecutive punctuation (e.g. "..." or "!!")
            if (isHard) {
                while (i + 1 < buffer.length && '.!?'.includes(buffer[i + 1])) i++
            }

            const next = buffer[i + 1]
            // only split if there's content after (don't split at end of buffer)
            if (next === ' ' || next === '\n') {
                const chunk = buffer.slice(segStart, i + 1).trim()
                if (chunk) chunks.push(chunk)
                i += 2
                segStart = i
                continue
            }
        }

        i++
    }

    return { chunks, remaining: buffer.slice(segStart) }
}

/*
 * STATES
 */

let assistantAwake = false
let isUserSpeaking = false

let vadProc: import('./pyServers/pyServer').default | null = null
let wakeWordProc: import('./pyServers/pyServer').default | null = null

let speechEndTimeout: NodeJS.Timeout | null = null

type ConversationMessage = { role: 'user' | 'assistant'; content: string }
const conversationHistory: ConversationMessage[] = []

function createWindow(): void {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,

        fullscreen: false,
        frame: true,

        autoHideMenuBar: true,
        backgroundColor: '#000000',

        show: false,

        ...(process.platform === 'linux' ? { icon } : {}),

        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false
        }
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)

        return {
            action: 'deny'
        }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

function sendToRenderer(channel: string, payload?: any) {
    BrowserWindow.getAllWindows()[0]?.webContents.send(channel, payload)
}

app.whenReady().then(async () => {
    electronApp.setAppUserModelId('com.electron')
    initTTS()

    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    ipcMain.on('ping', () => logger.info('[MAIN.index] pong'))

    createWindow()

    /*
     * VAD
     */

    logger.info('[MAIN.index] Starting VAD...')

    const vadProc = startVAD((event) => {
        /*
         * SPEECH START
         */

        if (event.type === 'speech_start') {
            isUserSpeaking = true

            if (speechEndTimeout) {
                clearTimeout(speechEndTimeout)

                speechEndTimeout = null
            }

            logger.debug('[MAIN.index] speech_start detected')

            /*
             * IMPORTANT
             * notify python
             */

            sendSpeechStart()

            if (assistantAwake) {
                sendToRenderer('assistant:speech_start')
            }

            return
        }

        /*
         * SPEECH END
         */

        if (event.type === 'speech_end') {
            logger.debug('[MAIN.index] speech_end detected')

            if (speechEndTimeout) {
                clearTimeout(speechEndTimeout)
            }

            speechEndTimeout = setTimeout(() => {
                logger.debug('[MAIN.index] Speech REALLY ended')

                isUserSpeaking = false

                /*
                 * IMPORTANT
                 * notify python
                 */

                sendSpeechEnd()

                if (assistantAwake) {
                    sendToRenderer('assistant:speech_end')
                }
            }, 1200)

            return
        }
    })

    /*
     * WHISPER
     */

    logger.info('[MAIN.index] Connecting Whisper...')

    await connectWhisper()

    logger.info('[MAIN.index] Whisper connected')

    onPartial((text) => {
        logger.debug('[MAIN.index] partial:' + text)

        sendToRenderer('assistant:partial_transcript', {
            text
        })
    })

    onFinal(async (text) => {
        logger.info('[MAIN.index] final:' + text)

        sendToRenderer('assistant:final_transcript', { text })

        conversationHistory.push({ role: 'user', content: text })

        sendToRenderer('assistant:thinking_start')

        try {
            let sentenceBuffer = ''
            let firstToken = true

            const reply = await askOllamaStream([...conversationHistory], (token) => {
                if (firstToken) {
                    sendToRenderer('assistant:llm_stream_start')
                    firstToken = false
                }

                sendToRenderer('assistant:llm_token', { token })

                sentenceBuffer += token

                const { chunks, remaining } = extractTTSChunks(sentenceBuffer)
                for (const chunk of chunks) queueSpeak(chunk)
                sentenceBuffer = remaining
            })

            // Flush any remaining text as the last TTS chunk
            if (sentenceBuffer.trim()) {
                queueSpeak(sentenceBuffer.trim())
            }

            conversationHistory.push({ role: 'assistant', content: reply })
            sendToRenderer('assistant:llm_response', { text: reply })

            // Wait for TTS to finish before resuming wake word
            ttsEvents.once('speaking-end', () => {
                sendToRenderer('assistant:speaking_end')
                logger.info('[MAIN.index] TTS done — assistant sleeping')
                assistantAwake = false
                isUserSpeaking = false
                resumeWakeWord()
            })

            sendToRenderer('assistant:speaking_start')
        } catch (err) {
            logger.error('[MAIN.index] Ollama error: ' + String(err))
            stopSpeaking()
            sendToRenderer('assistant:llm_error', { message: String(err) })
            assistantAwake = false
            isUserSpeaking = false
            resumeWakeWord()
        }
    })

    /*
     * MICROPHONE
     */

    logger.info('[MAIN.index] Starting microphone...')

    startMicrophone(
        (samples) => {
            // Must be awake
            if (!assistantAwake) return
            // Stop streaming after REAL speech end
            if (!isUserSpeaking) {
                return
            }
            sendAudio(samples)
        },
        (err) => {
            sendToRenderer('assistant:microphone_error', { message: err.message })
            logger.error(
                '[MAIN.index] Erreur micro (callback):' +
                    (err instanceof Error ? err.message : String(err))
            )
            // TODO: afficher une notification UI ou fallback
        }
    )

    /*
     * WAKE WORD
     */

    logger.info('[MAIN.index] Starting wake word...')

    const wakeWordProc = startWakeWord(async () => {
        if (assistantAwake) return

        logger.info('[MAIN.index] \nWAKE DETECTED')

        assistantAwake = true
        injectWakeWord('Jarvis')

        pauseWakeWord()

        sendToRenderer('assistant:wake')

        /*
         * Inject Jarvis
         */

        sendToRenderer('assistant:partial_transcript', {
            text: 'Jarvis'
        })
    })

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('before-quit', () => {
    logger.info('[MAIN.index] Shutting down...')
    stopSpeaking()
    disconnectWhisper()
    vadProc?.stop()
    wakeWordProc?.stop()
    logger.info('[MAIN.index] Cleanup done')
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
