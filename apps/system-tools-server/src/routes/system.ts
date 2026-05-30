import type { FastifyInstance } from 'fastify'
import { execFile, spawn } from 'child_process'
import { join, resolve as resolvePath, basename } from 'path'
import os from 'os'
import { readFileSync } from 'fs'
import { ok, err } from '../types/index.js'

function run(cmd: string, args: string[]): Promise<{ code: number; stderr: string }> {
    return new Promise((resolve) => {
        execFile(cmd, args, { timeout: 10_000 }, (error, _stdout, stderr) => {
            resolve({ code: error ? 1 : 0, stderr: stderr.trim() })
        })
    })
}

const HOME = process.env.HOME ?? os.homedir()

function isSafePath(p: string): boolean {
    const resolved = resolvePath(p)
    return resolved.startsWith(HOME) || resolved.startsWith('/tmp')
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

    fastify.post<{ Body: { confirmed?: boolean; delay_seconds?: number } }>(
        '/tools/system/shutdown',
        async (req) => {
            const { confirmed, delay_seconds = 0 } = req.body ?? {}
            if (!confirmed) return err('CONFIRMATION_REQUIRED', 'Set confirmed: true to proceed')
            const delayMin = Math.max(0, Math.floor(delay_seconds / 60))
            const result = await run('shutdown', ['-h', delayMin === 0 ? 'now' : `+${delayMin}`])
            if (result.code !== 0) return err('COMMAND_FAILED', result.stderr || 'shutdown failed')
            return ok({ shutdown_in: delay_seconds })
        }
    )

    fastify.post<{ Body?: { output_dir?: string; filename?: string } }>(
        '/tools/system/screenshot',
        async (req) => {
            const outputDir = join(HOME, 'Pictures', 'Screenshots')
            const rawFilename =
                req.body?.filename ?? new Date().toISOString().replace(/[:.]/g, '-') + '.png'
            const safeFilename =
                basename(rawFilename).replace(/[^a-zA-Z0-9._-]/g, '_') || 'screenshot.png'
            const path = join(outputDir, safeFilename)
            // Try screenshot tools in order of preference
            const tools: [string, string[]][] = [
                ['spectacle', ['-b', '-n', '-o', path]], // KDE Wayland/X11
                ['gnome-screenshot', ['-f', path]], // GNOME
                ['grim', [path]], // wlroots Wayland
                ['maim', [path]], // X11
                ['scrot', [path]] // X11 fallback
            ]
            let result = { code: 1, stderr: 'no screenshot tool found' }
            for (const [cmd, args] of tools) {
                result = await run(cmd, args)
                if (result.code === 0) break
            }
            if (result.code !== 0)
                return err('COMMAND_FAILED', result.stderr || 'screenshot failed')
            const timestamp = new Date().toISOString()
            let base64: string | undefined
            try {
                const buf = readFileSync(path)
                base64 = `data:image/png;base64,${buf.toString('base64')}`
            } catch {
                /* image sera indisponible dans le panel */
            }
            return {
                result: `Capture d'écran enregistrée : ${path}`,
                panel: { type: 'screenshot', data: { path, timestamp, base64 } }
            }
        }
    )

    fastify.post<{ Body: { path: string } }>('/tools/system/open-file', async (req) => {
        const { path } = req.body ?? {}
        if (!path) return err('INVALID_PARAMS', 'path is required')
        if (!isSafePath(path)) return err('INVALID_PARAMS', 'path contains invalid segments')
        const result = await run('xdg-open', [path])
        if (result.code !== 0) return err('COMMAND_FAILED', result.stderr || 'xdg-open failed')
        return ok({ opened: true, path })
    })

    fastify.post<{ Body: { path: string } }>('/tools/system/open-folder', async (req) => {
        const { path } = req.body ?? {}
        if (!path) return err('INVALID_PARAMS', 'path is required')
        if (!isSafePath(path)) return err('INVALID_PARAMS', 'path contains invalid segments')
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

    fastify.post<{
        Body: {
            title: string
            message: string
            urgency?: 'low' | 'normal' | 'critical'
            duration_ms?: number
        }
    }>('/tools/system/notify', async (req) => {
        const { title, message, urgency = 'normal', duration_ms = 3000 } = req.body ?? {}
        if (!title || !message) return err('INVALID_PARAMS', 'title and message are required')
        const result = await run('notify-send', [
            '-u',
            urgency,
            '-t',
            String(duration_ms),
            title,
            message
        ])
        if (result.code !== 0) return err('COMMAND_FAILED', result.stderr || 'notify-send failed')
        return ok({ sent: true })
    })
}
