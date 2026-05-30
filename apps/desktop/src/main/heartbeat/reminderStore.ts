import { join } from 'path'
import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import logger from '../logger'

export interface Reminder {
    id: string
    text: string
    dueAt: number
    createdAt: number
    delivered: boolean
}

function filePath(): string {
    return join(app.getPath('userData'), 'reminders.json')
}

function loadAll(): Reminder[] {
    try {
        return JSON.parse(readFileSync(filePath(), 'utf-8'))
    } catch {
        return []
    }
}

function saveAll(reminders: Reminder[]): void {
    try {
        writeFileSync(filePath(), JSON.stringify(reminders, null, 2))
    } catch (err) {
        logger.warn('[reminderStore] Could not save: ' + String(err))
    }
}

export function addReminder(text: string, dueAt: number): Reminder {
    const reminders = loadAll()
    const reminder: Reminder = {
        id: randomUUID(),
        text,
        dueAt,
        createdAt: Date.now(),
        delivered: false
    }
    reminders.push(reminder)
    saveAll(reminders)
    logger.info(`[reminderStore] Added: "${text}" due at ${new Date(dueAt).toISOString()}`)
    return reminder
}

export function getDueReminders(): Reminder[] {
    const now = Date.now()
    return loadAll().filter((r) => !r.delivered && r.dueAt <= now)
}

export function markDelivered(id: string): void {
    const reminders = loadAll()
    const r = reminders.find((r) => r.id === id)
    if (r) {
        r.delivered = true
        saveAll(reminders)
    }
}

export function getPendingReminders(): Reminder[] {
    return loadAll().filter((r) => !r.delivered)
}

export function deleteReminder(id: string): boolean {
    const reminders = loadAll()
    const idx = reminders.findIndex((r) => r.id === id)
    if (idx === -1) return false
    reminders.splice(idx, 1)
    saveAll(reminders)
    logger.info(`[reminderStore] Deleted reminder ${id}`)
    return true
}
