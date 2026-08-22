import { Router } from 'express';
import { db } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { isCenterWithinBed } from 'shared/src/spacing.js';
import plantingsRouter from './plantings.js';

const router = Router();
const STANDORTE = ['sonne', 'halbschatten', 'schatten'];

/** Lädt ein Beet und prüft, dass es dem gegebenen Benutzer gehört (sonst null). */
export function getOwnedBed(bedId, userId) {
  return db
    .prepare('SELECT * FROM beds WHERE id = ? AND user_id = ?')
    .get(bedId, userId);
}

function isValidBedInput(body) {
  const { name, width_cm, length_cm, standort } = body || {};
  return (
    typeof name === 'string' &&
    name.trim().length > 0 &&
    Number.isFinite(width_cm) &&
    width_cm > 0 &&
    Number.isFinite(length_cm) &&
    length_cm > 0 &&
    STANDORTE.includes(standort)
  );
}

router.use(authenticate);

router.get('/', (req, res) => {
  const beds = db
    .prepare('SELECT * FROM beds WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.id);
  res.json({ beds });
});

router.post('/', (req, res) => {
  if (!isValidBedInput(req.body)) {
    return res.status(400).json({ error: 'Bitte Name, Breite, Länge (in cm) und Standort angeben.' });
  }
  const { name, width_cm, length_cm, standort } = req.body;

  const result = db
    .prepare(
      'INSERT INTO beds (user_id, name, width_cm, length_cm, standort) VALUES (?, ?, ?, ?, ?)',
    )
    .run(req.user.id, name.trim(), width_cm, length_cm, standort);

  const bed = getOwnedBed(result.lastInsertRowid, req.user.id);
  res.status(201).json({ bed });
});

router.get('/:id', (req, res) => {
  const bed = getOwnedBed(req.params.id, req.user.id);
  if (!bed) return res.status(404).json({ error: 'Beet nicht gefunden.' });
  res.json({ bed });
});

router.put('/:id', (req, res) => {
  const bed = getOwnedBed(req.params.id, req.user.id);
  if (!bed) return res.status(404).json({ error: 'Beet nicht gefunden.' });
  if (!isValidBedInput(req.body)) {
    return res.status(400).json({ error: 'Bitte Name, Breite, Länge (in cm) und Standort angeben.' });
  }
  const { name, width_cm, length_cm, standort } = req.body;

  // Resize-Guard: eine Verkleinerung darf den Mittelpunkt keiner bestehenden
  // Pflanzung außerhalb der neuen Grenzen stranden lassen (der Sicherheitsradius
  // darf über den Rand hinausragen, s. Rand-Regel — daher hier keine Prüfung
  // mehr dagegen).
  if (width_cm < bed.width_cm || length_cm < bed.length_cm) {
    const placedPlantings = db
      .prepare(
        `SELECT id, plant_id, plant_name_snapshot, x_cm, y_cm
         FROM plantings WHERE bed_id = ? AND x_cm IS NOT NULL AND y_cm IS NOT NULL`,
      )
      .all(bed.id);

    const stranded = placedPlantings.filter(
      (p) => !isCenterWithinBed(p.x_cm, p.y_cm, width_cm, length_cm),
    );

    if (stranded.length > 0) {
      return res.status(409).json({
        error: 'Die neue Beetgröße würde bestehende Pflanzungen außerhalb des Beets stranden.',
        strandedPlantings: stranded.map((p) => ({ id: p.id, plantName: p.plant_name_snapshot })),
      });
    }
  }

  db.prepare(
    `UPDATE beds SET name = ?, width_cm = ?, length_cm = ?, standort = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(name.trim(), width_cm, length_cm, standort, bed.id);

  res.json({ bed: getOwnedBed(bed.id, req.user.id) });
});

router.delete('/:id', (req, res) => {
  const bed = getOwnedBed(req.params.id, req.user.id);
  if (!bed) return res.status(404).json({ error: 'Beet nicht gefunden.' });
  db.prepare('DELETE FROM beds WHERE id = ?').run(bed.id); // kaskadiert zu plantings via FK
  res.status(204).end();
});

router.use('/:id/plantings', plantingsRouter);

export default router;
