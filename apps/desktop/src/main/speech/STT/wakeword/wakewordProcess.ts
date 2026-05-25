import path from 'path'
import logger from '../../../logger'
import pyServer from '../../../pyServers/pyServer'

let paused = false
const PYTHON = '/data/assistant/.venv/bin/python'

export function pauseWakeWord(): void {
    paused = true
}

export function resumeWakeWord(): void {
    paused = false
}

export function startWakeWord(onDetect: () => void) {
    const pyProc = new pyServer(
        '/data/assistant/apps/desktop/src/main/speech/STT/wakeword/wake_word_listener.py',
        PYTHON,
        ['--model', path.join(process.cwd(), 'resources', 'jarvis.onnx')],
        { cwd: '/data/assistant' },
        (data) => {
            const text = data.toString().trim()
            if (!paused && text === 'DETECTED') {
                onDetect()
            }
        },
        (error) => {
            const errStr = error instanceof Error ? error.message : String(error)
            if (errStr.includes('En écoute...')) {
                pyProc!.status = 'running'
                logger.info(`Wake word: ${errStr}`)
            } else {
                logger.error('Wake word process error:' + errStr)
            }
        },
        (error) => {
            const errStr = error instanceof Error ? error.message : String(error)
            logger.error('Wake word process error:' + errStr)
            pyProc!.status = 'error'
        },
        (code, signal) => {
            logger.info(`Wake word process closed with code ${code} and signal ${signal}`)
            pyProc!.status = 'stopped'
        }
    )
    pyProc.start()
    return pyProc
}
