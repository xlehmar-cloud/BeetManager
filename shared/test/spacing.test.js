import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPlacement, isCenterWithinBed, isWithinBedBounds, radiusFor } from '../src/spacing.js';

const plantsById = {
  tomate: { id: 'tomate', spacingMinCm: 50 },
  radieschen: { id: 'radieschen', spacingMinCm: 4 },
};

test('radiusFor ist die Hälfte des Mindestabstands', () => {
  assert.equal(radiusFor(plantsById.tomate), 25);
});

test('isWithinBedBounds: kompletter Radius muss im Beet bleiben (nur informativ)', () => {
  assert.equal(isWithinBedBounds(25, 25, 25, 100, 100), true);
  assert.equal(isWithinBedBounds(10, 25, 25, 100, 100), false); // Radius ragt links raus
  assert.equal(isWithinBedBounds(90, 25, 25, 100, 100), false); // Radius ragt rechts raus
});

test('isCenterWithinBed: einzige harte Randregel — nur der Mittelpunkt zählt', () => {
  assert.equal(isCenterWithinBed(10, 25, 100, 100), true); // Radius würde hier überstehen, ist aber erlaubt
  assert.equal(isCenterWithinBed(0, 0, 100, 100), true); // exakt auf der Kante ist erlaubt
  assert.equal(isCenterWithinBed(-1, 25, 100, 100), false); // Mittelpunkt selbst außerhalb ist nicht erlaubt
  assert.equal(isCenterWithinBed(25, 101, 100, 100), false);
});

test('checkPlacement: zu naher Nachbar erzeugt Konflikt', () => {
  const result = checkPlacement(
    { plant_id: 'tomate', x_cm: 50, y_cm: 50 },
    [{ id: 1, plant_id: 'tomate', plant_name: 'Tomate', x_cm: 60, y_cm: 50 }],
    plantsById,
  );
  assert.equal(result.ok, false);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].requiredDistanceCm, 50);
});

test('checkPlacement: ausreichender Abstand ist konfliktfrei', () => {
  const result = checkPlacement(
    { plant_id: 'tomate', x_cm: 50, y_cm: 50 },
    [{ id: 1, plant_id: 'tomate', plant_name: 'Tomate', x_cm: 150, y_cm: 50 }],
    plantsById,
  );
  assert.equal(result.ok, true);
  assert.equal(result.conflicts.length, 0);
});
