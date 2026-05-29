import Database from 'better-sqlite3'
import { join } from 'path'
import { homedir } from 'os'
import { mkdirSync } from 'fs'

const DB_DIR = join(homedir(), '.local', 'share', 'jarvis')
const DB_PATH = join(DB_DIR, 'system-tools.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
    if (!_db) {
        mkdirSync(DB_DIR, { recursive: true })
        _db = new Database(DB_PATH)
        _db.exec(`
            CREATE TABLE IF NOT EXISTS vscode_aliases (
                id         TEXT PRIMARY KEY,
                name       TEXT NOT NULL UNIQUE,
                path       TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                last_used  TEXT
            )
        `)
    }
    return _db
}

export interface VscodeAlias {
    id: string
    name: string
    path: string
    created_at: string
    last_used: string | null
}
