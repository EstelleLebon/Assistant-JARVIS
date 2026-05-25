import logger from '../../../logger'

export class WhisperServer {
    private status: 'stopped' | 'starting' | 'running' = 'stopped'

    public getStatus() {
        return this.status
    }

    async start() {
        logger.info('Starting Whisper server...')
        if (this.status !== 'stopped') return

        this.status = 'starting'
        /*
         * Start Python server
         */
        const { spawn } = await import('child_process')
        // Utilise le venv Python et le bon chemin du serveur
        const pythonPath = '/data/assistant/.venv/bin/python'
        const serverPath = '/data/assistant/apps/desktop/src/main/speech/STT/whisper/asr_server.py'
        const proc = spawn(pythonPath, ['-u', serverPath], {
            cwd: '/data/assistant',
            env: {
                ...process.env,
                VIRTUAL_ENV: '/data/assistant/.venv',
                PATH: `/data/assistant/.venv/bin:${process.env.PATH}`
            }
        })

        proc.stdout.on('data', (data) => {
            const str = data.toString()
            logger.info(`Whisper server: ${str}`)
            if (str.includes('ASR server started')) {
                this.status = 'running'
            }
        })

        proc.stderr.on('data', (data) => {
            const errStr = data.toString()
            if (errStr.includes('[INFO]')) {
                logger.info(`Whisper server: ${errStr}`)
            } else {
                logger.error('Whisper server process error:' + errStr)
                // TODO: notifier UI ou log fichier
            }
        })

        proc.on('error', (err) => {
            const errStr = err instanceof Error ? err.message : String(err)
            if (errStr.includes('[INFO]')) {
                logger.info(`Whisper server: ${errStr}`)
            } else {
                logger.error('Whisper server process error:' + errStr)
                this.status = 'stopped'
            }
            // logger.error('Whisper server process error:' +
            //     (err instanceof Error
            //       ? err.message
            //       : String(err)))
            // TODO: notifier UI ou fallback
        })

        proc.on('close', (code) => {
            logger.info(`Whisper server process closed with code ${code}`)
            this.status = 'stopped'
            // Relance automatique si crash (max tentatives)
            if (code !== 0) {
                // Optionnel: limiter le nombre de relances
                setTimeout(() => {
                    logger.warn('Relance automatique du serveur Whisper...')
                    this.start()
                }, 2000)
            }
        })
    }
}

export const whisperServer = new WhisperServer()
