import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  absoluteMonth,
  isSowablePlantable,
  matchesStandort,
  computeOccupancy,
  computeGerminationWindow,
  getIsoWeek,
} from '../src/timing.js';

test('absoluteMonth ist streng monoton über Jahresgrenzen hinweg', () => {
  assert.ok(absoluteMonth(2026, 12) < absoluteMonth(2027, 1));
});

test('isSowablePlantable: historisch ist immer erlaubt', () => {
  const plant = { sowing: { direct: [], transplant: [] } };
  assert.equal(isSowablePlantable(plant, 3, 'historisch'), true);
});

test('isSowablePlantable prüft die passende Methode', () => {
  const plant = { sowing: { direct: [3, 4], transplant: [5] } };
  assert.equal(isSowablePlantable(plant, 3, 'saatgut'), true);
  assert.equal(isSowablePlantable(plant, 5, 'saatgut'), false);
  assert.equal(isSowablePlantable(plant, 5, 'setzling'), true);
});

test('matchesStandort', () => {
  const plant = { standort: ['sonne', 'halbschatten'] };
  assert.equal(matchesStandort(plant, 'sonne'), true);
  assert.equal(matchesStandort(plant, 'schatten'), false);
});

test('computeOccupancy mit festem Erntemonat-Bereich', () => {
  const plant = { harvest: { startMonth: 7, endMonth: 10 } };
  const occ = computeOccupancy({ year: 2026, month: 5 }, plant);
  assert.equal(occ.sowAbs, absoluteMonth(2026, 5));
  assert.equal(occ.harvestStartAbs, absoluteMonth(2026, 7));
  assert.equal(occ.harvestEndAbs, absoluteMonth(2026, 10));
  assert.equal(occ.bedFreeAbs, absoluteMonth(2026, 11));
});

test('computeOccupancy mit Erntefenster über den Jahreswechsel (Lauch)', () => {
  const plant = { harvest: { startMonth: 6, endMonth: 4 } };
  const occ = computeOccupancy({ year: 2026, month: 4 }, plant);
  assert.equal(occ.harvestStartAbs, absoluteMonth(2026, 6));
  assert.equal(occ.harvestEndAbs, absoluteMonth(2027, 4));
});

test('computeOccupancy mit Tagen-bis-Ernte (Radieschen)', () => {
  const plant = { harvest: { daysToHarvestMin: 28, daysToHarvestMax: 56 } };
  const occ = computeOccupancy({ year: 2026, month: 3 }, plant);
  // Aussaat = 15. März 2026; +28 Tage ≈ 12. April, +56 Tage ≈ 10. Mai.
  assert.equal(occ.harvestStartAbs, absoluteMonth(2026, 4));
  assert.equal(occ.harvestEndAbs, absoluteMonth(2026, 5));
  assert.equal(occ.bedFreeAbs, absoluteMonth(2026, 6));
});

test('getIsoWeek: bekannte Referenzdaten', () => {
  assert.equal(getIsoWeek(new Date(2026, 0, 1)), 1); // 1.1.2026 ist ein Donnerstag → KW1
  assert.equal(getIsoWeek(new Date(2026, 11, 31)), 53);
});

test('computeGerminationWindow nur für Saatgut mit Keimdaten', () => {
  const plant = { germination: { daysMin: 3, daysMax: 7 } };
  const withSaatgut = computeGerminationWindow({ method: 'saatgut', year: 2026, month: 3 }, plant);
  assert.ok(withSaatgut);
  assert.ok(withSaatgut.startWeek <= withSaatgut.endWeek);

  const withSetzling = computeGerminationWindow({ method: 'setzling', year: 2026, month: 3 }, plant);
  assert.equal(withSetzling, null);

  const plantWithoutGermination = { germination: { daysMin: null, daysMax: null } };
  const noData = computeGerminationWindow(
    { method: 'saatgut', year: 2026, month: 3 },
    plantWithoutGermination,
  );
  assert.equal(noData, null);
});
