// Geometrie: Mindestabstand zwischen Pflanzungen und Rand-Regel.
// Identisch von Backend (harte Durchsetzung) und Frontend (Live-Vorschau beim
// Platzieren) genutzt — Abweichung würde sich als kaputte UX anfühlen.

/** Sicherheitsradius einer Pflanze = die Hälfte ihres recherchierten Mindestabstands. */
export function radiusFor(plant) {
  return plant.spacingMinCm / 2;
}

function distance(a, b) {
  return Math.hypot(a.x_cm - b.x_cm, a.y_cm - b.y_cm);
}

/**
 * Die einzige harte Randregel: der Mittelpunkt der Pflanzung muss innerhalb der
 * Beetfläche liegen. Der Sicherheitsradius darf über den Rand hinausragen —
 * bewusste Produktentscheidung: Randbepflanzung soll möglich sein, der
 * überstehende Teil des Radius wird in der UI nur abgeschnitten dargestellt
 * (SVG-Clipping), nicht blockiert.
 */
export function isCenterWithinBed(x_cm, y_cm, widthCm, lengthCm) {
  return x_cm >= 0 && x_cm <= widthCm && y_cm >= 0 && y_cm <= lengthCm;
}

/**
 * Rein informativ (treibt die rote Randmarkierung der Live-Vorschau) — ragt der
 * komplette Sicherheitsradius über die Beetfläche hinaus? Blockiert die
 * Platzierung NICHT (s. isCenterWithinBed oben für die tatsächliche harte Regel).
 */
export function isWithinBedBounds(x_cm, y_cm, radiusCm, widthCm, lengthCm) {
  return (
    x_cm - radiusCm >= 0 &&
    x_cm + radiusCm <= widthCm &&
    y_cm - radiusCm >= 0 &&
    y_cm + radiusCm <= lengthCm
  );
}

/**
 * Prüft eine Kandidat-Platzierung gegen bereits bestehende, zeitlich überlappende
 * Pflanzungen desselben Beets (Kreisüberlappung, Radius = spacingMinCm / 2).
 *
 * @param candidate {plant_id, x_cm, y_cm}
 * @param existingConcurrentPlacements [{id, plant_id, plant_name, x_cm, y_cm}]
 * @param plantsById Katalog-Lookup { [plantId]: plant }
 * @returns {{ ok: boolean, conflicts: Array }}
 */
export function checkPlacement(candidate, existingConcurrentPlacements, plantsById) {
  const candidatePlant = plantsById[candidate.plant_id];
  const candidateRadius = radiusFor(candidatePlant);
  const conflicts = [];

  for (const existing of existingConcurrentPlacements) {
    const existingPlant = plantsById[existing.plant_id];
    if (!existingPlant) continue;
    const existingRadius = radiusFor(existingPlant);
    const requiredDistanceCm = candidateRadius + existingRadius;
    const actualDistanceCm = distance(candidate, existing);

    if (actualDistanceCm < requiredDistanceCm) {
      conflicts.push({
        plantingId: existing.id,
        plantName: existing.plant_name,
        requiredDistanceCm,
        actualDistanceCm,
      });
    }
  }

  return { ok: conflicts.length === 0, conflicts };
}
