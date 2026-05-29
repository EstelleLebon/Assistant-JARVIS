import path from 'path'
import logger from '../../../logger'
import pyServer from '../../../pyServers/pyServer'
import type { PyServerStatus } from '../../../pyServers/pyServer'

let paused = false
let wakeWordProc: InstanceType<typeof pyServer> | null = null
const PYTHON = '/data/assistant/.venv/bin/python'

export function pauseWakeWord(): void {
    paused = true
}

export function resumeWakeWord(): void {
    paused = false
}

export function stopWakeWord(): void {
    wakeWordProc?.stop()
    wakeWordProc = null
}

export function startWakeWord(onDetect: () => void, onStatus?: (status: PyServerStatus) => void) {
    onStatus?.('starting')

    wakeWordProc = new pyServer(
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
                wakeWordProc!.status = 'running'
                onStatus?.('running')
                logger.info(`Wake word: ${errStr}`)
            } else {
                logger.error('Wake word process error:' + errStr)
            }
        },
        (error) => {
            const errStr = error instanceof Error ? error.message : String(error)
            logger.error('Wake word process error:' + errStr)
            wakeWordProc!.status = 'error'
            onStatus?.('error')
        },
        (code, signal) => {
            logger.info(`Wake word process closed with code ${code} and signal ${signal}`)
            wakeWordProc!.status = 'stopped'
            onStatus?.('stopped')
        }
    )
    wakeWordProc.start()
    return wakeWordProc
}
