import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { Transform } from 'stream'
import { EventEmitter } from 'events'
import logger from '../../logger'
import { stripMarkdown } from './stripMarkdown'

export const ttsEvents = new EventEmitter()

const MIN_SOFT_CHARS = 20

export function extractTTSChunks(buffer: string): { chunks: string[]; remaining: string } {
    const chunks: string[] = []
    let segStart = 0
    let i = 0

    while (i < buffer.length) {
        const ch = buffer[i]
        const isHard = '.!?…;'.includes(ch)
        const isSoft = ch === ',' || ch === '—' || ch === '\n'

        if (isHard || (isSoft && i - segStart >= MIN_SOFT_CHARS)) {
            if (isHard) {
                while (i + 1 < buffer.length && '.!?'.includes(buffer[i + 1])) i++
            }
            const next = buffer[i + 1]
            if (next === ' ' || next === '\n') {
                const chunk = buffer.slice(segStart, i + 1).trim()
                if (chunk) chunks.push(chunk)
                i += 2
                segStart = i
                continue
            }
        }
        i++
    }

    return { chunks, remaining: buffer.slice(segStart) }
}

type PiperStatus = 'stopped' | 'starting' | 'running' | 'error'
const piperStatusCallbacks: ((status: PiperStatus) => void)[] = []

export function onPiperStatus(cb: (status: PiperStatus) => void) {
    piperStatusCallbacks.push(cb)
}

function emitPiperStatus(status: PiperStatus) {
    piperStatusCallbacks.forEach((cb) => cb(status))
}

interface TtsConfig {
    piperBin: string
    piperModel: string
    piperLib: string
}

let config: TtsConfig | null = null

export function initTTS(): void {
    const piperBin = '/data/assistant/apps/piper/piper'
    const piperModel = '/data/assistant/apps/piper/voices/fr_FR-siwis-medium.onnx'

    if (!existsSync(piperBin) || !existsSync(piperModel)) {
        logger.error(`[TTS] Piper binary or model not found`)
        emitPiperStatus('error')
        return
    }

    config = {
        piperBin,
        piperModel,
        piperLib: '/data/assistant/apps/piper'
    }
    logger.info(`[TTS] Piper at ${config.piperBin}`)
    emitPiperStatus('running')
}

const queue: string[] = []
let currentProc: ChildProcess | null = null
let isPlaying = false
let ttsVolume = 1.0

export function setTTSVolume(v: number): void {
    ttsVolume = Math.max(0, Math.min(1, v))
}

function createVolumeTransform(): Transform {
    return new Transform({
        transform(chunk: Buffer, _enc, cb) {
            if (ttsVolume === 1.0) {
                cb(null, chunk)
                return
            }
            const out = Buffer.allocUnsafe(chunk.length)
            for (let i = 0; i + 1 < chunk.length; i += 2) {
                const s = Math.max(
                    -32768,
                    Math.min(32767, Math.round(chunk.readInt16LE(i) * ttsVolume))
                )
                out.writeInt16LE(s, i)
            }
            cb(null, out)
        }
    })
}

export function queueSpeak(sentence: string): void {
    const trimmed = stripMarkdown(sentence)
    if (!trimmed) return
    queue.push(trimmed)
    if (!isPlaying) drain()
}

export function replaySpeak(text: string): void {
    stopSpeaking()
    queueSpeak(text)
}

export function isTTSPlaying(): boolean {
    return isPlaying
}

export function stopSpeaking(): void {
    queue.length = 0
    currentProc?.kill()
    currentProc = null
    isPlaying = false
    ttsEvents.emit('speaking-end')
}

function drain(): void {
    if (isPlaying || queue.length === 0) return
    if (!config) {
        logger.error('[TTS] initTTS() not called')
        return
    }

    const wasIdle = !isPlaying
    isPlaying = true
    if (wasIdle) ttsEvents.emit('speaking-start')
    const text = queue.shift()!

    logger.debug(`[TTS] Speaking: "${text}"`)

    // Piper reads text on stdin, emits raw PCM on stdout → pipe to aplay
    const piper = spawn(config.piperBin, ['--model', config.piperModel, '--output-raw'], {
        env: { ...process.env, LD_LIBRARY_PATH: config.piperLib }
    })

    const aplay = spawn('aplay', ['-r', '22050', '-f', 'S16_LE', '-c', '1', '-'])

    piper.stdout.pipe(createVolumeTransform()).pipe(aplay.stdin)
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
        emitPiperStatus('error')
        aplay.kill()
        isPlaying = false
        currentProc = null
        if (queue.length > 0) drain()
        else ttsEvents.emit('speaking-end')
    })

    aplay.on('error', (err) => {
        logger.error('[TTS] aplay error: ' + err.message)
        isPlaying = false
        currentProc = null
        if (queue.length > 0) drain()
        else ttsEvents.emit('speaking-end')
    })
}
