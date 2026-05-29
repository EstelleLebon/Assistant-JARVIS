import logger from '../logger'
import { pushTask } from '../taskQueue'
import { recordHeartbeatTimestamp } from './temporalRecovery'

const FAST_INTERVAL_MS = 5_000
const DEFAULT_MEDIUM_INTERVAL_MS = 30_000

let fastTimer: NodeJS.Timeout | null = null
let mediumTimer: NodeJS.Timeout | null = null
let paused = false

function fastTick(): void {
    if (paused) return
    pushTask({ type: 'check-reminders' })
}

function mediumTick(): void {
    if (paused) return
    recordHeartbeatTimestamp()
    pushTask({ type: 'heartbeat' })
}

export function startHeartbeatScheduler(mediumIntervalMs = DEFAULT_MEDIUM_INTERVAL_MS): void {
    if (fastTimer || mediumTimer) return
    fastTimer = setInterval(fastTick, FAST_INTERVAL_MS)
    mediumTimer = setInterval(mediumTick, mediumIntervalMs)
    logger.info(`[heartbeat] Scheduler started (fast: ${FAST_INTERVAL_MS}ms, medium: ${mediumIntervalMs}ms)`)
}

export function stopHeartbeatScheduler(): void {
    if (fastTimer) { clearInterval(fastTimer); fastTimer = null }
    if (mediumTimer) { clearInterval(mediumTimer); mediumTimer = null }
    logger.info('[heartbeat] Scheduler stopped')
}

export function pauseHeartbeat(): void {
    paused = true
}

export function resumeHeartbeat(): void {
    paused = false
}
