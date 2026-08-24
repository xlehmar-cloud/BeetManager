import { computeOccupancy, fromAbsoluteMonth } from 'shared/src/timing.js';
import { radiusFor } from 'shared/src/spacing.js';
import { MONTH_NAMES } from './MonthSelector.jsx';
import PlantMarker from './PlantMarker.jsx';
import PlantIcon from '../icons/PlantIcons.jsx';

const METHOD_LABELS = { saatgut: 'Saatgut (Direktsaat)', setzling: 'Setzling', historisch: 'Historisch' };
const STANDORT_LABELS = { sonne: 'Sonne', halbschatten: 'Halbschatten', schatten: 'Schatten' };

function formatAbsMonth(absMonth) {
  const { year, month } = fromAbsoluteMonth(absMonth);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/**
 * Gruppiert wie BedInfoPanel (gleiche Pflanze/Methode/Zeitpunkt fasst sich zu
 * einer Zeile mit Menge zusammen) und sortiert chronologisch — auf dem
 * Ausdruck soll man von oben nach unten "was kommt wann dran" lesen können.
 */
function groupForPrint(plantings) {
  const groups = new Map();
  for (const planting of plantings) {
    const key = `${planting.plant_id}-${planting.method}-${planting.year}-${planting.month}`;
    if (!groups.has(key)) {
      groups.set(key, { key, planting, count: 0 });
    }
    groups.get(key).count += 1;
  }
  return [...groups.values()].sort(
    (a, b) => a.planting.year - b.planting.year || a.planting.month - b.planting.month,
  );
}

/**
 * Ein-Seiten-Übersicht zum Ausdrucken (bzw. "Als PDF speichern" über den
 * Browser-Druckdialog — dafür braucht es keine eigene PDF-Erzeugung). Wird
 * per CSS (`.print-only`, s. planner.css) auf dem Bildschirm ausgeblendet und
 * erscheint nur in `@media print`. Gedacht als Einkaufs-/Pflanz-Zettel: was
 * muss besorgt werden, wann kommt was in die Erde.
 */
export default function BedPrintSheet({ bed, plantings, plantsById }) {
  const known = plantings.filter((p) => plantsById[p.plant_id]);
  const rows = groupForPrint(known);
  // Historische Einträge (method='historisch') haben keine Position (s.
  // HistoryForm) und lassen sich daher nicht einzeichnen — sie erscheinen nur
  // in der Tabelle, genau wie im Canvas des Planers selbst.
  const placed = known.filter((p) => p.x_cm != null && p.y_cm != null);
  const today = new Date().toLocaleDateString('de-DE');
  const clipId = `bed-print-clip-${bed.id}`;

  return (
    <div className="bed-print-sheet print-only">
      <h1>{bed.name}</h1>
      <p className="bed-print-meta">
        {bed.width_cm} × {bed.length_cm} cm · Standort: {STANDORT_LABELS[bed.standort] || bed.standort} · Stand:{' '}
        {today}
      </p>

      {placed.length > 0 && (
        <svg
          className="bed-print-diagram"
          viewBox={`0 0 ${bed.width_cm} ${bed.length_cm}`}
          role="img"
          aria-label={`Lageplan Beet ${bed.name}`}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x="0" y="0" width={bed.width_cm} height={bed.length_cm} />
            </clipPath>
          </defs>
          <rect x="0" y="0" width={bed.width_cm} height={bed.length_cm} className="bed-soil" rx="4" />
          <g clipPath={`url(#${clipId})`}>
            {placed.map((p) => {
              const plant = plantsById[p.plant_id];
              return (
                <PlantMarker key={p.id} x={p.x_cm} y={p.y_cm} radiusCm={radiusFor(plant)} icon={plant.icon} />
              );
            })}
          </g>
        </svg>
      )}

      {rows.length === 0 ? (
        <p>Keine Pflanzungen erfasst.</p>
      ) : (
        <table className="bed-print-table">
          <thead>
            <tr>
              <th className="bed-print-check-col"></th>
              <th className="bed-print-icon-col"></th>
              <th>Pflanze</th>
              <th>Menge</th>
              <th>Art</th>
              <th>Aussaat/Pflanzung</th>
              <th>Mindestabstand</th>
              <th>Erntefenster</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, planting, count }) => {
              const plant = plantsById[planting.plant_id];
              const occupancy = computeOccupancy(planting, plant);
              return (
                <tr key={key}>
                  <td className="bed-print-check-col">☐</td>
                  <td className="bed-print-icon-col">
                    <PlantIcon icon={plant.icon} className="bed-print-icon" />
                  </td>
                  <td>{planting.plant_name_snapshot}</td>
                  <td>{count}</td>
                  <td>{METHOD_LABELS[planting.method] || planting.method}</td>
                  <td>{formatAbsMonth(occupancy.sowAbs)}</td>
                  <td>
                    {plant.spacingMinCm}
                    {plant.spacingMaxCm ? `–${plant.spacingMaxCm}` : ''} cm
                  </td>
                  <td>
                    {formatAbsMonth(occupancy.harvestStartAbs)} – {formatAbsMonth(occupancy.harvestEndAbs)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p className="bed-print-footer">Erstellt mit Beet-Planer</p>
    </div>
  );
}
