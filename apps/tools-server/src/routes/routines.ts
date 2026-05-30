import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import db from '../db.js'
import { ok, err } from '../types/api.js'

function todayDate(): string {
    return new Date().toISOString().substring(0, 10)
}

export async function registerRoutines(fastify: FastifyInstance) {
    // List routine items with status for a given date
    fastify.get('/tools/routines', async (req, reply) => {
        const { date = todayDate() } = req.query as any
        const items = db
            .prepare(
                `
            SELECT ri.id, ri.label, ri.category,
                   rc.checked_at
            FROM routine_items ri
            LEFT JOIN routine_checks rc ON rc.item_id = ri.id AND rc.date = ?
            WHERE ri.active = 1
            ORDER BY ri.created_at
        `
            )
            .all(date) as any[]

        return reply.send(
            ok({
                date,
                items: items.map((i) => ({
                    id: i.id,
                    label: i.label,
                    category: i.category,
                    checked: !!i.checked_at,
                    checked_at: i.checked_at ?? null
                }))
            })
        )
    })

    // Routine status summary
    fastify.get('/tools/routines/status', async (req, reply) => {
        const { date = todayDate() } = req.query as any
        const items = db
            .prepare(
                `
            SELECT ri.label, ri.category, rc.checked_at
            FROM routine_items ri
            LEFT JOIN routine_checks rc ON rc.item_id = ri.id AND rc.date = ?
            WHERE ri.active = 1
            ORDER BY ri.category, ri.created_at
        `
            )
            .all(date) as any[]

        const total = items.length
        const done = items.filter((i) => i.checked_at).length
        const pending = items.filter((i) => !i.checked_at).map((i) => i.label)

        // Group by category for the panel
        const categoryMap = new Map<string, { done: number; total: number }>()
        for (const item of items) {
            const cat = item.category ?? 'Général'
            const entry = categoryMap.get(cat) ?? { done: 0, total: 0 }
            entry.total++
            if (item.checked_at) entry.done++
            categoryMap.set(cat, entry)
        }
        const routines = Array.from(categoryMap.entries()).map(([name, v]) => ({ name, ...v }))

        const result = `Routines du ${date} : ${done}/${total} complétées.${pending.length > 0 ? ` En attente : ${pending.join(', ')}.` : ' Tout est fait !'}`

        return reply.send({
            result,
            panel: {
                type: 'routines',
                data: { routines }
            }
        })
    })

    // Check a routine item
    fastify.post('/tools/routines/check', async (req, reply) => {
        const { item_id, date = todayDate() } = req.body as any
        if (!item_id) return reply.status(400).send(err('INVALID_PARAMS', 'item_id is required'))

        const item = db
            .prepare('SELECT * FROM routine_items WHERE id = ? AND active = 1')
            .get(item_id) as any
        if (!item)
            return reply.status(404).send(err('RESOURCE_NOT_FOUND', `Item ${item_id} not found`))

        const checked_at = new Date().toISOString().replace('T', ' ').substring(0, 19)
        db.prepare(
            `
            INSERT INTO routine_checks (id, item_id, date, checked_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(item_id, date) DO UPDATE SET checked_at = excluded.checked_at
        `
        ).run(randomUUID(), item_id, date, checked_at)

        return reply.send(
            ok({
                id: item_id,
                label: item.label,
                category: item.category,
                checked: true,
                checked_at
            })
        )
    })

    // Uncheck a routine item
    fastify.post('/tools/routines/uncheck', async (req, reply) => {
        const { item_id, date = todayDate() } = req.body as any
        if (!item_id) return reply.status(400).send(err('INVALID_PARAMS', 'item_id is required'))

        const item = db
            .prepare('SELECT * FROM routine_items WHERE id = ? AND active = 1')
            .get(item_id) as any
        if (!item)
            return reply.status(404).send(err('RESOURCE_NOT_FOUND', `Item ${item_id} not found`))

        db.prepare(
            `
            INSERT INTO routine_checks (id, item_id, date, checked_at)
            VALUES (?, ?, ?, NULL)
            ON CONFLICT(item_id, date) DO UPDATE SET checked_at = NULL
        `
        ).run(randomUUID(), item_id, date)

        return reply.send(
            ok({
                id: item_id,
                label: item.label,
                category: item.category,
                checked: false,
                checked_at: null
            })
        )
    })

    // Add routine item
    fastify.post('/tools/routines/items', async (req, reply) => {
        const { label, category } = req.body as any
        if (!label) return reply.status(400).send(err('INVALID_PARAMS', 'label is required'))

        const id = randomUUID()
        db.prepare('INSERT INTO routine_items (id, label, category) VALUES (?, ?, ?)').run(
            id,
            label,
            category ?? null
        )

        const item = db.prepare('SELECT * FROM routine_items WHERE id = ?').get(id) as any
        return reply.status(201).send(ok(item))
    })

    // Deactivate (soft-delete) a routine item
    fastify.delete('/tools/routines/items/:id', async (req, reply) => {
        const { id } = req.params as any
        const item = db.prepare('SELECT * FROM routine_items WHERE id = ?').get(id)
        if (!item) return reply.status(404).send(err('RESOURCE_NOT_FOUND', `Item ${id} not found`))

        db.prepare('UPDATE routine_items SET active = 0 WHERE id = ?').run(id)
        return reply.send(ok({ disabled: true }))
    })
}
