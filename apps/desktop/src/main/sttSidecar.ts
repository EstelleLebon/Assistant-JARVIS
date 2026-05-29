import { createServer, IncomingMessage, ServerResponse } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { spawn, ChildProcess } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'
import logger from './logger'

const PORT = 7823
const CHROME_CANDIDATES = [
    'google-chrome',
    'google-chrome-stable',
    'chromium-browser',
    'chromium'
]

type SttEvent = 'wake' | 'partial' | 'final' | 'log-info' | 'log-warn' | 'log-error'

interface SttMessage {
    type: SttEvent
    text?: string
}

export interface ChromeSidecar {
    sessionStart: () => void
    sessionEnd: () => void
    stop: () => void
}

function findChrome(): string | null {
    const { execSync } = require('child_process')
    for (const candidate of CHROME_CANDIDATES) {
        try {
            execSync(`which ${candidate}`, { stdio: 'ignore' })
            return candidate
        } catch {
            // not found, try next
        }
    }
    return null
}

type SidecarStatus = 'connecting' | 'running' | 'error'
const sidecarStatusCallbacks: ((status: SidecarStatus) => void)[] = []

export function onSidecarStatus(cb: (status: SidecarStatus) => void) {
    sidecarStatusCallbacks.push(cb)
}

function emitSidecarStatus(status: SidecarStatus) {
    sidecarStatusCallbacks.forEach((cb) => cb(status))
}

const MAX_RESTARTS = 3

export function startChromeSidecar(
    onEvent: (type: 'partial' | 'final', text: string) => void
): ChromeSidecar {
    let chrome: ChildProcess | null = null
    let activeSocket: WebSocket | null = null
    let restartCount = 0
    let stopped = false

    // Serve the STT page
    const htmlPath = join(__dirname, '../../resources/stt-chrome.html')
    const httpServer = createServer((_req: IncomingMessage, res: ServerResponse) => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(readFileSync(htmlPath))
    })

    // WebSocket server for bidirectional communication
    const wss = new WebSocketServer({ server: httpServer })
    wss.on('connection', (ws) => {
        logger.info('[STT sidecar] Chrome connected via WebSocket')
        activeSocket = ws

        ws.on('message', (raw) => {
            let msg: SttMessage
            try {
                msg = JSON.parse(raw.toString())
            } catch {
                logger.warn('[STT sidecar] Invalid message: ' + raw)
                return
            }

            if (msg.type === 'log-info') { logger.info('[STT chrome] ' + msg.text); return }
            if (msg.type === 'log-warn') { logger.warn('[STT chrome] ' + msg.text); return }
            if (msg.type === 'log-error') { logger.error('[STT chrome] ' + msg.text); return }

            if (msg.type === 'partial' || msg.type === 'final') {
                onEvent(msg.type, msg.text ?? '')
            }
        })

        ws.on('close', () => {
            logger.warn('[STT sidecar] Chrome WebSocket disconnected')
            activeSocket = null
        })

        restartCount = 0
        emitSidecarStatus('running')
    })

    httpServer.listen(PORT, '127.0.0.1', () => {
        logger.info(`[STT sidecar] HTTP+WS server listening on http://localhost:${PORT}`)
        emitSidecarStatus('connecting')
        launchChrome()
    })

    function launchChrome() {
        if (stopped) return
        const bin = findChrome()
        if (!bin) {
            logger.error('[STT sidecar] No Chrome/Chromium found — tried: ' + CHROME_CANDIDATES.join(', '))
            emitSidecarStatus('error')
            return
        }
        logger.info(`[STT sidecar] Launching Chrome: ${bin}`)
        chrome = spawn(bin, [
            `--app=http://localhost:${PORT}`,
            '--window-size=320,80',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-extensions',
            '--start-minimized',
        ], { stdio: 'ignore', detached: false })

        chrome.on('exit', (code) => {
            if (stopped) return
            logger.warn(`[STT sidecar] Chrome exited (code ${code})`)
            chrome = null
            activeSocket = null
            if (restartCount < MAX_RESTARTS) {
                const delay = 1000 * (restartCount + 1)
                restartCount++
                logger.info(`[STT sidecar] Restarting Chrome in ${delay}ms (attempt ${restartCount}/${MAX_RESTARTS})`)
                emitSidecarStatus('connecting')
                setTimeout(launchChrome, delay)
            } else {
                logger.error(`[STT sidecar] Chrome failed ${MAX_RESTARTS} times — giving up`)
                emitSidecarStatus('error')
            }
        })
    }

    function sendToChrome(type: string) {
        if (activeSocket?.readyState === WebSocket.OPEN) {
            try {
                activeSocket.send(JSON.stringify({ type }))
            } catch (e) {
                logger.warn('[STT sidecar] Failed to send to Chrome: ' + String(e))
                activeSocket = null
            }
        } else {
            logger.warn(`[STT sidecar] Cannot send "${type}" — Chrome not connected`)
        }
    }

    return {
        sessionStart: () => sendToChrome('session-start'),
        sessionEnd: () => sendToChrome('session-end'),
        stop: () => {
            stopped = true
            chrome?.kill()
            wss.close()
            httpServer.close()
        }
    }
}
