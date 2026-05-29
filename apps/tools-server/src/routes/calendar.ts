import type { FastifyInstance } from 'fastify'
import { google } from 'googleapis'
import { createOAuth2Client } from '../oauth.js'
import { ok, err } from '../types/api.js'

function calendarClient() {
    const auth = createOAuth2Client()
    return google.calendar({ version: 'v3', auth })
}

function mapEvent(e: any, calendarId: string) {
    return {
        id: e.id,
        summary: e.summary ?? '',
        description: e.description ?? '',
        location: e.location ?? '',
        start: e.start?.dateTime ?? e.start?.date,
        end: e.end?.dateTime ?? e.end?.date,
        allDay: !e.start?.dateTime,
        calendarId,
    }
}

export async function registerCalendar(fastify: FastifyInstance) {
    // List calendars
    fastify.get('/tools/calendar/list', async (_req, reply) => {
        try {
            const cal = calendarClient()
            const res = await cal.calendarList.list()
            const calendars = (res.data.items ?? []).map((c) => ({
                id: c.id,
                summary: c.summary,
                primary: c.primary ?? false,
                backgroundColor: c.backgroundColor,
            }))
            return reply.send(ok({ calendars }))
        } catch (e: any) {
            return reply.status(502).send(err('GOOGLE_API_ERROR', e.message))
        }
    })

    // List events
    fastify.get('/tools/calendar/events', async (req, reply) => {
        const { calendar_id = 'primary', max_results = '10' } = req.query as any
        let { date_start, date_end } = req.query as any
        if (!date_start || !date_end) {
            const todayStart = new Date()
            todayStart.setHours(0, 0, 0, 0)
            const todayEnd = new Date()
            todayEnd.setHours(23, 59, 59, 999)
            date_start = date_start ?? todayStart.toISOString()
            date_end = date_end ?? todayEnd.toISOString()
        }
        // Ensure RFC 3339 with timezone (Google API rejects bare local datetimes)
        if (date_start && !date_start.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(date_start)) {
            date_start = new Date(date_start).toISOString()
        }
        if (date_end && !date_end.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(date_end)) {
            date_end = new Date(date_end).toISOString()
        }
        try {
            const cal = calendarClient()
            const res = await cal.events.list({
                calendarId: calendar_id,
                timeMin: date_start,
                timeMax: date_end,
                maxResults: parseInt(max_results),
                singleEvents: true,
                orderBy: 'startTime',
            })
            const events = (res.data.items ?? []).map((e) => mapEvent(e, calendar_id))
            return reply.send(ok({ events }))
        } catch (e: any) {
            return reply.status(502).send(err('GOOGLE_API_ERROR', e.message))
        }
    })

    // Create event
    fastify.post('/tools/calendar/events', async (req, reply) => {
        const body = req.body as any
        const { summary, start, end, description, location, calendar_id = 'primary', all_day = false } = body
        if (!summary || !start || !end) {
            return reply.status(400).send(err('INVALID_PARAMS', 'summary, start, and end are required'))
        }
        try {
            const cal = calendarClient()
            const startObj = all_day ? { date: start.substring(0, 10) } : { dateTime: start }
            const endObj = all_day ? { date: end.substring(0, 10) } : { dateTime: end }
            const res = await cal.events.insert({
                calendarId: calendar_id,
                requestBody: { summary, description, location, start: startObj, end: endObj },
            })
            return reply.status(201).send(ok(mapEvent(res.data, calendar_id)))
        } catch (e: any) {
            return reply.status(502).send(err('GOOGLE_API_ERROR', e.message))
        }
    })

    // Update event
    fastify.put('/tools/calendar/events/:id', async (req, reply) => {
        const { id } = req.params as any
        const body = req.body as any
        const { calendar_id = 'primary', summary, start, end, description, location, all_day } = body
        try {
            const cal = calendarClient()
            const existing = await cal.events.get({ calendarId: calendar_id, eventId: id })
            const patch: any = {}
            if (summary !== undefined) patch.summary = summary
            if (description !== undefined) patch.description = description
            if (location !== undefined) patch.location = location
            if (start !== undefined) patch.start = all_day ? { date: start.substring(0, 10) } : { dateTime: start }
            if (end !== undefined) patch.end = all_day ? { date: end.substring(0, 10) } : { dateTime: end }
            const res = await cal.events.patch({
                calendarId: calendar_id,
                eventId: id,
                requestBody: { ...existing.data, ...patch },
            })
            return reply.send(ok(mapEvent(res.data, calendar_id)))
        } catch (e: any) {
            if (e.code === 404) return reply.status(404).send(err('RESOURCE_NOT_FOUND', `Event ${id} not found`))
            return reply.status(502).send(err('GOOGLE_API_ERROR', e.message))
        }
    })

    // Delete event
    fastify.delete('/tools/calendar/events/:id', async (req, reply) => {
        const { id } = req.params as any
        const { calendar_id = 'primary' } = req.query as any
        try {
            const cal = calendarClient()
            await cal.events.delete({ calendarId: calendar_id, eventId: id })
            return reply.send(ok({ deleted: true }))
        } catch (e: any) {
            if (e.code === 404) return reply.status(404).send(err('RESOURCE_NOT_FOUND', `Event ${id} not found`))
            return reply.status(502).send(err('GOOGLE_API_ERROR', e.message))
        }
    })
}
