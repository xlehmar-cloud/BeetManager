import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedPlantsForUser } from './plantSeed.js';

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

  -- Benutzerabhängiger Pflanzenkatalog (s. seedPlantsForUser): bei der
  -- Registrierung mit einer Kopie des globalen Startkatalogs (plants.json)
  -- befüllt, danach vom Nutzer frei bearbeitbar/erweiterbar. Monate/Methoden
  -- als JSON-Text gespeichert (kompakter als Zusatztabellen, wird nur beim
  -- Lesen/Schreiben der ganzen Pflanze geparst, s. userPlants.js).
  CREATE TABLE IF NOT EXISTS plants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    family TEXT,
    zehrertyp TEXT NOT NULL CHECK (zehrertyp IN ('stark','mittel','schwach')),
    standort TEXT NOT NULL,
    methods TEXT NOT NULL,
    sowing_direct_months TEXT NOT NULL DEFAULT '[]',
    sowing_transplant_months TEXT NOT NULL DEFAULT '[]',
    sowing_note TEXT,
    germination_days_min INTEGER,
    germination_days_max INTEGER,
    harvest_start_month INTEGER,
    harvest_end_month INTEGER,
    harvest_days_min INTEGER,
    harvest_days_max INTEGER,
    harvest_note TEXT,
    spacing_min_cm REAL NOT NULL,
    spacing_max_cm REAL,
    rotation_gap_years INTEGER NOT NULL DEFAULT 4,
    icon TEXT NOT NULL DEFAULT 'leaf',
    is_builtin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_plants_user ON plants(user_id);

  -- Gute/schlechte Nachbarn: vom Nutzer explizit gepflegt (gegen die eigene
  -- Pflanzenliste), bidirektional geprüft in shared/companions.js. reason ist
  -- nur bei relation='bad' sinnvoll befüllt.
  CREATE TABLE IF NOT EXISTS plant_companions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_id INTEGER NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    companion_plant_id INTEGER NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    relation TEXT NOT NULL CHECK (relation IN ('good','bad')),
    reason TEXT,
    UNIQUE(plant_id, companion_plant_id, relation)
  );
  CREATE INDEX IF NOT EXISTS idx_plant_companions_plant ON plant_companions(plant_id);
`);

/**
 * Seedet den Katalog eines Nutzers nur, wenn er noch keinen eigenen hat
 * (idempotent) — genutzt sowohl von der Migration unten (bestehende Nutzer)
 * als auch von routes/auth.js (neue Registrierung). Gibt die Slug->ID-Map
 * zurück, wenn tatsächlich gesät wurde, sonst null (schon vorhanden).
 */
function ensureUserPlantsSeeded(userId) {
  const { c } = db.prepare('SELECT COUNT(*) c FROM plants WHERE user_id = ?').get(userId);
  if (c > 0) return null;
  return seedPlantsForUser(db, userId);
}
export { ensureUserPlantsSeeded };

const PLANTINGS_SCHEMA = `
  CREATE TABLE plantings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bed_id INTEGER NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
    plant_id INTEGER NOT NULL REFERENCES plants(id),
    plant_name_snapshot TEXT NOT NULL,
    plant_family_snapshot TEXT,
    plant_zehrertyp_snapshot TEXT NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('saatgut','setzling','historisch')),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    x_cm REAL,
    y_cm REAL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_plantings_bed ON plantings(bed_id);
  CREATE INDEX idx_plantings_bed_year ON plantings(bed_id, year);
`;

const plantingsColumns = db.prepare("PRAGMA table_info(plantings)").all();
const plantingsExists = plantingsColumns.length > 0;
const plantIdIsLegacyText = plantingsColumns.find((c) => c.name === 'plant_id')?.type === 'TEXT';

if (!plantingsExists) {
  // Frische Installation — gleich mit dem aktuellen Schema (INTEGER plant_id).
  db.exec(PLANTINGS_SCHEMA);
} else if (plantIdIsLegacyText) {
  // Migration: plant_id referenzierte bisher einen globalen Katalog-Slug
  // (z.B. "tomate"); jetzt referenziert es eine Zeile im (neuen,
  // benutzerabhängigen) plants-Katalog. Bestehende Pflanzungen bleiben dabei
  // erhalten — sie werden auf die frisch für jeden Nutzer gesäte Kopie
  // ummappt (s. seedPlantsForUser: dieselben Katalog-Slugs, neue IDs).
  console.log('[db] Migriere plantings.plant_id von Katalog-Slug auf benutzerabhängige plant-ID …');

  const seedMapByUser = {};
  for (const { id: userId } of db.prepare('SELECT id FROM users').all()) {
    seedMapByUser[userId] = ensureUserPlantsSeeded(userId) || {};
  }

  db.exec('ALTER TABLE plantings RENAME TO plantings_legacy_text_plant_id');
  // Index-Namen sind in SQLite global eindeutig (nicht pro Tabelle) — die alten
  // Indizes hängen nach dem Rename weiter an der umbenannten Tabelle und
  // würden sonst mit den gleichnamigen neuen Indizes unten kollidieren.
  db.exec('DROP INDEX IF EXISTS idx_plantings_bed');
  db.exec('DROP INDEX IF EXISTS idx_plantings_bed_year');
  db.exec(PLANTINGS_SCHEMA);

  const oldRows = db
    .prepare(
      `SELECT p.*, b.user_id AS user_id
       FROM plantings_legacy_text_plant_id p
       JOIN beds b ON b.id = p.bed_id`,
    )
    .all();

  const insertMigrated = db.prepare(`
    INSERT INTO plantings
      (id, bed_id, plant_id, plant_name_snapshot, plant_family_snapshot, plant_zehrertyp_snapshot,
       method, year, month, x_cm, y_cm, notes, created_at)
    VALUES
      (@id, @bed_id, @plant_id, @plant_name_snapshot, @plant_family_snapshot, @plant_zehrertyp_snapshot,
       @method, @year, @month, @x_cm, @y_cm, @notes, @created_at)
  `);

  const migrateTx = db.transaction(() => {
    for (const row of oldRows) {
      const newPlantId = seedMapByUser[row.user_id]?.[row.plant_id];
      if (!newPlantId) {
        console.warn(
          `[db] Migration: Pflanze "${row.plant_id}" (Nutzer ${row.user_id}) nicht gefunden — Pflanzung ${row.id} wird übersprungen.`,
        );
        continue;
      }
      insertMigrated.run({ ...row, plant_id: newPlantId });
    }
  });
  migrateTx();

  db.exec('DROP TABLE plantings_legacy_text_plant_id');
  console.log(`[db] Migration abgeschlossen (${oldRows.length} Pflanzungen geprüft).`);
}
