import Fastify from 'fastify'
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

await registerHealth(fastify)
await registerCalendar(fastify)
await registerTasks(fastify)
await registerRoutines(fastify)
await registerWeather(fastify)
await registerMemory(fastify)

const start = async () => {
    try {
        await fastify.listen({ port: 3001, host: '127.0.0.1' })
    } catch (err) {
        fastify.log.error(err)
        process.exit(1)
    }
}

start()
