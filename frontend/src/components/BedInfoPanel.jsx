import { computeGerminationWindow, computeOccupancy, fromAbsoluteMonth } from 'shared/src/timing.js';
import { MONTH_NAMES } from './MonthSelector.jsx';

function formatAbsMonth(absMonth) {
  const { year, month } = fromAbsoluteMonth(absMonth);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/**
 * Fasst Pflanzungen mit identischer Pflanze/Methode/Aussaatzeitpunkt zu einer
 * Gruppe zusammen — deren Aussaat-/Ernte-/Keimfenster ist durch dieselben Eingaben
 * ohnehin identisch, es macht also keinen Unterschied, welches konkrete Exemplar
 * als Repräsentant der Gruppe dient.
 */
function groupPlantings(plantings) {
  const groups = new Map();
  for (const planting of plantings) {
    const key = `${planting.plant_id}-${planting.method}-${planting.year}-${planting.month}`;
    if (!groups.has(key)) {
      groups.set(key, { key, planting, count: 0, ids: [] });
    }
    const group = groups.get(key);
    group.count += 1;
    group.ids.push(planting.id);
  }
  return [...groups.values()];
}

/**
 * Stichpunkt-Zusammenfassung pro Beet: Aussaat → Erntefenster → Beet-frei-Termin,
 * bei Saatgut zusätzlich die wochengenaue Keimangabe (dieselbe Berechnung wie im
 * CalendarView-Keimungssegment). Mehrere gleiche Pflanzungen (z.B. 3× Erdbeere zum
 * selben Zeitpunkt) erscheinen als eine Zeile mit Anzahl statt dreimal derselben
 * Meldung — die Zeile aktualisiert sich einfach mit, wenn weitere dazukommen.
 */
export default function BedInfoPanel({ plantings, plantsById, onRemove }) {
  const active = plantings.filter((p) => plantsById[p.plant_id]);

  if (active.length === 0) {
    return <p className="empty-hint">Noch keine Pflanzungen in diesem Beet.</p>;
  }

  return (
    <ul className="bed-info-panel">
      {groupPlantings(active).map(({ key, planting, count, ids }) => {
        const plant = plantsById[planting.plant_id];
        const occupancy = computeOccupancy(planting, plant);
        const germination = computeGerminationWindow(planting, plant);

        return (
          <li key={key} className="bed-info-item">
            <div className="bed-info-item-header">
              <strong>{count > 1 ? `${count}× ${planting.plant_name_snapshot}` : planting.plant_name_snapshot}</strong>
              {onRemove && (
                // Bei mehreren identischen Einträgen (z.B. mehrfach nachgetragene
                // Historie zum selben Zeitpunkt) entfernt ein Klick nur eine
                // Instanz aus der Gruppe — für exakte Positionen ist zusätzlich
                // die Auswahl über den Beet-Canvas möglich; für Historie-Einträge
                // (ohne Position) ist dies der einzige Entfernen-Weg.
                <button
                  type="button"
                  className="danger small"
                  onClick={() => onRemove(ids[0])}
                  aria-label={`${planting.plant_name_snapshot} entfernen`}
                >
                  Entfernen
                </button>
              )}
            </div>
            <span className="bed-info-detail">Aussaat/Pflanzung: {formatAbsMonth(occupancy.sowAbs)}</span>
            {germination && (
              <span className="bed-info-detail bed-info-germination">
                Keimung: ca. KW {germination.startWeek}–{germination.endWeek}
              </span>
            )}
            <span className="bed-info-detail">
              Erntefenster: {formatAbsMonth(occupancy.harvestStartAbs)} – {formatAbsMonth(occupancy.harvestEndAbs)}
            </span>
            <span className="bed-info-detail">Beet wieder frei ab: {formatAbsMonth(occupancy.bedFreeAbs)}</span>
          </li>
        );
      })}
    </ul>
  );
}
