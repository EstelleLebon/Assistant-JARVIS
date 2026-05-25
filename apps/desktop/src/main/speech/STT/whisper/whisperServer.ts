import logger from '../../../logger'
import pyServer, { PyServerStatus } from '../../../pyServers/pyServer'

export class WhisperServer {
    private pyProc: pyServer | null = null
    private restartAttempts = 0
    private maxRestartAttempts = 5

    public getStatus(): PyServerStatus {
        return this.pyProc ? this.pyProc.status : 'stopped'
    }

    stop() {
        this.maxRestartAttempts = 0 // prevent auto-restart
        this.pyProc?.stop()
        this.pyProc = null
    }

    async start() {
        logger.info('[WhisperServer] Starting Whisper server...')
        this.pyProc = new pyServer(
            '/data/assistant/apps/desktop/src/main/speech/STT/whisper/asr_server.py',
            '/data/assistant/.venv/bin/python',
            [],
            { cwd: '/data/assistant' },
            (data) => {
                const str = data.toString()
                if (str.includes('ASR server started')) {
                    this.pyProc!.status = 'running'
                    this.restartAttempts = 0 // reset attempts on successful start
                    logger.info('[WhisperServer] Whisper server is now running.')
                } else logger.info(`Whisper server: ${str}`)
            },
            (error) => {
                const errStr = error instanceof Error ? error.message : String(error)
                if (errStr.includes('[INFO]')) {
                    logger.info(`[WhisperServer] Whisper server: ${errStr}`)
                } else {
                    logger.error('[WhisperServer] Whisper server process error:' + errStr)
                    this.pyProc!.status = 'error'
                }
            },
            (error) => {
                const errStr = error instanceof Error ? error.message : String(error)
                if (errStr.includes('[INFO]')) {
                    logger.info(`[WhisperServer] Whisper server: ${errStr}`)
                } else {
                    logger.error('[WhisperServer] Whisper server process error:' + errStr)
                    this.pyProc!.status = 'error'
                }
            },
            (code, signal) => {
                logger.info(
                    `[WhisperServer] Whisper server process closed with code ${code} and signal ${signal}`
                )
                // Relance automatique si crash (max tentatives)
                this.pyProc!.status = 'stopped'
                if (code !== 0 && this.restartAttempts < this.maxRestartAttempts) {
                    this.restartAttempts++
                    setTimeout(() => {
                        logger.warn('[WhisperServer] Relance automatique du serveur Whisper...')
                        this.start()
                    }, 2000 * this.restartAttempts) // délai exponentiel
                }
            }
        )
        logger.info('[WhisperServer] Whisper server process initialized, starting...')
        this.pyProc.start()
    }
}

export const whisperServer = new WhisperServer()
