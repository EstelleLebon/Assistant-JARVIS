import type { FastifyInstance } from 'fastify'
import { execFile } from 'child_process'
import { ok, err } from '../types/index.js'

function playerctl(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve) => {
        execFile('playerctl', args, (error, stdout, stderr) => {
            const code = error ? 1 : 0
            resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code })
        })
    })
}

async function activePlayer(preferred?: string): Promise<string | null> {
    if (preferred) return preferred
    const result = await playerctl(['--list-all'])
    const players = result.stdout.split('\n').filter(Boolean)
    return players[0] ?? null
}

export async function mediaRoutes(fastify: FastifyInstance) {
    fastify.post<{ Body?: { player?: string } }>('/tools/media/play-pause', async (req) => {
        const player = await activePlayer(req.body?.player)
        if (!player) return err('COMMAND_FAILED', 'playerctl: no players found')
        const status = await playerctl(['--player', player, 'status'])
        const action = status.stdout === 'Playing' ? 'pause' : 'play'
        const result = await playerctl(['--player', player, action])
        if (result.code !== 0) return err('COMMAND_FAILED', result.stderr || 'playerctl failed')
        return ok({ action, player })
    })

    fastify.post<{ Body?: { player?: string } }>('/tools/media/next', async (req) => {
        const player = await activePlayer(req.body?.player)
        if (!player) return err('COMMAND_FAILED', 'playerctl: no players found')
        const result = await playerctl(['--player', player, 'next'])
        if (result.code !== 0) return err('COMMAND_FAILED', result.stderr || 'playerctl failed')
        return ok({ action: 'next', player })
    })

    fastify.post<{ Body?: { player?: string } }>('/tools/media/previous', async (req) => {
        const player = await activePlayer(req.body?.player)
        if (!player) return err('COMMAND_FAILED', 'playerctl: no players found')
        const result = await playerctl(['--player', player, 'previous'])
        if (result.code !== 0) return err('COMMAND_FAILED', result.stderr || 'playerctl failed')
        return ok({ action: 'previous', player })
    })

    fastify.post<{ Body: { level: number } }>('/tools/media/volume', async (req) => {
        const { level } = req.body ?? {}
        if (typeof level !== 'number' || level < 0 || level > 100) {
            return err('INVALID_PARAMS', 'level must be an integer 0–100')
        }
        return new Promise((resolve) => {
            execFile('pactl', ['set-sink-volume', '@DEFAULT_SINK@', `${level}%`], (error) => {
                if (error) resolve(err('COMMAND_FAILED', error.message))
                else resolve(ok({ volume: level }))
            })
        })
    })
}
