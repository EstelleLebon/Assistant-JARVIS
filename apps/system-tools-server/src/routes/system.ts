import type { FastifyInstance } from 'fastify'
import { execFile, spawn } from 'child_process'
import { homedir } from 'os'
import { join } from 'path'
import { ok, err } from '../types/index.js'

function run(cmd: string, args: string[]): Promise<{ code: number; stderr: string }> {
    return new Promise((resolve) => {
        execFile(cmd, args, (error, _stdout, stderr) => {
            resolve({ code: error ? 1 : 0, stderr: stderr.trim() })
        })
    })
}

export async function systemRoutes(fastify: FastifyInstance) {
    fastify.post('/tools/system/lock', async () => {
        let result = await run('loginctl', ['lock-session'])
        if (result.code !== 0) result = await run('xdg-screensaver', ['lock'])
        if (result.code !== 0) return err('COMMAND_FAILED', result.stderr || 'lock failed')
        return ok({ locked: true })
    })

    fastify.post('/tools/system/sleep', async () => {
        const result = await run('systemctl', ['suspend'])
        if (result.code !== 0) return err('COMMAND_FAILED', result.stderr || 'suspend failed')
        return ok({ sleeping: true })
    })

    fastify.post<{ Body: { confirmed?: boolean; delay_seconds?: number } }>('/tools/system/shutdown', async (req) => {
        const { confirmed, delay_seconds = 0 } = req.body ?? {}
        if (!confirmed) return err('CONFIRMATION_REQUIRED', 'Set confirmed: true to proceed')
        const delay = `+${Math.max(0, Math.floor(delay_seconds / 60))}`
        const result = await run('systemctl', ['poweroff', delay === '+0' ? 'now' : delay])
        if (result.code !== 0) return err('COMMAND_FAILED', result.stderr || 'shutdown failed')
        return ok({ shutdown_in: delay_seconds })
    })

    fastify.post<{ Body?: { output_dir?: string; filename?: string } }>('/tools/system/screenshot', async (req) => {
        const outputDir = req.body?.output_dir ?? join(homedir(), 'Pictures', 'screenshots')
        const filename = req.body?.filename ?? new Date().toISOString().replace(/[:.]/g, '-') + '.png'
        const path = join(outputDir, filename)
        const result = await run('scrot', [path])
        if (result.code !== 0) return err('COMMAND_FAILED', result.stderr || 'scrot failed')
        return ok({ path })
    })

    fastify.post<{ Body: { path: string } }>('/tools/system/open-file', async (req) => {
        const { path } = req.body ?? {}
        if (!path) return err('INVALID_PARAMS', 'path is required')
        const result = await run('xdg-open', [path])
        if (result.code !== 0) return err('COMMAND_FAILED', result.stderr || 'xdg-open failed')
        return ok({ opened: true, path })
    })

    fastify.post<{ Body: { path: string } }>('/tools/system/open-folder', async (req) => {
        const { path } = req.body ?? {}
        if (!path) return err('INVALID_PARAMS', 'path is required')
        const result = await run('xdg-open', [path])
        if (result.code !== 0) return err('COMMAND_FAILED', result.stderr || 'xdg-open failed')
        return ok({ opened: true, path })
    })

    fastify.post<{ Body: { name: string } }>('/tools/system/launch-app', async (req) => {
        const { name } = req.body ?? {}
        if (!name) return err('INVALID_PARAMS', 'name is required')
        return new Promise((resolve) => {
            execFile('which', [name], (error, stdout) => {
                if (error || !stdout.trim()) {
                    resolve(err('RESOURCE_NOT_FOUND', `Application "${name}" not found`))
                    return
                }
                const child = spawn(stdout.trim(), [], { detached: true, stdio: 'ignore' })
                child.unref()
                resolve(ok({ launched: true, app: name }))
            })
        })
    })

    fastify.post<{ Body: { title: string; message: string; urgency?: 'low' | 'normal' | 'critical'; duration_ms?: number } }>(
        '/tools/system/notify',
        async (req) => {
            const { title, message, urgency = 'normal', duration_ms = 3000 } = req.body ?? {}
            if (!title || !message) return err('INVALID_PARAMS', 'title and message are required')
            const result = await run('notify-send', ['-u', urgency, '-t', String(duration_ms), title, message])
            if (result.code !== 0) return err('COMMAND_FAILED', result.stderr || 'notify-send failed')
            return ok({ sent: true })
        },
    )
}
