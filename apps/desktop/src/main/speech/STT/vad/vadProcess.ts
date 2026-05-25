import pyServer from '../../../pyServers/pyServer'
import logger from '../../../logger'

export function startVAD(onEvent: (event: any) => void) {
    const PYTHON = '/data/assistant/.venv/bin/python'

    const script = '/data/assistant/apps/desktop/src/main/speech/STT/vad/vad_listener.py'

    let buffer = ''

    const proc = new pyServer(
        script,
        PYTHON,
        [],
        { cwd: '/data/assistant' },
        (data) => {
            buffer += data.toString()
            const lines = buffer.split('\n')

            buffer = lines.pop() || ''

            for (const line of lines) {
                if (!line.trim()) {
                    continue
                }

                try {
                    const event = JSON.parse(line)

                    onEvent(event)
                } catch (err) {
                    logger.error(
                        '[VAD] JSON parse failed:' +
                            (err instanceof Error ? err.message : String(err))
                    )
                }
            }
        },
        (error) => {
            const errStr = error instanceof Error ? error.message : String(error)
            logger.error('VAD process error:' + errStr)
        },
        (error) => {
            const errStr = error instanceof Error ? error.message : String(error)
            logger.error('VAD process error:' + errStr)
        },
        (code, signal) => {
            logger.info(`VAD process closed with code ${code} and signal ${signal}`)
        }
    )

    proc.start()

    return proc
}
