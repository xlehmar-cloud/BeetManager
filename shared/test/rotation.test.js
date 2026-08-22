import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRotationWarnings } from '../src/rotation.js';

const tomate = { name: 'Tomate', family: 'nachtschattengewaechse', zehrertyp: 'stark', rotationGapYears: 4 };

test('Regel 1: gleiche Familie innerhalb der Anbaupause warnt', () => {
  const history = [
    { plant_id: 'kartoffel', plant_name_snapshot: 'Kartoffel', plant_family_snapshot: 'nachtschattengewaechse', plant_zehrertyp_snapshot: 'stark', year: 2024, month: 5 },
  ];
  const warnings = getRotationWarnings(history, tomate, 2026);
  assert.ok(warnings.some((w) => w.type === 'family'));
});

test('Regel 1: außerhalb der Anbaupause keine Warnung', () => {
  const history = [
    { plant_id: 'kartoffel', plant_name_snapshot: 'Kartoffel', plant_family_snapshot: 'nachtschattengewaechse', plant_zehrertyp_snapshot: 'stark', year: 2020, month: 5 },
  ];
  const warnings = getRotationWarnings(history, tomate, 2026);
  assert.equal(warnings.some((w) => w.type === 'family'), false);
});

test('Regel 2: Starkzehrer direkt nach Starkzehrer warnt', () => {
  const history = [
    { plant_id: 'zucchini', plant_name_snapshot: 'Zucchini', plant_family_snapshot: 'kuerbisgewaechse', plant_zehrertyp_snapshot: 'stark', year: 2025, month: 6 },
  ];
  const warnings = getRotationWarnings(history, tomate, 2026);
  assert.ok(warnings.some((w) => w.type === 'zehrertyp'));
});

test('keine Historie → keine Warnungen', () => {
  assert.deepEqual(getRotationWarnings([], tomate, 2026), []);
});
