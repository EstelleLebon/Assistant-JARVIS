import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import db from '../db.js'
import { ok, err } from '../types/api.js'

// Sanitize user input into a valid FTS5 MATCH query (prefix search per token)
function toFtsQuery(q: string): string {
    return q
        .replace(/['"*^()[\]{}:]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 1)
        .map((w) => `${w}*`)
        .join(' ')
}

export async function registerMemory(fastify: FastifyInstance) {
    // --- Episodes ---

    fastify.post('/tools/memory/episodes', async (req, reply) => {
        const { content, date, calendar_event_id } = req.body as any
        if (!content || !date) return reply.status(400).send(err('INVALID_PARAMS', 'content and date are required'))

        const id = randomUUID()
        db.prepare('INSERT INTO episodes (id, content, date, calendar_event_id) VALUES (?, ?, ?, ?)').run(
            id, content, date, calendar_event_id ?? null
        )
        const episode = db.prepare('SELECT * FROM episodes WHERE id = ?').get(id)
        return reply.status(201).send(ok(episode))
    })

    fastify.get('/tools/memory/episodes', async (req, reply) => {
        const { keyword, date_start, date_end, limit = '20' } = req.query as any

        let query = 'SELECT * FROM episodes WHERE 1=1'
        const params: any[] = []

        if (keyword) { query += ' AND content LIKE ?'; params.push(`%${keyword}%`) }
        if (date_start) { query += ' AND date >= ?'; params.push(date_start) }
        if (date_end) { query += ' AND date <= ?'; params.push(date_end) }
        query += ' ORDER BY date DESC LIMIT ?'
        params.push(parseInt(limit))

        const episodes = db.prepare(query).all(...params)
        return reply.send(ok({ episodes }))
    })

    fastify.delete('/tools/memory/episodes/:id', async (req, reply) => {
        const { id } = req.params as any
        const episode = db.prepare('SELECT id FROM episodes WHERE id = ?').get(id)
        if (!episode) return reply.status(404).send(err('RESOURCE_NOT_FOUND', `Episode ${id} not found`))
        db.prepare('DELETE FROM episodes WHERE id = ?').run(id)
        return reply.send(ok({ deleted: true }))
    })

    // --- Facts ---

    fastify.post('/tools/memory/facts', async (req, reply) => {
        const { content, category, confidence = 1.0 } = req.body as any
        if (!content) return reply.status(400).send(err('INVALID_PARAMS', 'content is required'))

        // Deduplication: if category is set, look for an existing fact in that category
        // with similar content (FTS5 match). Update instead of inserting a duplicate.
        if (category) {
            const ftsQ = toFtsQuery(content)
            if (ftsQ) {
                const existing = db.prepare(`
                    SELECT f.id, f.confidence
                    FROM facts f
                    JOIN facts_fts ON f.rowid = facts_fts.rowid
                    WHERE facts_fts MATCH ? AND f.category = ?
                    ORDER BY facts_fts.rank
                    LIMIT 1
                `).get(ftsQ, category) as any

                if (existing) {
                    const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
                    const newConfidence = Math.max(existing.confidence, confidence)
                    db.prepare(`
                        UPDATE facts SET content = ?, confidence = ?, last_confirmed = ?, updated_at = ? WHERE id = ?
                    `).run(content, newConfidence, now, now, existing.id)
                    return reply.status(200).send(ok(db.prepare('SELECT * FROM facts WHERE id = ?').get(existing.id)))
                }
            }
        }

        const id = randomUUID()
        db.prepare('INSERT INTO facts (id, content, category, confidence) VALUES (?, ?, ?, ?)').run(
            id, content, category ?? null, confidence
        )
        const fact = db.prepare('SELECT * FROM facts WHERE id = ?').get(id)
        return reply.status(201).send(ok(fact))
    })

    fastify.put('/tools/memory/facts/:id', async (req, reply) => {
        const { id } = req.params as any
        const { content, category, confidence } = req.body as any

        const fact = db.prepare('SELECT * FROM facts WHERE id = ?').get(id) as any
        if (!fact) return reply.status(404).send(err('RESOURCE_NOT_FOUND', `Fact ${id} not found`))

        const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
        db.prepare(`
            UPDATE facts SET
                content = ?,
                category = ?,
                confidence = ?,
                last_confirmed = ?,
                updated_at = ?
            WHERE id = ?
        `).run(
            content ?? fact.content,
            category !== undefined ? category : fact.category,
            confidence !== undefined ? confidence : fact.confidence,
            now,
            now,
            id
        )
        return reply.send(ok(db.prepare('SELECT * FROM facts WHERE id = ?').get(id)))
    })

    fastify.get('/tools/memory/facts', async (req, reply) => {
        const { keyword, category, min_confidence } = req.query as any

        let query = 'SELECT * FROM facts WHERE 1=1'
        const params: any[] = []

        if (keyword) { query += ' AND content LIKE ?'; params.push(`%${keyword}%`) }
        if (category) { query += ' AND category = ?'; params.push(category) }
        if (min_confidence) { query += ' AND confidence >= ?'; params.push(parseFloat(min_confidence)) }
        query += ' ORDER BY updated_at DESC'

        const facts = db.prepare(query).all(...params)
        return reply.send(ok({ facts }))
    })

    fastify.get('/tools/memory/facts/list', async (req, reply) => {
        const { category, limit = '100' } = req.query as any

        let query = 'SELECT * FROM facts WHERE 1=1'
        const params: any[] = []

        if (category) { query += ' AND category = ?'; params.push(category) }
        query += ' ORDER BY updated_at DESC LIMIT ?'
        params.push(parseInt(limit))

        const facts = db.prepare(query).all(...params)
        return reply.send(ok({ facts }))
    })

    fastify.delete('/tools/memory/facts/:id', async (req, reply) => {
        const { id } = req.params as any
        const fact = db.prepare('SELECT id FROM facts WHERE id = ?').get(id)
        if (!fact) return reply.status(404).send(err('RESOURCE_NOT_FOUND', `Fact ${id} not found`))
        db.prepare('DELETE FROM facts WHERE id = ?').run(id)
        return reply.send(ok({ deleted: true }))
    })

    // --- Combined search (FTS5 ranked) ---

    fastify.get('/tools/memory/search', async (req, reply) => {
        const { q, limit = '5' } = req.query as any
        if (!q) return reply.status(400).send(err('INVALID_PARAMS', 'q is required'))

        const ftsQ = toFtsQuery(q)
        const lim = parseInt(limit)

        if (!ftsQ) return reply.send(ok({ facts: [], episodes: [] }))

        const facts = db.prepare(`
            SELECT f.id, f.content, f.category, f.confidence, f.updated_at
            FROM facts f
            JOIN facts_fts ON f.rowid = facts_fts.rowid
            WHERE facts_fts MATCH ?
            ORDER BY facts_fts.rank
            LIMIT ?
        `).all(ftsQ, lim) as any[]

        const episodes = db.prepare(`
            SELECT e.id, e.content, e.date
            FROM episodes e
            JOIN episodes_fts ON e.rowid = episodes_fts.rowid
            WHERE episodes_fts MATCH ?
            ORDER BY episodes_fts.rank
            LIMIT ?
        `).all(ftsQ, lim) as any[]

        return reply.send(ok({ facts, episodes }))
    })

    // --- Context snapshot for system prompt injection ---
    // If `q` is provided: FTS5 ranked retrieval (top 5 per type, most relevant to query)
    // Otherwise: recent facts + episodes (general context)

    fastify.get('/tools/memory/context', async (req, reply) => {
        const { q, limit = '5' } = req.query as any

        let facts: any[]
        let episodes: any[]

        if (q) {
            const ftsQ = toFtsQuery(q)
            if (ftsQ) {
                const lim = parseInt(limit)
                facts = db.prepare(`
                    SELECT f.content, f.category, f.confidence
                    FROM facts f
                    JOIN facts_fts ON f.rowid = facts_fts.rowid
                    WHERE facts_fts MATCH ?
                    ORDER BY facts_fts.rank
                    LIMIT ?
                `).all(ftsQ, lim) as any[]

                episodes = db.prepare(`
                    SELECT e.content, e.date
                    FROM episodes e
                    JOIN episodes_fts ON e.rowid = episodes_fts.rowid
                    WHERE episodes_fts MATCH ?
                    ORDER BY episodes_fts.rank
                    LIMIT ?
                `).all(ftsQ, lim) as any[]
            } else {
                facts = []
                episodes = []
            }
        } else {
            facts = db.prepare(
                'SELECT content, category, confidence FROM facts ORDER BY updated_at DESC LIMIT 30'
            ).all() as any[]

            episodes = db.prepare(
                'SELECT content, date FROM episodes ORDER BY date DESC LIMIT 20'
            ).all() as any[]
        }

        return reply.send(ok({ facts, episodes }))
    })
}
