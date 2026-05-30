import Fastify from 'fastify'
import { execFile } from 'child_process'
import { ok } from './types/index.js'
import { vscodeRoutes } from './routes/vscode.js'
import { browserRoutes } from './routes/browser.js'
import { mediaRoutes } from './routes/media.js'
import { systemRoutes } from './routes/system.js'

const PORT = 7824

const DEPS = [
    'xdg-open',
    'xdotool',
    'wmctrl',
    'playerctl',
    'notify-send',
    'scrot',
    'pactl'
] as const
type Dep = (typeof DEPS)[number]

function checkDep(cmd: string): Promise<'ok' | 'missing'> {
    return new Promise((resolve) => {
        execFile('which', [cmd], (error) => resolve(error ? 'missing' : 'ok'))
    })
}

const fastify = Fastify({ logger: true })

fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error)
    reply.status(500).send({ ok: false, error: 'internal' })
})

fastify.get('/health', async () => {
    const results = await Promise.all(
        DEPS.map((d) => checkDep(d).then((status) => [d, { status }] as [Dep, { status: string }]))
    )
    const dependencies = Object.fromEntries(results.map(([k, v]) => [k.replace('-', '_'), v]))
    return ok({
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        dependencies
    })
})

fastify.register(vscodeRoutes)
fastify.register(browserRoutes)
fastify.register(mediaRoutes)
fastify.register(systemRoutes)

const shutdown = async () => {
    await fastify.close()
    process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

fastify.listen({ port: PORT, host: '127.0.0.1' }, (err) => {
    if (err) {
        fastify.log.error(err)
        process.exit(1)
    }
})
