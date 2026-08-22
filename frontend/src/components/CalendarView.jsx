import { absoluteMonth, computeGerminationWindow, computeOccupancy } from 'shared/src/timing.js';
import { MONTH_SHORT } from './MonthSelector.jsx';

const MS_PER_DAY = 86400000;

function dayOfYear(date, year) {
  return Math.round((date - new Date(year, 0, 1)) / MS_PER_DAY);
}

/**
 * Gantt-artiges Monatsraster für ein Jahr. Bei method='saatgut' drei Segmente
 * (Keimung, Wachstum, erntereif) statt zwei — das Keimungssegment ist das
 * einzige mit Wochenauflösung: es wird als schmaler, schraffierter Bereich über
 * den Monatsspalten positioniert (Breite proportional zum Kalendertag im Jahr),
 * der Rest des Balkens bleibt monatsgenau. Wiederverwendet in BedPlanner (ein
 * Beet) und Overview (alle Beete, gruppiert nach Beetname).
 */
export default function CalendarView({ plantings, plantsById, year, groupByBedName = false }) {
  const yearStartAbs = absoluteMonth(year, 1);

  const rows = plantings
    .filter((p) => plantsById[p.plant_id])
    .map((planting) => {
      const plant = plantsById[planting.plant_id];
      const occupancy = computeOccupancy(planting, plant);
      const germination = computeGerminationWindow(planting, plant);
      return { planting, plant, occupancy, germination };
    })
    // nur Pflanzungen, die dieses Jahr überhaupt berühren
    .filter(({ occupancy }) => occupancy.sowAbs <= yearStartAbs + 11 && occupancy.bedFreeAbs - 1 >= yearStartAbs)
    .sort((a, b) => a.occupancy.sowAbs - b.occupancy.sowAbs);

  if (rows.length === 0) {
    return <p className="empty-hint">Keine Pflanzungen für {year}.</p>;
  }

  const grouped = groupByBedName
    ? Object.entries(
        rows.reduce((acc, row) => {
          const key = row.planting.bed_name || 'Beet';
          (acc[key] ||= []).push(row);
          return acc;
        }, {}),
      )
    : [[null, rows]];

  return (
    <div className="calendar-view">
      <div className="calendar-header">
        <div className="calendar-label-col" />
        {MONTH_SHORT.map((m) => (
          <div key={m} className="calendar-month-label">
            {m}
          </div>
        ))}
      </div>

      {grouped.map(([bedName, groupRows]) => (
        <div key={bedName || 'all'} className="calendar-group">
          {bedName && <h4 className="calendar-group-title">{bedName}</h4>}
          {groupRows.map(({ planting, plant, occupancy, germination }) => (
            <CalendarRow
              key={planting.id}
              planting={planting}
              plant={plant}
              occupancy={occupancy}
              germination={germination}
              year={year}
              yearStartAbs={yearStartAbs}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function clampCol(absMonth, yearStartAbs) {
  return Math.min(11, Math.max(0, absMonth - yearStartAbs));
}

function CalendarRow({ planting, plant, occupancy, germination, year, yearStartAbs }) {
  const growthStartCol = clampCol(occupancy.sowAbs, yearStartAbs);
  const harvestStartCol = clampCol(occupancy.harvestStartAbs, yearStartAbs);
  const harvestEndCol = clampCol(occupancy.harvestEndAbs, yearStartAbs);

  const clippedBefore = occupancy.sowAbs < yearStartAbs;
  const clippedAfter = occupancy.bedFreeAbs - 1 > yearStartAbs + 11;

  let germStyle = null;
  if (germination) {
    const startDay = dayOfYear(germination.startDate, year);
    const endDay = dayOfYear(germination.endDate, year);
    const daysInYear = 365;
    const leftPct = Math.max(0, (startDay / daysInYear) * 100);
    const widthPct = Math.max(0.6, ((endDay - startDay) / daysInYear) * 100);
    germStyle = { left: `${leftPct}%`, width: `${widthPct}%` };
  }

  return (
    <div className="calendar-row">
      <div className="calendar-label-col" title={planting.plant_name_snapshot}>
        {clippedBefore && '‹ '}
        {planting.plant_name_snapshot}
        {clippedAfter && ' ›'}
      </div>
      <div className="calendar-track">
        {/* Wachstumsphase: Aussaat/Pflanzung bis Erntebeginn */}
        <div
          className="calendar-bar calendar-bar-growth"
          style={{ gridColumn: `${growthStartCol + 1} / ${harvestStartCol + 2}` }}
          title={`${planting.method === 'historisch' ? 'Historisch erfasst' : 'Wachstum'}`}
        />
        {/* Erntefenster bis Beet wieder frei */}
        <div
          className="calendar-bar calendar-bar-harvest"
          style={{ gridColumn: `${harvestStartCol + 1} / ${harvestEndCol + 2}` }}
          title="Erntefenster"
        />
        {germStyle && (
          <div
            className="calendar-bar calendar-bar-germination"
            style={germStyle}
            title={germination ? `Keimung ca. KW ${germination.startWeek}–${germination.endWeek}` : ''}
          />
        )}
      </div>
    </div>
  );
}
