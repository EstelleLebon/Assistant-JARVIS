import { app, shell, BrowserWindow, session, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

import icon from '../../resources/icon.png?asset'

import logger from './logger'
import { initTTS, stopSpeaking, onPiperStatus, ttsEvents, isTTSPlaying, queueSpeak } from './speech/TTS/ttsPlayer'
import Conversation from './speech/conversation/Conversation'
import SpeechSession from './speech/conversation/SpeechSession'
import { flushServiceStatuses, updateServiceStatus } from './serviceStatus'
import { registerIpcHandlers } from './ipc/handlers'
import { startTokenizerServer, stopTokenizerServer } from './llm/tokenizerServerInstance'
import { startChromeSidecar, onSidecarStatus } from './sttSidecar'
import type { ChromeSidecar } from './sttSidecar'
import { startWakeWord, pauseWakeWord, resumeWakeWord, stopWakeWord } from './speech/STT/wakeword/wakewordProcess'
import { ensureToolServers, stopToolServers } from './tools/toolsServerManager'
import { startTaskQueue, drainAndStop, pushTask } from './taskQueue'
import { startHeartbeatScheduler, stopHeartbeatScheduler, pauseHeartbeat, resumeHeartbeat } from './heartbeat/scheduler'
import { checkTemporalRecovery, recordHeartbeatTimestamp } from './heartbeat/temporalRecovery'
import { configureAttentionEngine } from './heartbeat/attentionEngine'
import { initNotifications, sendNotification } from './notifications'

let speechSession: SpeechSession | null = null
let sidecar: ChromeSidecar | null = null
let recoveryGapMs = 0

const conversation = new Conversation()

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
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false
        }
    })

    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
        callback(permission === 'media')
    })

    mainWindow.on('ready-to-show', () => mainWindow.show())
    mainWindow.on('closed', () => app.quit())
    mainWindow.webContents.on('did-finish-load', () => {
        flushServiceStatuses()
        if (recoveryGapMs > 0) {
            sendToRenderer('service:recovery', { gapMs: recoveryGapMs })
        }
    })
    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
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

function sendToStt(channel: string) {
    if (channel === 'stt:session-start') sidecar?.sessionStart()
    if (channel === 'stt:session-end') sidecar?.sessionEnd()
}

app.whenReady().then(async () => {
    startTokenizerServer()
    electronApp.setAppUserModelId('com.electron')
    initTTS()

    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    configureAttentionEngine(() => (speechSession?.isActive() ?? false) || isTTSPlaying())
    initNotifications(sendToRenderer)
    startTaskQueue(sendToRenderer, (text) => queueSpeak(text))

    const recovery = checkTemporalRecovery()
    recoveryGapMs = recovery.gapMs
    recordHeartbeatTimestamp()
    startHeartbeatScheduler()

    if (recovery.hadGap) {
        ipcMain.once('app:startup-complete', () => {
            const minutes = Math.round(recoveryGapMs / 60_000)
            sendNotification('Reprise', `Jarvis était hors-ligne depuis ${minutes} min.`)
        })
    }

    const { handleWake, handleSttEvent } = registerIpcHandlers({
        conversation,
        getSpeechSession: () => speechSession,
        setSpeechSession: (s) => {
            speechSession = s
        },
        emit: sendToRenderer,
        emitToStt: sendToStt
    })

    onPiperStatus((status) => updateServiceStatus('piper', status))
    ttsEvents.on('speaking-start', () => {
        pauseHeartbeat()
        try { pauseWakeWord() } catch (e) { logger.error('[MAIN] pauseWakeWord failed: ' + String(e)) }
    })
    ttsEvents.on('speaking-end', () => {
        resumeHeartbeat()
        try { resumeWakeWord() } catch (e) { logger.error('[MAIN] resumeWakeWord failed: ' + String(e)) }
    })

    sidecar = startChromeSidecar(handleSttEvent)
    onSidecarStatus((status) => updateServiceStatus('chrome-stt', status))

    startWakeWord(
        () => handleWake(),
        (status) => updateServiceStatus('wakeword', status)
    )

    ensureToolServers().catch((err) =>
        logger.error('[MAIN] Failed to start tool servers: ' + String(err))
    )

    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('before-quit', (event) => {
    event.preventDefault()
    logger.info('[MAIN] Shutting down...')
    stopHeartbeatScheduler()
    stopSpeaking()
    stopWakeWord()
    sidecar?.stop()

    const snapshot = conversation.getHistory()
    if (snapshot.length > 0) {
        pushTask({ type: 'extract-insights', payload: { messages: snapshot } })
    }

    drainAndStop().then(() => {
        stopToolServers()
        stopTokenizerServer()
        logger.info('[MAIN] Cleanup done')
        app.exit(0)
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
