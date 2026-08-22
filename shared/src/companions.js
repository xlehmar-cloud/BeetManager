// Mischkultur-Warnungen: rein beratend, läuft nur im Frontend.
import { radiusFor } from './spacing.js';

const NEARBY_FACTOR = 1.5;

function distance(a, b) {
  return Math.hypot(a.x_cm - b.x_cm, a.y_cm - b.y_cm);
}

/**
 * "Nahe" = 1.5 × (radiusA + radiusB), nicht beetweit — filtert aus allen zeitlich
 * überlappenden Pflanzungen diejenigen heraus, die geometrisch nah genug an der
 * Kandidat-Position liegen, um mischkultur-relevant zu sein.
 */
export function filterNearby(candidate, concurrentPlacements, plantsById) {
  const candidatePlant = plantsById[candidate.plant_id];
  if (!candidatePlant) return [];
  const candidateRadius = radiusFor(candidatePlant);

  return concurrentPlacements.filter((other) => {
    const otherPlant = plantsById[other.plant_id];
    if (!otherPlant) return false;
    const threshold = NEARBY_FACTOR * (candidateRadius + radiusFor(otherPlant));
    return distance(candidate, other) <= threshold;
  });
}

/**
 * Mischkultur-Warnungen für eine Kandidat-Pflanze gegen bereits als "nahe"
 * eingestufte Nachbar-Pflanzen-IDs. Bidirektional geprüft: eine "bad"-Beziehung
 * zählt unabhängig davon, in wessen Katalogeintrag sie eingetragen ist.
 *
 * @returns [{ plantId, plantName, reason }]
 */
export function getCompanionWarnings(candidatePlantId, nearbyConcurrentPlantIds, plantsById) {
  const candidatePlant = plantsById[candidatePlantId];
  if (!candidatePlant) return [];
  const warnings = [];
  const seen = new Set();

  for (const nearbyId of nearbyConcurrentPlantIds) {
    // Kein genereller Selbst-Ausschluss: Selbstunverträglichkeit (z.B. Radieschen
    // neben Radieschen) wird pflanzenspezifisch über einen expliziten Eintrag in
    // companions.bad abgebildet, nicht pauschal unterdrückt.
    if (seen.has(nearbyId)) continue;
    const nearbyPlant = plantsById[nearbyId];
    if (!nearbyPlant) continue;

    const fromCandidate = (candidatePlant.companions?.bad || []).find((b) => b.id === nearbyId);
    const fromNearby = (nearbyPlant.companions?.bad || []).find((b) => b.id === candidatePlantId);
    const match = fromCandidate || fromNearby;

    if (match) {
      seen.add(nearbyId);
      warnings.push({
        plantId: nearbyId,
        plantName: nearbyPlant.name,
        reason: match.reason,
      });
    }
  }

  return warnings;
}
