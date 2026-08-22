// Fruchtfolge-Warnungen: rein beratend, läuft nur im Frontend. Arbeitet auf den
// plant_*_snapshot-Feldern der Pflanzungen (auch method='historisch'-Einträge),
// beetweit statt nur nah an der Kandidat-Position.

/**
 * @param bedHistory Vergangene/aktuelle Pflanzungen desselben Beets, jeweils
 *   { plant_id, plant_name_snapshot, plant_family_snapshot, plant_zehrertyp_snapshot, year, month }
 * @param candidatePlant Katalogeintrag der Kandidat-Pflanze (nicht Snapshot — die
 *   Regel prüft gegen die *aktuelle* Katalogdefinition, s. PLAN.md)
 * @param candidateYear Jahr der Kandidat-Pflanzung
 * @returns [{ type: 'family' | 'zehrertyp', message }]
 */
export function getRotationWarnings(bedHistory, candidatePlant, candidateYear) {
  const warnings = [];

  // Regel 1: gleiche Pflanzenfamilie taucht innerhalb der Anbaupause wieder auf.
  const sameFamily = bedHistory
    .filter((p) => p.plant_family_snapshot === candidatePlant.family && p.year <= candidateYear)
    .sort((a, b) => b.year - a.year || b.month - a.month)[0];

  if (sameFamily) {
    const gap = candidateYear - sameFamily.year;
    if (gap < candidatePlant.rotationGapYears) {
      warnings.push({
        type: 'family',
        message: `${candidatePlant.name} gehört zur gleichen Familie wie ${sameFamily.plant_name_snapshot} (${sameFamily.year}) in diesem Beet — empfohlene Anbaupause: ${candidatePlant.rotationGapYears} Jahre, bisher erst ${gap}.`,
      });
    }
  }

  // Regel 2: die unmittelbar vorangegangene Bepflanzung war ebenfalls Starkzehrer
  // (leichtgewichtige Abbildung des Starkzehrer→Mittelzehrer→Schwachzehrer-Prinzips).
  const previous = bedHistory
    .filter((p) => p.year <= candidateYear)
    .sort((a, b) => b.year - a.year || b.month - a.month)[0];

  if (
    previous &&
    previous.plant_zehrertyp_snapshot === 'stark' &&
    candidatePlant.zehrertyp === 'stark'
  ) {
    warnings.push({
      type: 'zehrertyp',
      message: `Die vorherige Pflanzung (${previous.plant_name_snapshot}, ${previous.year}) war bereits ein Starkzehrer, ${candidatePlant.name} ist es auch — besser einen Mittel-/Schwachzehrer dazwischen planen.`,
    });
  }

  return warnings;
}
