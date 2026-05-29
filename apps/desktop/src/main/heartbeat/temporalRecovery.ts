import { join } from 'path'
import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import logger from '../logger'

const GAP_THRESHOLD_MS = 5 * 60 * 1000

function filePath(): string {
    return join(app.getPath('userData'), 'heartbeat-last-seen.json')
}

export function recordHeartbeatTimestamp(): void {
    try {
        writeFileSync(filePath(), JSON.stringify({ lastSeen: Date.now() }))
    } catch (err) {
        logger.warn('[heartbeat] Could not write timestamp: ' + String(err))
    }
}

export interface TemporalRecovery {
    hadGap: boolean
    gapMs: number
}

export function checkTemporalRecovery(): TemporalRecovery {
    try {
        const { lastSeen } = JSON.parse(readFileSync(filePath(), 'utf-8'))
        const gapMs = Date.now() - lastSeen
        const hadGap = gapMs > GAP_THRESHOLD_MS
        if (hadGap) {
            logger.info(`[heartbeat] Gap detected: ${Math.round(gapMs / 60_000)}min since last seen`)
        }
        return { hadGap, gapMs }
    } catch {
        return { hadGap: false, gapMs: 0 }
    }
}
