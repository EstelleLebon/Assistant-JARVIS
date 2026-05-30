import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import db from '../db.js'
import { ok, err } from '../types/api.js'

function parseIntSafe(value: unknown, min: number, max: number, fallback: number): number {
    const n = parseInt(String(value), 10)
    if (!isFinite(n)) return fallback
    return Math.min(max, Math.max(min, n))
}

// Sanitize user input into a valid FTS5 MATCH query (prefix search per token)
function toFtsQuery(q: string): string {
    return q
        .replace(/[^a-zA-Z0-9À-ɏ\s]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 1)
        .map((w) => `${w}*`)
        .join(' ')
}

const DB_ERROR = err('DB_ERROR', 'database operation failed')

export async function registerMemory(fastify: FastifyInstance) {
    // --- Episodes ---

    fastify.post('/tools/memory/episodes', async (req, reply) => {
        const { content, date, calendar_event_id } = req.body as any
        if (!content || !date)
            return reply.status(400).send(err('INVALID_PARAMS', 'content and date are required'))
        try {
            const id = randomUUID()
            db.prepare(
                'INSERT INTO episodes (id, content, date, calendar_event_id) VALUES (?, ?, ?, ?)'
            ).run(id, content, date, calendar_event_id ?? null)
            const episode = db.prepare('SELECT * FROM episodes WHERE id = ?').get(id)
            return reply.status(201).send(ok(episode))
        } catch (e) {
            fastify.log.error(e, 'DB error in POST /episodes')
            return reply.status(500).send(DB_ERROR)
        }
    })

    fastify.get('/tools/memory/episodes', async (req, reply) => {
        const { keyword, date_start, date_end, limit = '20' } = req.query as any
        try {
            let query = 'SELECT * FROM episodes WHERE 1=1'
            const params: any[] = []

            if (keyword) {
                query += ' AND content LIKE ?'
                params.push(`%${keyword}%`)
            }
            if (date_start) {
                query += ' AND date >= ?'
                params.push(date_start)
            }
            if (date_end) {
                query += ' AND date <= ?'
                params.push(date_end)
            }
            query += ' ORDER BY date DESC LIMIT ?'
            params.push(parseIntSafe(limit, 1, 200, 20))

            const episodes = db.prepare(query).all(...params)
            return reply.send(ok({ episodes }))
        } catch (e) {
            fastify.log.error(e, 'DB error in GET /episodes')
            return reply.status(500).send(DB_ERROR)
        }
    })

    fastify.delete('/tools/memory/episodes/:id', async (req, reply) => {
        const { id } = req.params as any
        try {
            const episode = db.prepare('SELECT id FROM episodes WHERE id = ?').get(id)
            if (!episode)
                return reply.status(404).send(err('RESOURCE_NOT_FOUND', `Episode ${id} not found`))
            db.prepare('DELETE FROM episodes WHERE id = ?').run(id)
            return reply.send(ok({ deleted: true }))
        } catch (e) {
            fastify.log.error(e, 'DB error in DELETE /episodes/:id')
            return reply.status(500).send(DB_ERROR)
        }
    })

    // --- Facts ---

    fastify.post('/tools/memory/facts', async (req, reply) => {
        const { content, category, confidence = 1.0 } = req.body as any
        if (!content) return reply.status(400).send(err('INVALID_PARAMS', 'content is required'))
        try {
            // Deduplication: if category is set, look for an existing fact in that category
            // with similar content (FTS5 match). Update instead of inserting a duplicate.
            if (category) {
                const ftsQ = toFtsQuery(content)
                if (ftsQ) {
                    const existing = db
                        .prepare(
                            `
                        SELECT f.id, f.confidence
                        FROM facts f
                        JOIN facts_fts ON f.rowid = facts_fts.rowid
                        WHERE facts_fts MATCH ? AND f.category = ?
                        ORDER BY facts_fts.rank
                        LIMIT 1
                    `
                        )
                        .get(ftsQ, category) as any

                    if (existing) {
                        const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
                        const newConfidence = Math.max(existing.confidence, confidence)
                        db.prepare(
                            `
                            UPDATE facts SET content = ?, confidence = ?, last_confirmed = ?, updated_at = ? WHERE id = ?
                        `
                        ).run(content, newConfidence, now, now, existing.id)
                        return reply
                            .status(200)
                            .send(
                                ok(db.prepare('SELECT * FROM facts WHERE id = ?').get(existing.id))
                            )
                    }
                }
            }

            const id = randomUUID()
            db.prepare(
                'INSERT INTO facts (id, content, category, confidence) VALUES (?, ?, ?, ?)'
            ).run(id, content, category ?? null, confidence)
            const fact = db.prepare('SELECT * FROM facts WHERE id = ?').get(id)
            return reply.status(201).send(ok(fact))
        } catch (e) {
            fastify.log.error(e, 'DB error in POST /facts')
            return reply.status(500).send(DB_ERROR)
        }
    })

    fastify.put('/tools/memory/facts/:id', async (req, reply) => {
        const { id } = req.params as any
        const { content, category, confidence } = req.body as any
        try {
            const fact = db.prepare('SELECT * FROM facts WHERE id = ?').get(id) as any
            if (!fact)
                return reply.status(404).send(err('RESOURCE_NOT_FOUND', `Fact ${id} not found`))

            const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
            db.prepare(
                `
                UPDATE facts SET
                    content = ?,
                    category = ?,
                    confidence = ?,
                    last_confirmed = ?,
                    updated_at = ?
                WHERE id = ?
            `
            ).run(
                content ?? fact.content,
                category !== undefined ? category : fact.category,
                confidence !== undefined ? confidence : fact.confidence,
                now,
                now,
                id
            )
            return reply.send(ok(db.prepare('SELECT * FROM facts WHERE id = ?').get(id)))
        } catch (e) {
            fastify.log.error(e, 'DB error in PUT /facts/:id')
            return reply.status(500).send(DB_ERROR)
        }
    })

    fastify.get('/tools/memory/facts', async (req, reply) => {
        const { keyword, category, min_confidence } = req.query as any
        try {
            let query = 'SELECT * FROM facts WHERE 1=1'
            const params: any[] = []

            if (keyword) {
                query += ' AND content LIKE ?'
                params.push(`%${keyword}%`)
            }
            if (category) {
                query += ' AND category = ?'
                params.push(category)
            }
            if (min_confidence) {
                query += ' AND confidence >= ?'
                params.push(parseFloat(min_confidence))
            }
            query += ' ORDER BY updated_at DESC'

            const facts = db.prepare(query).all(...params)
            return reply.send(ok({ facts }))
        } catch (e) {
            fastify.log.error(e, 'DB error in GET /facts')
            return reply.status(500).send(DB_ERROR)
        }
    })

    fastify.get('/tools/memory/facts/list', async (req, reply) => {
        const { category, limit = '100' } = req.query as any
        try {
            let query = 'SELECT * FROM facts WHERE 1=1'
            const params: any[] = []

            if (category) {
                query += ' AND category = ?'
                params.push(category)
            }
            query += ' ORDER BY updated_at DESC LIMIT ?'
            params.push(parseIntSafe(limit, 1, 200, 20))

            const facts = db.prepare(query).all(...params)
            return reply.send(ok({ facts }))
        } catch (e) {
            fastify.log.error(e, 'DB error in GET /facts/list')
            return reply.status(500).send(DB_ERROR)
        }
    })

    fastify.delete('/tools/memory/facts/:id', async (req, reply) => {
        const { id } = req.params as any
        try {
            const fact = db.prepare('SELECT id FROM facts WHERE id = ?').get(id)
            if (!fact)
                return reply.status(404).send(err('RESOURCE_NOT_FOUND', `Fact ${id} not found`))
            db.prepare('DELETE FROM facts WHERE id = ?').run(id)
            return reply.send(ok({ deleted: true }))
        } catch (e) {
            fastify.log.error(e, 'DB error in DELETE /facts/:id')
            return reply.status(500).send(DB_ERROR)
        }
    })

    // --- Combined search (FTS5 ranked) ---

    fastify.get('/tools/memory/search', async (req, reply) => {
        const { q, limit = '5' } = req.query as any
        if (!q) return reply.status(400).send(err('INVALID_PARAMS', 'q is required'))

        const ftsQ = toFtsQuery(q)
        const lim = parseIntSafe(limit, 1, 200, 20)

        if (!ftsQ)
            return reply.send({
                result: 'Requête trop courte pour une recherche.',
                panel: { type: 'memory_results', data: { query: q, results: [] } }
            })

        try {
            const facts = db
                .prepare(
                    `
                SELECT f.id, f.content, f.category, f.confidence, f.updated_at
                FROM facts f
                JOIN facts_fts ON f.rowid = facts_fts.rowid
                WHERE facts_fts MATCH ?
                ORDER BY facts_fts.rank
                LIMIT ?
            `
                )
                .all(ftsQ, lim) as any[]

            const episodes = db
                .prepare(
                    `
                SELECT e.id, e.content, e.date
                FROM episodes e
                JOIN episodes_fts ON e.rowid = episodes_fts.rowid
                WHERE episodes_fts MATCH ?
                ORDER BY episodes_fts.rank
                LIMIT ?
            `
                )
                .all(ftsQ, lim) as any[]

            const results = [
                ...facts.map((f: any) => ({
                    type: f.category ?? 'declarative',
                    content: f.content,
                    created_at: f.updated_at
                })),
                ...episodes.map((e: any) => ({
                    type: 'episodic',
                    content: e.content,
                    created_at: e.date
                }))
            ]
            const result =
                results.length === 0
                    ? `Aucun souvenir trouvé pour "${q}".`
                    : `${results.length} résultat${results.length !== 1 ? 's' : ''} trouvé${results.length !== 1 ? 's' : ''} pour "${q}".`
            return reply.send({
                result,
                panel: { type: 'memory_results', data: { query: q, results } }
            })
        } catch (e) {
            fastify.log.error(e, 'DB error in GET /memory/search')
            return reply.status(500).send(DB_ERROR)
        }
    })

    // --- Context snapshot for system prompt injection ---
    // If `q` is provided: FTS5 ranked retrieval (top 5 per type, most relevant to query)
    // Otherwise: recent facts + episodes (general context)

    fastify.get('/tools/memory/context', async (req, reply) => {
        const { q, limit = '5' } = req.query as any
        try {
            let facts: any[]
            let episodes: any[]

            if (q) {
                const ftsQ = toFtsQuery(q)
                if (ftsQ) {
                    const lim = parseIntSafe(limit, 1, 200, 20)
                    facts = db
                        .prepare(
                            `
                        SELECT f.content, f.category, f.confidence
                        FROM facts f
                        JOIN facts_fts ON f.rowid = facts_fts.rowid
                        WHERE facts_fts MATCH ?
                        ORDER BY facts_fts.rank
                        LIMIT ?
                    `
                        )
                        .all(ftsQ, lim) as any[]

                    episodes = db
                        .prepare(
                            `
                        SELECT e.content, e.date
                        FROM episodes e
                        JOIN episodes_fts ON e.rowid = episodes_fts.rowid
                        WHERE episodes_fts MATCH ?
                        ORDER BY episodes_fts.rank
                        LIMIT ?
                    `
                        )
                        .all(ftsQ, lim) as any[]
                } else {
                    facts = []
                    episodes = []
                }
            } else {
                facts = db
                    .prepare(
                        'SELECT content, category, confidence FROM facts ORDER BY updated_at DESC LIMIT 30'
                    )
                    .all() as any[]

                episodes = db
                    .prepare('SELECT content, date FROM episodes ORDER BY date DESC LIMIT 20')
                    .all() as any[]
            }

            return reply.send(ok({ facts, episodes }))
        } catch (e) {
            fastify.log.error(e, 'DB error in GET /memory/context')
            return reply.status(500).send(DB_ERROR)
        }
    })
}
