import logger from '../logger'
import { pushTask } from '../taskQueue'
import { recordHeartbeatTimestamp } from './temporalRecovery'

const FAST_INTERVAL_MS = 5_000
const DEFAULT_MEDIUM_INTERVAL_MS = 30_000
const SLOW_INTERVAL_MS = 30 * 60 * 1000

let fastTimer: NodeJS.Timeout | null = null
let mediumTimer: NodeJS.Timeout | null = null
let slowTimer: NodeJS.Timeout | null = null
let paused = false
let slowTickCallback: (() => void) | null = null

function fastTick(): void {
    if (paused) return
    pushTask({ type: 'check-reminders' })
}

function mediumTick(): void {
    if (paused) return
    recordHeartbeatTimestamp()
    pushTask({ type: 'heartbeat' })
}

function slowTick(): void {
    if (paused) return
    slowTickCallback?.()
}

export interface SchedulerOptions {
    mediumIntervalMs?: number
    onSlowTick?: () => void
}

export function startHeartbeatScheduler(opts: SchedulerOptions = {}): void {
    if (fastTimer || mediumTimer) return
    const mediumIntervalMs = opts.mediumIntervalMs ?? DEFAULT_MEDIUM_INTERVAL_MS
    slowTickCallback = opts.onSlowTick ?? null
    fastTimer = setInterval(fastTick, FAST_INTERVAL_MS)
    mediumTimer = setInterval(mediumTick, mediumIntervalMs)
    slowTimer = setInterval(slowTick, SLOW_INTERVAL_MS)
    logger.info(`[heartbeat] Scheduler started (fast: ${FAST_INTERVAL_MS}ms, medium: ${mediumIntervalMs}ms, slow: ${SLOW_INTERVAL_MS}ms)`)
}

export function stopHeartbeatScheduler(): void {
    if (fastTimer) { clearInterval(fastTimer); fastTimer = null }
    if (mediumTimer) { clearInterval(mediumTimer); mediumTimer = null }
    if (slowTimer) { clearInterval(slowTimer); slowTimer = null }
    logger.info('[heartbeat] Scheduler stopped')
}

export function pauseHeartbeat(): void {
    paused = true
}

export function resumeHeartbeat(): void {
    paused = false
}
