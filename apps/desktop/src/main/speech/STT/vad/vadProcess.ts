import { execa } from 'execa'
import logger from '../../../logger'

export function startVAD(onEvent: (event: any) => void) {
    const PYTHON = '/data/assistant/.venv/bin/python'

    const script = '/data/assistant/apps/desktop/src/main/vad/vad_listener.py'

    const proc = execa(PYTHON, [script], {
        cwd: '/data/assistant',
        env: {
            ...process.env,
            VIRTUAL_ENV: '/data/assistant/.venv',
            PATH: `/data/assistant/.venv/bin:${process.env.PATH}`
        }
    })

    let buffer = ''

    proc.stdout?.on('data', (data) => {
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
                    '[VAD] JSON parse failed:' + (err instanceof Error ? err.message : String(err))
                )
            }
        }
    })

    return proc
}
