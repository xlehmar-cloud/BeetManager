import { db } from './db.js';
import { FAMILY_LABELS } from './plantSeed.js';

const ICONS = ['fruit', 'root', 'leaf', 'legume', 'herb', 'berry', 'tuber', 'stalk'];
const STANDORTE = ['sonne', 'halbschatten', 'schatten'];
const METHODS = ['saatgut', 'setzling'];

function parseJsonArray(text) {
  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/**
 * Baut aus einer plants-Zeile + ihren companion-Zeilen dasselbe JSON-Schema,
 * das vorher aus plants.json kam (s. PLANTS_SCHEMA.md) — der komplette
 * Frontend-Code (shared/*.js, PlantPicker, BedCanvas, CalendarView, …) bleibt
 * dadurch unverändert nutzbar, ob eine Pflanze aus dem Startkatalog stammt
 * oder vom Nutzer selbst angelegt wurde.
 */
function rowToPlant(row, companionRows) {
  const good = companionRows.filter((c) => c.plant_id === row.id && c.relation === 'good');
  const bad = companionRows.filter((c) => c.plant_id === row.id && c.relation === 'bad');

  return {
    id: row.id,
    name: row.name,
    family: row.family || null,
    familyLabel: row.family ? FAMILY_LABELS[row.family] || row.family : null,
    zehrertyp: row.zehrertyp,
    standort: parseJsonArray(row.standort),
    methods: parseJsonArray(row.methods),
    sowing: {
      direct: parseJsonArray(row.sowing_direct_months),
      transplant: parseJsonArray(row.sowing_transplant_months),
      note: row.sowing_note || null,
    },
    germination: {
      daysMin: row.germination_days_min,
      daysMax: row.germination_days_max,
      note:
        row.germination_days_min != null
          ? `Keimdauer ca. ${row.germination_days_min}–${row.germination_days_max} Tage.`
          : null,
    },
    harvest: {
      startMonth: row.harvest_start_month,
      endMonth: row.harvest_end_month,
      daysToHarvestMin: row.harvest_days_min,
      daysToHarvestMax: row.harvest_days_max,
      note: row.harvest_note || null,
    },
    spacingMinCm: row.spacing_min_cm,
    spacingMaxCm: row.spacing_max_cm,
    companions: {
      good: good.map((c) => c.companion_plant_id),
      bad: bad.map((c) => ({ id: c.companion_plant_id, reason: c.reason || null })),
    },
    rotationGapYears: row.rotation_gap_years,
    icon: row.icon,
    isBuiltin: !!row.is_builtin,
  };
}

/** Alle Pflanzen eines Nutzers, inkl. companions — Basis für GET /api/plants. */
export function getPlantsForUser(userId) {
  const rows = db.prepare('SELECT * FROM plants WHERE user_id = ? ORDER BY name').all(userId);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const companionRows = db
    .prepare(`SELECT * FROM plant_companions WHERE plant_id IN (${placeholders})`)
    .all(...ids);
  return rows.map((row) => rowToPlant(row, companionRows));
}

/** Eine einzelne Pflanze, nur wenn sie dem Nutzer gehört (sonst null). */
export function getPlantForUser(userId, plantId) {
  const row = db.prepare('SELECT * FROM plants WHERE id = ? AND user_id = ?').get(plantId, userId);
  if (!row) return null;
  const companionRows = db.prepare('SELECT * FROM plant_companions WHERE plant_id = ?').all(row.id);
  return rowToPlant(row, companionRows);
}

/** Prüft, dass alle angegebenen IDs existierende Pflanzen desselben Nutzers sind. */
function allOwnedByUser(userId, ids) {
  if (ids.length === 0) return true;
  const placeholders = ids.map(() => '?').join(',');
  const { c } = db
    .prepare(`SELECT COUNT(*) c FROM plants WHERE user_id = ? AND id IN (${placeholders})`)
    .get(userId, ...ids);
  return c === ids.length;
}

/**
 * Baut aus (from, to) eine Monatsliste 1-12, mit Jahreswechsel-Unterstützung
 * (z.B. 10 -> 2 ergibt [10,11,12,1,2]) — das UI erfasst nur einen
 * zusammenhängenden Zeitraum, keine verstreuten Einzelmonate.
 */
function monthRange(from, to) {
  const months = [];
  let m = from;
  // Absicherung gegen Endlosschleife bei kaputten Eingaben (sollte durch
  // validatePlantInput vorher schon verhindert sein).
  for (let i = 0; i < 12; i++) {
    months.push(m);
    if (m === to) break;
    m = (m % 12) + 1;
  }
  return months;
}

const VALID_MONTH = (m) => Number.isInteger(m) && m >= 1 && m <= 12;

/**
 * Validiert den Formular-Body für POST/PUT /api/plants. Wirft kein Error-Objekt,
 * gibt stattdessen { error } (400) oder die normalisierten Felder zurück —
 * gleiches Muster wie validatePlantingInput in routes/plantings.js.
 */
export function validatePlantInput(userId, body, { excludePlantId } = {}) {
  const {
    name,
    family,
    zehrertyp,
    standort,
    methods,
    sowingDirectFrom,
    sowingDirectTo,
    sowingTransplantFrom,
    sowingTransplantTo,
    germinationDaysMin,
    germinationDaysMax,
    harvestFromMonth,
    harvestToMonth,
    spacingMinCm,
    spacingMaxCm,
    rotationGapYears,
    icon,
    companionsGood,
    companionsBad,
  } = body || {};

  if (typeof name !== 'string' || name.trim().length === 0) {
    return { error: 'Bitte eine Bezeichnung angeben.' };
  }
  if (!['stark', 'mittel', 'schwach'].includes(zehrertyp)) {
    return { error: 'Zehrertyp muss stark, mittel oder schwach sein.' };
  }
  if (!Array.isArray(standort) || standort.length === 0 || !standort.every((s) => STANDORTE.includes(s))) {
    return { error: 'Bitte mindestens einen Standort auswählen.' };
  }
  if (!Array.isArray(methods) || methods.length === 0 || !methods.every((m) => METHODS.includes(m))) {
    return { error: 'Bitte mindestens eine Methode (Saatgut/Setzling) auswählen.' };
  }
  if (family != null && !FAMILY_LABELS[family]) {
    return { error: 'Unbekannte Pflanzenfamilie.' };
  }
  if (!Number.isFinite(spacingMinCm) || spacingMinCm <= 0) {
    return { error: 'Bitte einen gültigen Mindestabstand (cm) angeben.' };
  }
  if (spacingMaxCm != null && (!Number.isFinite(spacingMaxCm) || spacingMaxCm < spacingMinCm)) {
    return { error: 'Der Höchstabstand darf nicht kleiner als der Mindestabstand sein.' };
  }
  if (!VALID_MONTH(harvestFromMonth) || !VALID_MONTH(harvestToMonth)) {
    return { error: 'Bitte einen gültigen Erntezeitraum (Monat 1–12) angeben.' };
  }
  if (icon != null && !ICONS.includes(icon)) {
    return { error: 'Unbekanntes Symbol.' };
  }

  let sowingDirect = [];
  if (methods.includes('saatgut')) {
    if (!VALID_MONTH(sowingDirectFrom) || !VALID_MONTH(sowingDirectTo)) {
      return { error: 'Bitte einen gültigen Aussaatzeitraum für Saatgut angeben.' };
    }
    sowingDirect = monthRange(sowingDirectFrom, sowingDirectTo);
  }

  let sowingTransplant = [];
  if (methods.includes('setzling')) {
    if (!VALID_MONTH(sowingTransplantFrom) || !VALID_MONTH(sowingTransplantTo)) {
      return { error: 'Bitte einen gültigen Pflanzzeitraum für Setzlinge angeben.' };
    }
    sowingTransplant = monthRange(sowingTransplantFrom, sowingTransplantTo);
  }

  const hasGermMin = germinationDaysMin != null && germinationDaysMin !== '';
  const hasGermMax = germinationDaysMax != null && germinationDaysMax !== '';
  if (hasGermMin !== hasGermMax) {
    return { error: 'Keimdauer bitte als vollständige Spanne (von und bis) angeben.' };
  }
  if (hasGermMin && (!Number.isFinite(germinationDaysMin) || !Number.isFinite(germinationDaysMax) || germinationDaysMin > germinationDaysMax)) {
    return { error: 'Ungültige Keimdauer.' };
  }

  const goodIds = Array.isArray(companionsGood) ? [...new Set(companionsGood)] : [];
  const badEntries = Array.isArray(companionsBad) ? companionsBad : [];
  const badIds = badEntries.map((b) => b.id);

  if (goodIds.includes(excludePlantId) || badIds.includes(excludePlantId)) {
    return { error: 'Eine Pflanze kann nicht ihre eigene Nachbarin sein.' };
  }
  if (!allOwnedByUser(userId, [...goodIds, ...badIds])) {
    return { error: 'Nachbar-Pflanze nicht gefunden.' };
  }
  for (const bad of badEntries) {
    if (!Number.isInteger(bad.id) || typeof bad.reason !== 'string' || bad.reason.trim().length === 0) {
      return { error: 'Bitte für jede schlechte Nachbarschaft einen Grund angeben.' };
    }
  }

  return {
    name: name.trim(),
    family: family || null,
    zehrertyp,
    standort,
    methods,
    sowingDirect,
    sowingTransplant,
    sowingNote: null,
    germinationDaysMin: hasGermMin ? germinationDaysMin : null,
    germinationDaysMax: hasGermMin ? germinationDaysMax : null,
    harvestStartMonth: harvestFromMonth,
    harvestEndMonth: harvestToMonth,
    spacingMinCm,
    spacingMaxCm: spacingMaxCm ?? null,
    rotationGapYears: Number.isInteger(rotationGapYears) && rotationGapYears > 0 ? rotationGapYears : 4,
    icon: icon || 'leaf',
    companionsGood: goodIds,
    companionsBad: badEntries.map((b) => ({ id: b.id, reason: b.reason.trim() })),
  };
}

/** Erstellt eine neue Pflanze (is_builtin=0) inkl. companions. */
export function createPlant(userId, data) {
  const result = db
    .prepare(
      `INSERT INTO plants
        (user_id, name, family, zehrertyp, standort, methods,
         sowing_direct_months, sowing_transplant_months, sowing_note,
         germination_days_min, germination_days_max,
         harvest_start_month, harvest_end_month, harvest_days_min, harvest_days_max, harvest_note,
         spacing_min_cm, spacing_max_cm, rotation_gap_years, icon, is_builtin)
       VALUES
        (@user_id, @name, @family, @zehrertyp, @standort, @methods,
         @sowing_direct_months, @sowing_transplant_months, @sowing_note,
         @germination_days_min, @germination_days_max,
         @harvest_start_month, @harvest_end_month, NULL, NULL, NULL,
         @spacing_min_cm, @spacing_max_cm, @rotation_gap_years, @icon, 0)`,
    )
    .run(toRowParams(userId, data));

  writeCompanions(result.lastInsertRowid, data);
  return getPlantForUser(userId, result.lastInsertRowid);
}

/** Aktualisiert eine bestehende Pflanze (auch aus dem Startkatalog gesäte). */
export function updatePlant(userId, plantId, data) {
  db.prepare(
    `UPDATE plants SET
       name = @name, family = @family, zehrertyp = @zehrertyp, standort = @standort, methods = @methods,
       sowing_direct_months = @sowing_direct_months, sowing_transplant_months = @sowing_transplant_months,
       sowing_note = @sowing_note,
       germination_days_min = @germination_days_min, germination_days_max = @germination_days_max,
       harvest_start_month = @harvest_start_month, harvest_end_month = @harvest_end_month,
       harvest_days_min = NULL, harvest_days_max = NULL, harvest_note = NULL,
       spacing_min_cm = @spacing_min_cm, spacing_max_cm = @spacing_max_cm,
       rotation_gap_years = @rotation_gap_years, icon = @icon, updated_at = datetime('now')
     WHERE id = @id AND user_id = @user_id`,
  ).run({ ...toRowParams(userId, data), id: plantId });

  db.prepare('DELETE FROM plant_companions WHERE plant_id = ?').run(plantId);
  writeCompanions(plantId, data);
  return getPlantForUser(userId, plantId);
}

function toRowParams(userId, data) {
  return {
    user_id: userId,
    name: data.name,
    family: data.family,
    zehrertyp: data.zehrertyp,
    standort: JSON.stringify(data.standort),
    methods: JSON.stringify(data.methods),
    sowing_direct_months: JSON.stringify(data.sowingDirect),
    sowing_transplant_months: JSON.stringify(data.sowingTransplant),
    sowing_note: data.sowingNote,
    germination_days_min: data.germinationDaysMin,
    germination_days_max: data.germinationDaysMax,
    harvest_start_month: data.harvestStartMonth,
    harvest_end_month: data.harvestEndMonth,
    spacing_min_cm: data.spacingMinCm,
    spacing_max_cm: data.spacingMaxCm,
    rotation_gap_years: data.rotationGapYears,
    icon: data.icon,
  };
}

function writeCompanions(plantId, data) {
  const insert = db.prepare(
    `INSERT INTO plant_companions (plant_id, companion_plant_id, relation, reason) VALUES (?, ?, ?, ?)`,
  );
  for (const goodId of data.companionsGood) {
    insert.run(plantId, goodId, 'good', null);
  }
  for (const bad of data.companionsBad) {
    insert.run(plantId, bad.id, 'bad', bad.reason);
  }
}

/**
 * Löscht eine Pflanze — schlägt fehl (409-artig, s. Aufrufer), wenn sie noch
 * in mindestens einer Pflanzung verwendet wird (FK-Schutz plant_id ->
 * plants.id ohne ON DELETE CASCADE fängt das zusätzlich auf DB-Ebene ab).
 */
export function deletePlant(userId, plantId) {
  const { c } = db
    .prepare(
      `SELECT COUNT(*) c FROM plantings pl
       JOIN beds b ON b.id = pl.bed_id
       WHERE b.user_id = ? AND pl.plant_id = ?`,
    )
    .get(userId, plantId);
  if (c > 0) {
    return { error: 'inUse', count: c };
  }
  db.prepare('DELETE FROM plants WHERE id = ? AND user_id = ?').run(plantId, userId);
  return { ok: true };
}
