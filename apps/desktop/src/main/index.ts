import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

import icon from '../../resources/icon.png?asset'

import { startWakeWord, pauseWakeWord, resumeWakeWord } from './speech/STT/wakeword/wakewordProcess'

import { startVAD } from './speech/STT/vad/vadProcess'

import {
    connectWhisper,
    sendAudio,
    sendSpeechStart,
    sendSpeechEnd,
    onPartial,
    onFinal
} from './speech/STT/whisper/wsWhisper'

import { startMicrophone } from './speech/STT/audio/microphone'

import logger from './logger'

/*
 * STATES
 */

let assistantAwake = false
let isUserSpeaking = false

let speechEndTimeout: NodeJS.Timeout | null = null

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
    logger.info('\n=== APP READY ===')

    electronApp.setAppUserModelId('com.electron')

    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    ipcMain.on('ping', () => logger.info('pong'))

    createWindow()

    /*
     * VAD
     */

    logger.info('Starting VAD...')

    startVAD((event) => {
        /*
         * SPEECH START
         */

        if (event.type === 'speech_start') {
            isUserSpeaking = true

            if (speechEndTimeout) {
                clearTimeout(speechEndTimeout)

                speechEndTimeout = null
            }

            logger.debug('speech_start detected')

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
            logger.debug('speech_end detected')

            if (speechEndTimeout) {
                clearTimeout(speechEndTimeout)
            }

            speechEndTimeout = setTimeout(() => {
                logger.debug('Speech REALLY ended')

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

    logger.info('Connecting Whisper...')

    await connectWhisper()

    logger.info('Whisper connected')

    onPartial((text) => {
        logger.debug('partial:' + text)

        sendToRenderer('assistant:partial_transcript', {
            text
        })
    })

    onFinal((text) => {
        logger.info('final:' + text)

        sendToRenderer('assistant:final_transcript', {
            text
        })

        /*
         * Back to sleep
         */

        logger.info('Assistant sleeping')

        assistantAwake = false
        isUserSpeaking = false

        resumeWakeWord()
    })

    /*
     * MICROPHONE
     */

    logger.info('Starting microphone...')

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
                'Erreur micro (callback):' + (err instanceof Error ? err.message : String(err))
            )
            // TODO: afficher une notification UI ou fallback
        }
    )

    /*
     * WAKE WORD
     */

    logger.info('Starting wake word...')

    startWakeWord(async () => {
        if (assistantAwake) return

        logger.info('\nWAKE DETECTED')

        assistantAwake = true

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

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
