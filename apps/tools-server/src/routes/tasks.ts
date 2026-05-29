import type { FastifyInstance } from 'fastify'
import { google } from 'googleapis'
import { createOAuth2Client } from '../oauth.js'
import { ok, err } from '../types/api.js'

function tasksClient() {
    const auth = createOAuth2Client()
    return google.tasks({ version: 'v1', auth })
}

function mapTask(t: any) {
    return {
        id: t.id,
        title: t.title ?? '',
        notes: t.notes ?? '',
        due: t.due ?? null,
        status: t.status,
        completed: t.completed ?? null,
    }
}

export async function registerTasks(fastify: FastifyInstance) {
    // List task lists
    fastify.get('/tools/tasks/lists', async (_req, reply) => {
        try {
            const tasks = tasksClient()
            const res = await tasks.tasklists.list()
            const lists = (res.data.items ?? []).map((l) => ({ id: l.id, title: l.title }))
            return reply.send(ok({ lists }))
        } catch (e: any) {
            return reply.status(502).send(err('GOOGLE_API_ERROR', e.message))
        }
    })

    // List tasks
    fastify.get('/tools/tasks', async (req, reply) => {
        const { list_id, status, due_min, due_max } = req.query as any
        if (!list_id) return reply.status(400).send(err('INVALID_PARAMS', 'list_id is required'))
        try {
            const tasks = tasksClient()
            const res = await tasks.tasks.list({
                tasklist: list_id,
                showCompleted: true,
                showHidden: true,
                ...(status && { showCompleted: status === 'completed' }),
                ...(due_min && { dueMin: due_min }),
                ...(due_max && { dueMax: due_max }),
            })
            const items = (res.data.items ?? [])
                .filter((t) => !status || t.status === status)
                .map(mapTask)
            return reply.send(ok({ tasks: items }))
        } catch (e: any) {
            return reply.status(502).send(err('GOOGLE_API_ERROR', e.message))
        }
    })

    // Create task
    fastify.post('/tools/tasks', async (req, reply) => {
        const { list_id, title, notes, due } = req.body as any
        if (!list_id || !title) return reply.status(400).send(err('INVALID_PARAMS', 'list_id and title are required'))
        try {
            const tasks = tasksClient()
            const res = await tasks.tasks.insert({
                tasklist: list_id,
                requestBody: { title, notes, due },
            })
            return reply.status(201).send(ok(mapTask(res.data)))
        } catch (e: any) {
            return reply.status(502).send(err('GOOGLE_API_ERROR', e.message))
        }
    })

    // Update task
    fastify.put('/tools/tasks/:id', async (req, reply) => {
        const { id } = req.params as any
        const { list_id, title, notes, due, status } = req.body as any
        if (!list_id) return reply.status(400).send(err('INVALID_PARAMS', 'list_id is required'))
        try {
            const tasks = tasksClient()
            const existing = await tasks.tasks.get({ tasklist: list_id, task: id })
            const patch: any = { ...existing.data }
            if (title !== undefined) patch.title = title
            if (notes !== undefined) patch.notes = notes
            if (due !== undefined) patch.due = due
            if (status !== undefined) {
                patch.status = status
                if (status === 'completed') patch.completed = new Date().toISOString()
                else patch.completed = null
            }
            const res = await tasks.tasks.update({ tasklist: list_id, task: id, requestBody: patch })
            return reply.send(ok(mapTask(res.data)))
        } catch (e: any) {
            if (e.code === 404) return reply.status(404).send(err('RESOURCE_NOT_FOUND', `Task ${id} not found`))
            return reply.status(502).send(err('GOOGLE_API_ERROR', e.message))
        }
    })

    // Delete task
    fastify.delete('/tools/tasks/:id', async (req, reply) => {
        const { id } = req.params as any
        const { list_id } = req.query as any
        if (!list_id) return reply.status(400).send(err('INVALID_PARAMS', 'list_id is required'))
        try {
            const tasks = tasksClient()
            await tasks.tasks.delete({ tasklist: list_id, task: id })
            return reply.send(ok({ deleted: true }))
        } catch (e: any) {
            if (e.code === 404) return reply.status(404).send(err('RESOURCE_NOT_FOUND', `Task ${id} not found`))
            return reply.status(502).send(err('GOOGLE_API_ERROR', e.message))
        }
    })
}
