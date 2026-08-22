// Reine Zeit-/Belegungsberechnung für Beet-Pflanzungen.
// Läuft identisch auf Backend (harte Validierung) und Frontend (Live-Vorschau) —
// deshalb keine Abhängigkeit von React/Express/Datum-Bibliotheken, nur JS-Bordmittel.

/**
 * Monat/Jahr auf eine fortlaufende Ganzzahl abgebildet, damit sich Belegungsfenster
 * einfach vergleichen lassen (z.B. Januar 2027 > Dezember 2026).
 */
export function absoluteMonth(year, month) {
  return year * 12 + (month - 1);
}

/** Kehrt absoluteMonth() um, für Anzeige/Debugging. */
export function fromAbsoluteMonth(absMonth) {
  const year = Math.floor(absMonth / 12);
  const month = (absMonth % 12) + 1;
  return { year, month };
}

/**
 * Ist die Pflanze im gegebenen Monat mit der gegebenen Methode aussäh-/pflanzbar?
 * 'historisch' unterliegt keiner Monatsbeschränkung (rückwirkende Erfassung).
 */
export function isSowablePlantable(plant, month, method) {
  if (method === 'historisch') return true;
  if (method === 'saatgut') return (plant.sowing?.direct || []).includes(month);
  if (method === 'setzling') return (plant.sowing?.transplant || []).includes(month);
  return false;
}

/** Passt der Standort-Anspruch der Pflanze zum Standort des Beets? */
export function matchesStandort(plant, bedStandort) {
  return (plant.standort || []).includes(bedStandort);
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function dateToAbsoluteMonth(date) {
  return absoluteMonth(date.getFullYear(), date.getMonth() + 1);
}

/** Angenommenes Aussaat-/Pflanzdatum: Monatsmitte (Konvention, s. PLAN.md). */
function assumedSowDate(year, month) {
  return new Date(year, month - 1, 15);
}

/**
 * Belegungsfenster einer Pflanzung: von Aussaat bis "Beet wieder frei" (einen Monat
 * nach Erntefensterende). Nutzt entweder plant.harvest.startMonth/endMonth (fester
 * Kalendermonat-Bereich, kann über den Jahreswechsel laufen, z.B. Lauch 6→4) oder
 * plant.harvest.daysToHarvestMin/Max (relativ zur Aussaat, für schnelle Kulturen).
 */
export function computeOccupancy(planting, plant) {
  const { year, month } = planting;
  const sowAbs = absoluteMonth(year, month);
  const harvest = plant.harvest || {};

  let harvestStartAbs;
  let harvestEndAbs;

  if (harvest.startMonth != null && harvest.endMonth != null) {
    harvestStartAbs = absoluteMonth(year, harvest.startMonth);
    harvestEndAbs =
      harvest.endMonth >= harvest.startMonth
        ? absoluteMonth(year, harvest.endMonth)
        : absoluteMonth(year + 1, harvest.endMonth);
    // Erntestart darf nie vor der Aussaat liegen (z.B. wenn im Dezember gesät wird).
    if (harvestStartAbs < sowAbs) harvestStartAbs = sowAbs;
    if (harvestEndAbs < harvestStartAbs) harvestEndAbs = harvestStartAbs;
  } else if (harvest.daysToHarvestMin != null && harvest.daysToHarvestMax != null) {
    const sowDate = assumedSowDate(year, month);
    harvestStartAbs = dateToAbsoluteMonth(addDays(sowDate, harvest.daysToHarvestMin));
    harvestEndAbs = dateToAbsoluteMonth(addDays(sowDate, harvest.daysToHarvestMax));
  } else {
    // Keine Erntedaten hinterlegt: Belegung endet defensiv im Aussaatmonat selbst.
    harvestStartAbs = sowAbs;
    harvestEndAbs = sowAbs;
  }

  return {
    sowAbs,
    harvestStartAbs,
    harvestEndAbs,
    bedFreeAbs: harvestEndAbs + 1,
  };
}

/** ISO-8601-Kalenderwoche (Montag-basiert, Donnerstagsregel), Standardalgorithmus. */
export function getIsoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

/**
 * Wochengenaue Keimphase — nur für Saatgut (Direktsaat) und nur wenn die Pflanze
 * Keimdauer-Daten hinterlegt hat. Nimmt dasselbe angenommene Aussaatdatum
 * (Monatsmitte) und addiert die recherchierte Keimdauer in echten Tagen.
 */
export function computeGerminationWindow(planting, plant) {
  if (planting.method !== 'saatgut') return null;
  const { daysMin, daysMax } = plant.germination || {};
  if (daysMin == null || daysMax == null) return null;

  const sowDate = assumedSowDate(planting.year, planting.month);
  const startDate = addDays(sowDate, daysMin);
  const endDate = addDays(sowDate, daysMax);

  return {
    startDate,
    endDate,
    startWeek: getIsoWeek(startDate),
    endWeek: getIsoWeek(endDate),
  };
}
