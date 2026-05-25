import { execa } from 'execa'
import path from 'path'
import logger from '../../../logger'

let paused = false
const PYTHON = '/data/assistant/.venv/bin/python'

export function pauseWakeWord(): void {
    paused = true
}

export function resumeWakeWord(): void {
    paused = false
}

export function startWakeWord(onDetect: () => void) {
    const script = '/data/assistant/apps/desktop/src/main/wakeword/wake_word_listener.py'

    const model = path.join(process.cwd(), 'resources', 'jarvis.onnx')

    const proc = execa(PYTHON, [script, '--model', model], {
        cwd: '/data/assistant',
        env: {
            ...process.env,
            VIRTUAL_ENV: '/data/assistant/.venv',
            PATH: `/data/assistant/.venv/bin:${process.env.PATH}`
        }
    })

    logger.info('Wake word process started with PID:' + proc.pid)

    proc.stdout?.on('data', (data) => {
        const text = data.toString().trim()

        if (!paused && text === 'DETECTED') {
            onDetect()
        }
    })

    proc.stderr?.on('data', (data) => {
        const errStr = data.toString()
        if (errStr.includes('En écoute...')) {
            logger.info(`Wake word: ${errStr}`)
        } else {
            logger.error('Wake word process error:' + errStr)
        }
        // logger.error(
        //   "Wake word process error:" +
        //   (err instanceof Error
        //     ? err.message
        //     : String(err))
        // )
    })

    proc.catch((err) => {
        logger.error(
            'Wake word process error:' + (err instanceof Error ? err.message : String(err))
        )
    })

    return proc
}
