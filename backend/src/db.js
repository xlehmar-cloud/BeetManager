import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'beet-manager.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS beds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    width_cm INTEGER NOT NULL,
    length_cm INTEGER NOT NULL,
    standort TEXT NOT NULL CHECK (standort IN ('sonne','halbschatten','schatten')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_beds_user ON beds(user_id);

  CREATE TABLE IF NOT EXISTS plantings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bed_id INTEGER NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
    plant_id TEXT NOT NULL,
    plant_name_snapshot TEXT NOT NULL,
    plant_family_snapshot TEXT NOT NULL,
    plant_zehrertyp_snapshot TEXT NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('saatgut','setzling','historisch')),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    x_cm REAL,
    y_cm REAL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_plantings_bed ON plantings(bed_id);
  CREATE INDEX IF NOT EXISTS idx_plantings_bed_year ON plantings(bed_id, year);
`);
