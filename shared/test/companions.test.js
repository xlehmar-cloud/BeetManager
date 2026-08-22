import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterNearby, getCompanionWarnings } from '../src/companions.js';

const plantsById = {
  tomate: {
    id: 'tomate',
    name: 'Tomate',
    spacingMinCm: 50,
    companions: { good: [], bad: [{ id: 'kartoffel', reason: 'Beide Nachtschattengewächse.' }] },
  },
  kartoffel: { id: 'kartoffel', name: 'Kartoffel', spacingMinCm: 30, companions: { good: [], bad: [] } },
  basilikum: { id: 'basilikum', name: 'Basilikum', spacingMinCm: 20, companions: { good: [], bad: [] } },
};

test('getCompanionWarnings findet bidirektionale bad-Beziehung', () => {
  const warnings = getCompanionWarnings('tomate', ['kartoffel'], plantsById);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].plantId, 'kartoffel');
});

test('getCompanionWarnings: keine Warnung bei unbekannter Nachbarschaft', () => {
  const warnings = getCompanionWarnings('tomate', ['basilikum'], plantsById);
  assert.equal(warnings.length, 0);
});

test('filterNearby: nur Pflanzungen innerhalb des 1.5x-Radius-Schwellwerts', () => {
  const candidate = { plant_id: 'tomate', x_cm: 0, y_cm: 0 };
  const placements = [
    { plant_id: 'kartoffel', x_cm: 10, y_cm: 0 }, // nah
    { plant_id: 'kartoffel', x_cm: 500, y_cm: 0 }, // weit weg
  ];
  const nearby = filterNearby(candidate, placements, plantsById);
  assert.equal(nearby.length, 1);
  assert.equal(nearby[0].x_cm, 10);
});
