import type { FastifyInstance } from 'fastify'
import { google } from 'googleapis'
import { ok } from '../types/api.js'
import { createOAuth2Client, hasToken } from '../oauth.js'
import db from '../db.js'

type DepStatus = { status: 'ok' | 'degraded' | 'error'; message?: string }

async function checkGoogleOAuth(): Promise<DepStatus> {
    if (!hasToken()) return { status: 'error', message: 'No token stored' }
    try {
        const auth = createOAuth2Client()
        await auth.getAccessToken()
        return { status: 'ok' }
    } catch (e: any) {
        return { status: 'error', message: e.message }
    }
}

async function checkGoogleCalendar(auth: ReturnType<typeof createOAuth2Client>): Promise<DepStatus> {
    try {
        const cal = google.calendar({ version: 'v3', auth })
        await cal.calendarList.list({ maxResults: 1 })
        return { status: 'ok' }
    } catch (e: any) {
        return { status: 'error', message: e.message }
    }
}

async function checkGoogleTasks(auth: ReturnType<typeof createOAuth2Client>): Promise<DepStatus> {
    try {
        const tasks = google.tasks({ version: 'v1', auth })
        await tasks.tasklists.list({ maxResults: 1 })
        return { status: 'ok' }
    } catch (e: any) {
        return { status: 'error', message: e.message }
    }
}

function checkSqlite(): DepStatus {
    try {
        db.prepare('SELECT 1').get()
        return { status: 'ok' }
    } catch (e: any) {
        return { status: 'error', message: e.message }
    }
}

async function checkWttr(): Promise<DepStatus> {
    try {
        const res = await fetch('https://wttr.in/Paris?format=j1', { signal: AbortSignal.timeout(3000) })
        if (!res.ok) return { status: 'degraded', message: `HTTP ${res.status}` }
        return { status: 'ok' }
    } catch (e: any) {
        return { status: 'error', message: e.message }
    }
}

export async function registerHealth(fastify: FastifyInstance) {
    fastify.get('/health', async (_req, reply) => {
        const startTime = process.uptime()

        let auth: ReturnType<typeof createOAuth2Client> | null = null
        let oauthStatus: DepStatus
        try {
            auth = createOAuth2Client()
            oauthStatus = await checkGoogleOAuth()
        } catch {
            oauthStatus = { status: 'error', message: 'OAuth client init failed (missing env vars?)' }
        }

        const [calStatus, tasksStatus, wttrStatus] = await Promise.all([
            auth ? checkGoogleCalendar(auth) : Promise.resolve<DepStatus>({ status: 'error', message: 'No auth' }),
            auth ? checkGoogleTasks(auth) : Promise.resolve<DepStatus>({ status: 'error', message: 'No auth' }),
            checkWttr(),
        ])

        const sqliteStatus = checkSqlite()

        return reply.send(ok({
            status: 'ok',
            uptime: Math.round(startTime),
            dependencies: {
                google_oauth: oauthStatus,
                google_calendar: calStatus,
                google_tasks: tasksStatus,
                sqlite: sqliteStatus,
                wttr: wttrStatus,
            },
        }))
    })
}
