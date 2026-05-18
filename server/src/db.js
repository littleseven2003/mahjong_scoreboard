import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, mkdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

const __dirname = dirname(fileURLToPath(import.meta.url))
const defaultDbPath = resolve(__dirname, '../data/mahjong.db')
const dbPath = process.env.DB_PATH || defaultDbPath
const dbDir = dirname(dbPath)

if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

export const db = new DatabaseSync(dbPath)

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_code TEXT NOT NULL UNIQUE,
    name TEXT,
    status TEXT NOT NULL DEFAULT 'waiting',
    player_count INTEGER NOT NULL,
    initial_score INTEGER NOT NULL,
    score_rate REAL NOT NULL DEFAULT 1,
    allow_negative INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT
  );

  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    nickname TEXT NOT NULL,
    seat_no INTEGER NOT NULL,
    current_score INTEGER NOT NULL,
    joined_at TEXT NOT NULL,
    is_owner INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    from_player_id INTEGER NOT NULL,
    to_player_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    remark TEXT,
    created_at TEXT NOT NULL,
    created_by INTEGER,
    is_reverted INTEGER NOT NULL DEFAULT 0,
    reverted_at TEXT,
    undo_requested_at TEXT,
    undo_requested_by INTEGER,
    undo_from_confirmed_at TEXT,
    undo_to_confirmed_at TEXT,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (from_player_id) REFERENCES players(id),
    FOREIGN KEY (to_player_id) REFERENCES players(id),
    FOREIGN KEY (created_by) REFERENCES players(id),
    FOREIGN KEY (undo_requested_by) REFERENCES players(id)
  );

  CREATE TABLE IF NOT EXISTS settlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    initial_score INTEGER NOT NULL,
    final_score INTEGER NOT NULL,
    diff_score INTEGER NOT NULL,
    money_amount REAL NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id)
  );
`)

function addColumnIfMissing(table, column, definition) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  } catch (error) {
    if (!String(error.message || '').includes('duplicate column name')) {
      throw error
    }
  }
}

addColumnIfMissing('transactions', 'undo_requested_at', 'TEXT')
addColumnIfMissing('transactions', 'undo_requested_by', 'INTEGER')
addColumnIfMissing('transactions', 'undo_from_confirmed_at', 'TEXT')
addColumnIfMissing('transactions', 'undo_to_confirmed_at', 'TEXT')

export function now() {
  return new Date().toISOString()
}

export function transaction(callback) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = callback()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
