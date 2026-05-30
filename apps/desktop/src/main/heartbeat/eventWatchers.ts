import logger from '../logger'
import { sendNotification } from '../notifications'
import { queueSpeak } from '../speech/TTS/ttsPlayer'
import { getDueReminders } from './reminderStore'

const INACTIVITY_THRESHOLD_MS = 2 * 60 * 60 * 1000 // 2 hours
const REMINDER_WARN_AHEAD_MS = 10 * 60 * 1000 // 10 minutes

let lastInteractionAt = Date.now()
let inactivityNotified = false
let checkInterval: NodeJS.Timeout | null = null

export function recordInteraction(): void {
    lastInteractionAt = Date.now()
    inactivityNotified = false
}

function checkInactivity(): void {
    if (inactivityNotified) return
    const idleMs = Date.now() - lastInteractionAt
    if (idleMs >= INACTIVITY_THRESHOLD_MS) {
        const message = "Besoin d'aide pour reprendre où on s'était arrêtés ?"
        logger.info('[eventWatcher] Inactivity threshold reached — notifying')
        queueSpeak(message)
        sendNotification('Reprise', message)
        inactivityNotified = true
    }
}

function checkUpcomingReminders(): void {
    const now = Date.now()
    const upcoming = getDueReminders().filter(
        (r) => !r.delivered && r.dueAt > now && r.dueAt - now <= REMINDER_WARN_AHEAD_MS
    )
    for (const r of upcoming) {
        logger.debug(
            `[eventWatcher] Reminder due soon: "${r.text}" in ${Math.round((r.dueAt - now) / 60_000)}min`
        )
    }
}

export function startEventWatchers(): void {
    if (checkInterval) return
    checkInterval = setInterval(() => {
        checkInactivity()
        checkUpcomingReminders()
    }, 60_000)
    logger.info('[eventWatcher] Started')
}

export function stopEventWatchers(): void {
    if (checkInterval) {
        clearInterval(checkInterval)
        checkInterval = null
    }
    logger.info('[eventWatcher] Stopped')
}
