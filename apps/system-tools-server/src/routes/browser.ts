import type { FastifyInstance } from 'fastify'
import { execFile } from 'child_process'
import { ok, err } from '../types/index.js'

function openUrl(url: string): Promise<ReturnType<typeof ok | typeof err>> {
    return new Promise((resolve) => {
        const child = execFile('xdg-open', [url], (error: Error | null) => {
            if (error) resolve(err('COMMAND_FAILED', error.message))
            else resolve(ok({ opened: true, url }))
        })
        child.unref()
    })
}

const BLOCKED_SCHEMES = ['javascript:', 'data:', 'file:', 'vbscript:', 'blob:', 'about:']

function isSafeUrl(url: string): boolean {
    let decoded = url.trim()
    try {
        decoded = decodeURIComponent(decoded)
    } catch {
        /* keep original if malformed */
    }
    const lower = decoded.toLowerCase()
    return !BLOCKED_SCHEMES.some((s) => lower.startsWith(s))
}

export async function browserRoutes(fastify: FastifyInstance) {
    fastify.post<{ Body: { url: string } }>('/tools/browser/open', async (req) => {
        const { url } = req.body ?? {}
        if (!url) return err('INVALID_PARAMS', 'url is required')
        if (!isSafeUrl(url)) return err('INVALID_PARAMS', 'URL scheme not allowed')
        return openUrl(url)
    })

    fastify.post<{ Body: { query: string; engine?: 'duckduckgo' | 'google' } }>(
        '/tools/browser/search',
        async (req) => {
            const { query, engine = 'duckduckgo' } = req.body ?? {}
            if (!query) return err('INVALID_PARAMS', 'query is required')
            const encoded = encodeURIComponent(query)
            const url =
                engine === 'google'
                    ? `https://www.google.com/search?q=${encoded}`
                    : `https://duckduckgo.com/?q=${encoded}`
            return openUrl(url)
        }
    )

    fastify.post<{ Body: { query: string; autoplay?: boolean } }>(
        '/tools/browser/youtube',
        async (req) => {
            const { query, autoplay = true } = req.body ?? {}
            if (!query) return err('INVALID_PARAMS', 'query is required')
            const encoded = encodeURIComponent(query)
            const url = `https://www.youtube.com/results?search_query=${encoded}${autoplay ? '&autoplay=1' : ''}`
            return openUrl(url)
        }
    )
}
