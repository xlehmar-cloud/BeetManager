import { Router } from 'express';
import { db } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { getOwnedBed } from './beds.js';
import { getPlantsForUser } from '../userPlants.js';
import { computeOccupancy } from 'shared/src/timing.js';
import { checkPlacement, isCenterWithinBed } from 'shared/src/spacing.js';

// mergeParams: braucht Zugriff auf :id (Beet-ID) aus dem Eltern-Router (beds.js).
const router = Router({ mergeParams: true });
const METHODS = ['saatgut', 'setzling', 'historisch'];

router.use(authenticate);

function loadBedOr404(req, res) {
  const bed = getOwnedBed(req.params.id, req.user.id);
  if (!bed) {
    res.status(404).json({ error: 'Beet nicht gefunden.' });
    return null;
  }
  return bed;
}

/**
 * Validiert eine Pflanzung gegen den (benutzerabhängigen!) Katalog, Methode,
 * Monat/Jahr, Rand-Regel (nur der Mittelpunkt muss im Beet liegen, der Radius
 * darf überstehen) und harte Abstandsprüfung zu anderen Pflanzungen (nur bei
 * method !== 'historisch'). Bei PUT wird die eigene Pflanzung
 * (excludePlantingId) von der Abstandsprüfung ausgenommen.
 */
function validatePlantingInput(userId, bed, body, { excludePlantingId } = {}) {
  const { plant_id, method, year, month, x_cm, y_cm } = body || {};
  const plantsById = Object.fromEntries(getPlantsForUser(userId).map((p) => [p.id, p]));
  const plant = plantsById[plant_id];
  if (!plant) return { status: 400, error: 'Unbekannte Pflanze.' };

  if (!METHODS.includes(method)) return { status: 400, error: 'Ungültige Methode.' };
  const allowedMethods = new Set([...(plant.methods || []), 'historisch']);
  if (!allowedMethods.has(method)) {
    return { status: 400, error: `${plant.name} unterstützt die Methode "${method}" nicht.` };
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { status: 400, error: 'Monat muss zwischen 1 und 12 liegen.' };
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { status: 400, error: 'Ungültiges Jahr.' };
  }

  // Historische Erfassung: keine exakte Position, daher auch keine Geometrieprüfung.
  if (method === 'historisch') {
    return { plant, x_cm: null, y_cm: null };
  }

  if (!Number.isFinite(x_cm) || !Number.isFinite(y_cm)) {
    return { status: 400, error: 'Position (x_cm/y_cm) ist bei dieser Methode erforderlich.' };
  }

  // Nur der Mittelpunkt muss im Beet liegen — der Sicherheitsradius darf über
  // den Rand hinausragen (wird im Frontend abgeschnitten dargestellt).
  if (!isCenterWithinBed(x_cm, y_cm, bed.width_cm, bed.length_cm)) {
    return { status: 400, error: 'Die Position liegt außerhalb des Beets.' };
  }

  const candidateOccupancy = computeOccupancy({ year, month }, plant);
  const candidateEnd = candidateOccupancy.bedFreeAbs - 1;

  const rows = db
    .prepare(
      `SELECT id, plant_id, plant_name_snapshot, year, month, x_cm, y_cm
       FROM plantings
       WHERE bed_id = ? AND x_cm IS NOT NULL AND y_cm IS NOT NULL AND id != ?`,
    )
    .all(bed.id, excludePlantingId ?? -1);

  const concurrent = rows
    .filter((row) => {
      const rowPlant = plantsById[row.plant_id];
      if (!rowPlant) return false;
      const occ = computeOccupancy({ year: row.year, month: row.month }, rowPlant);
      const rowEnd = occ.bedFreeAbs - 1;
      // Zwei Belegungsintervalle [start, end] überlappen sich.
      return candidateOccupancy.sowAbs <= rowEnd && occ.sowAbs <= candidateEnd;
    })
    .map((row) => ({
      id: row.id,
      plant_id: row.plant_id,
      plant_name: row.plant_name_snapshot,
      x_cm: row.x_cm,
      y_cm: row.y_cm,
    }));

  const placement = checkPlacement({ plant_id, x_cm, y_cm }, concurrent, plantsById);
  if (!placement.ok) {
    return {
      status: 409,
      error: 'Zu geringer Abstand zu bereits bestehenden Pflanzungen in diesem Zeitraum.',
      conflicts: placement.conflicts,
    };
  }

  return { plant, x_cm, y_cm };
}

router.get('/', (req, res) => {
  const bed = loadBedOr404(req, res);
  if (!bed) return;
  const year = req.query.year ? Number(req.query.year) : null;
  const rows = year
    ? db
        .prepare('SELECT * FROM plantings WHERE bed_id = ? AND year = ? ORDER BY year, month')
        .all(bed.id, year)
    : db.prepare('SELECT * FROM plantings WHERE bed_id = ? ORDER BY year, month').all(bed.id);
  res.json({ plantings: rows });
});

router.post('/', (req, res) => {
  const bed = loadBedOr404(req, res);
  if (!bed) return;

  const validation = validatePlantingInput(req.user.id, bed, req.body);
  if (validation.error) {
    return res
      .status(validation.status)
      .json({ error: validation.error, ...(validation.conflicts ? { conflicts: validation.conflicts } : {}) });
  }

  const { plant, x_cm, y_cm } = validation;
  const { method, year, month, notes } = req.body;

  const result = db
    .prepare(
      `INSERT INTO plantings
         (bed_id, plant_id, plant_name_snapshot, plant_family_snapshot, plant_zehrertyp_snapshot,
          method, year, month, x_cm, y_cm, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      bed.id,
      plant.id,
      plant.name,
      plant.family,
      plant.zehrertyp,
      method,
      year,
      month,
      x_cm,
      y_cm,
      typeof notes === 'string' && notes.trim() ? notes.trim() : null,
    );

  const planting = db.prepare('SELECT * FROM plantings WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ planting });
});

router.put('/:plantingId', (req, res) => {
  const bed = loadBedOr404(req, res);
  if (!bed) return;

  const existing = db
    .prepare('SELECT * FROM plantings WHERE id = ? AND bed_id = ?')
    .get(req.params.plantingId, bed.id);
  if (!existing) return res.status(404).json({ error: 'Pflanzung nicht gefunden.' });

  const validation = validatePlantingInput(req.user.id, bed, req.body, { excludePlantingId: existing.id });
  if (validation.error) {
    return res
      .status(validation.status)
      .json({ error: validation.error, ...(validation.conflicts ? { conflicts: validation.conflicts } : {}) });
  }

  const { plant, x_cm, y_cm } = validation;
  const { method, year, month, notes } = req.body;

  db.prepare(
    `UPDATE plantings
     SET plant_id = ?, plant_name_snapshot = ?, plant_family_snapshot = ?, plant_zehrertyp_snapshot = ?,
         method = ?, year = ?, month = ?, x_cm = ?, y_cm = ?, notes = ?
     WHERE id = ?`,
  ).run(
    plant.id,
    plant.name,
    plant.family,
    plant.zehrertyp,
    method,
    year,
    month,
    x_cm,
    y_cm,
    typeof notes === 'string' && notes.trim() ? notes.trim() : null,
    existing.id,
  );

  const planting = db.prepare('SELECT * FROM plantings WHERE id = ?').get(existing.id);
  res.json({ planting });
});

router.delete('/:plantingId', (req, res) => {
  const bed = loadBedOr404(req, res);
  if (!bed) return;
  const existing = db
    .prepare('SELECT id FROM plantings WHERE id = ? AND bed_id = ?')
    .get(req.params.plantingId, bed.id);
  if (!existing) return res.status(404).json({ error: 'Pflanzung nicht gefunden.' });

  db.prepare('DELETE FROM plantings WHERE id = ?').run(existing.id);
  res.status(204).end();
});

export default router;
