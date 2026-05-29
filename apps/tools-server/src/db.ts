import Database from 'better-sqlite3'
import { mkdirSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const dataDir = join(homedir(), '.local', 'share', 'jarvis')
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })

const dbPath = join(dataDir, 'jarvis.db')
const db = new Database(dbPath)

db.exec(`
    CREATE TABLE IF NOT EXISTS routine_items (
        id         TEXT PRIMARY KEY,
        label      TEXT NOT NULL,
        category   TEXT,
        active     INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS routine_checks (
        id         TEXT PRIMARY KEY,
        item_id    TEXT NOT NULL REFERENCES routine_items(id),
        date       TEXT NOT NULL,
        checked_at TEXT,
        UNIQUE(item_id, date)
    );

    CREATE TABLE IF NOT EXISTS episodes (
        id                TEXT PRIMARY KEY,
        content           TEXT NOT NULL,
        date              TEXT NOT NULL,
        calendar_event_id TEXT,
        created_at        TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS facts (
        id             TEXT PRIMARY KEY,
        content        TEXT NOT NULL,
        category       TEXT,
        confidence     REAL DEFAULT 1.0,
        last_confirmed TEXT,
        created_at     TEXT DEFAULT (datetime('now')),
        updated_at     TEXT DEFAULT (datetime('now'))
    );

    -- FTS5 virtual tables for ranked full-text search
    CREATE VIRTUAL TABLE IF NOT EXISTS facts_fts USING fts5(
        content, category,
        content='facts', content_rowid='rowid'
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS episodes_fts USING fts5(
        content,
        content='episodes', content_rowid='rowid'
    );

    -- Triggers to keep FTS5 indexes in sync with base tables
    CREATE TRIGGER IF NOT EXISTS facts_ai AFTER INSERT ON facts BEGIN
        INSERT INTO facts_fts(rowid, content, category) VALUES (new.rowid, new.content, new.category);
    END;

    CREATE TRIGGER IF NOT EXISTS facts_au AFTER UPDATE ON facts BEGIN
        INSERT INTO facts_fts(facts_fts, rowid, content, category) VALUES ('delete', old.rowid, old.content, old.category);
        INSERT INTO facts_fts(rowid, content, category) VALUES (new.rowid, new.content, new.category);
    END;

    CREATE TRIGGER IF NOT EXISTS facts_ad AFTER DELETE ON facts BEGIN
        INSERT INTO facts_fts(facts_fts, rowid, content, category) VALUES ('delete', old.rowid, old.content, old.category);
    END;

    CREATE TRIGGER IF NOT EXISTS episodes_ai AFTER INSERT ON episodes BEGIN
        INSERT INTO episodes_fts(rowid, content) VALUES (new.rowid, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS episodes_au AFTER UPDATE ON episodes BEGIN
        INSERT INTO episodes_fts(episodes_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
        INSERT INTO episodes_fts(rowid, content) VALUES (new.rowid, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS episodes_ad AFTER DELETE ON episodes BEGIN
        INSERT INTO episodes_fts(episodes_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
    END;
`)

// Populate FTS5 indexes from existing data on first run
const factsFtsCount = (db.prepare('SELECT count(*) as n FROM facts_fts').get() as any).n
const factCount = (db.prepare('SELECT count(*) as n FROM facts').get() as any).n
if (factsFtsCount === 0 && factCount > 0) {
    db.prepare("INSERT INTO facts_fts(facts_fts) VALUES ('rebuild')").run()
}

const episodesFtsCount = (db.prepare('SELECT count(*) as n FROM episodes_fts').get() as any).n
const episodeCount = (db.prepare('SELECT count(*) as n FROM episodes').get() as any).n
if (episodesFtsCount === 0 && episodeCount > 0) {
    db.prepare("INSERT INTO episodes_fts(episodes_fts) VALUES ('rebuild')").run()
}

export default db
