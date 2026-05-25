import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import logger from '../../logger'
import { stripMarkdown } from './stripMarkdown'

export const ttsEvents = new EventEmitter()

interface TtsConfig {
    piperBin: string
    piperModel: string
    piperLib: string
}

let config: TtsConfig | null = null

export function initTTS(): void {
    config = {
        piperBin: '/data/assistant/apps/piper/piper',
        piperModel: '/data/assistant/apps/piper/voices/fr_FR-siwis-medium.onnx',
        piperLib: '/data/assistant/apps/piper'
    }
    logger.info(`[TTS] Piper at ${config.piperBin}`)
}

const queue: string[] = []
let currentProc: ChildProcess | null = null
let isPlaying = false

export function queueSpeak(sentence: string): void {
    const trimmed = stripMarkdown(sentence)
    if (!trimmed) return
    queue.push(trimmed)
    if (!isPlaying) drain()
}

export function stopSpeaking(): void {
    queue.length = 0
    currentProc?.kill()
    currentProc = null
    isPlaying = false
}

function drain(): void {
    if (isPlaying || queue.length === 0) return
    if (!config) {
        logger.error('[TTS] initTTS() not called')
        return
    }

    isPlaying = true
    const text = queue.shift()!

    logger.debug(`[TTS] Speaking: "${text}"`)

    // Piper reads text on stdin, emits raw PCM on stdout → pipe to aplay
    const piper = spawn(config.piperBin, ['--model', config.piperModel, '--output-raw'], {
        env: { ...process.env, LD_LIBRARY_PATH: config.piperLib }
    })

    const aplay = spawn('aplay', ['-r', '22050', '-f', 'S16_LE', '-c', '1', '-'])

    piper.stdout.pipe(aplay.stdin)
    piper.stdin.write(text)
    piper.stdin.end()

    piper.stderr.on('data', (d) => logger.debug('[TTS/piper] ' + d.toString().trim()))
    aplay.stderr.on('data', (d) => logger.debug('[TTS/aplay] ' + d.toString().trim()))

    currentProc = aplay

    aplay.on('close', () => {
        currentProc = null
        isPlaying = false

        if (queue.length > 0) {
            drain()
        } else {
            ttsEvents.emit('speaking-end')
        }
    })

    piper.on('error', (err) => {
        logger.error('[TTS] piper error: ' + err.message)
        aplay.kill()
    })

    aplay.on('error', (err) => {
        logger.error('[TTS] aplay error: ' + err.message)
        isPlaying = false
        currentProc = null
        if (queue.length > 0) drain()
        else ttsEvents.emit('speaking-end')
    })
}
