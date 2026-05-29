import type { FastifyInstance } from 'fastify'
import { execFile } from 'child_process'
import { readFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { ok, err } from '../types/index.js'
import { getDb, type VscodeAlias } from '../db.js'

interface RecentEntry {
    path: string
    label: string
}

async function getRecentVscodeFolders(): Promise<RecentEntry[]> {
    try {
        const storagePath = join(homedir(), '.config', 'Code', 'storage.json')
        const raw = await readFile(storagePath, 'utf-8')
        const storage = JSON.parse(raw)
        const workspaces: string[] =
            storage?.openedPathsList?.workspaces3 ??
            storage?.openedPathsList?.entries?.map((e: { folderUri?: string; fileUri?: string }) => e.folderUri ?? e.fileUri).filter(Boolean) ??
            []
        return workspaces
            .filter((w) => w.startsWith('file://'))
            .map((w) => {
                const path = decodeURIComponent(w.replace('file://', ''))
                const label = path.split('/').pop() ?? path
                return { path, label }
            })
    } catch {
        return []
    }
}

export async function vscodeRoutes(fastify: FastifyInstance) {
    fastify.get('/tools/vscode/folders', async () => {
        const db = getDb()
        const aliases = db.prepare('SELECT * FROM vscode_aliases ORDER BY last_used DESC').all() as VscodeAlias[]
        const recent = await getRecentVscodeFolders()
        return ok({ aliases, recent })
    })

    fastify.post<{ Body: { alias?: string; path?: string } }>('/tools/vscode/open', async (req) => {
        const { alias, path } = req.body ?? {}
        if (!alias && !path) {
            return err('INVALID_PARAMS', 'Provide alias or path')
        }

        let resolvedPath: string | undefined

        if (alias) {
            const db = getDb()
            const row = db.prepare('SELECT * FROM vscode_aliases WHERE name = ?').get(alias) as VscodeAlias | undefined
            if (!row) {
                const recent = await getRecentVscodeFolders()
                const match = recent.find((r) => r.label.toLowerCase().includes(alias.toLowerCase()))
                if (match) {
                    resolvedPath = match.path
                } else {
                    return err('RESOURCE_NOT_FOUND', `No alias found for "${alias}"`)
                }
            } else {
                resolvedPath = row.path
                db.prepare('UPDATE vscode_aliases SET last_used = datetime("now") WHERE id = ?').run(row.id)
            }
        } else {
            resolvedPath = path
        }

        return new Promise((resolve) => {
            const child = execFile('code', [resolvedPath!], (error: Error | null) => {
                if (error) resolve(err('COMMAND_FAILED', error.message))
                else resolve(ok({ opened: true, path: resolvedPath }))
            })
            child.unref()
        })
    })

    fastify.post<{ Body: { name: string; path: string } }>('/tools/vscode/aliases', async (req) => {
        const { name, path } = req.body ?? {}
        if (!name || !path) return err('INVALID_PARAMS', 'name and path are required')
        const db = getDb()
        const id = randomUUID()
        db.prepare('INSERT INTO vscode_aliases (id, name, path) VALUES (?, ?, ?)').run(id, name, path)
        const row = db.prepare('SELECT * FROM vscode_aliases WHERE id = ?').get(id) as VscodeAlias
        return ok(row)
    })

    fastify.delete<{ Params: { id: string } }>('/tools/vscode/aliases/:id', async (req) => {
        const db = getDb()
        const result = db.prepare('DELETE FROM vscode_aliases WHERE id = ?').run(req.params.id)
        if (result.changes === 0) return err('RESOURCE_NOT_FOUND', 'Alias not found')
        return ok({ deleted: true })
    })
}
