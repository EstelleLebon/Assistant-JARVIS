import Fastify from 'fastify'
import db from './db.js'
import { registerHealth } from './routes/health.js'
import { registerCalendar } from './routes/calendar.js'
import { registerTasks } from './routes/tasks.js'
import { registerRoutines } from './routes/routines.js'
import { registerWeather } from './routes/weather.js'
import { registerMemory } from './routes/memory.js'

const fastify = Fastify({ logger: true })

fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    try {
        done(null, body ? JSON.parse(body as string) : {})
    } catch (e: any) {
        done(e)
    }
})

fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error)
    reply.status(500).send({ ok: false, error: 'internal' })
})

await registerHealth(fastify)
await registerCalendar(fastify)
await registerTasks(fastify)
await registerRoutines(fastify)
await registerWeather(fastify)
await registerMemory(fastify)

const shutdown = async () => {
    await fastify.close()
    db.close()
    process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

const start = async () => {
    try {
        await fastify.listen({ port: 3001, host: '127.0.0.1' })
    } catch (err) {
        fastify.log.error(err)
        process.exit(1)
    }
}

start()
