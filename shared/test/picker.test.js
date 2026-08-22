import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterPlantable } from '../src/picker.js';

const plants = [
  { id: 'tomate', standort: ['sonne'], methods: ['setzling'], sowing: { direct: [], transplant: [5] } },
  { id: 'radieschen', standort: ['sonne', 'halbschatten'], methods: ['saatgut'], sowing: { direct: [3, 4, 5], transplant: [] } },
  { id: 'erdbeere', standort: ['sonne', 'halbschatten'], methods: ['setzling'], sowing: { direct: [], transplant: [7, 8] } },
];

test('filtert nach Standort und Monat, ergänzt availableMethods', () => {
  const result = filterPlantable(plants, { month: 5, standort: 'sonne' });
  const ids = result.map((p) => p.id);
  assert.deepEqual(ids.sort(), ['radieschen', 'tomate']);

  const tomate = result.find((p) => p.id === 'tomate');
  assert.deepEqual(tomate.availableMethods, ['setzling']);
});

test('schließt Pflanzen an nicht passendem Standort aus', () => {
  const result = filterPlantable(plants, { month: 7, standort: 'sonne' });
  assert.equal(result.some((p) => p.id === 'erdbeere'), true);

  const resultHalbschatten = filterPlantable(plants, { month: 7, standort: 'halbschatten' });
  assert.equal(resultHalbschatten.some((p) => p.id === 'tomate'), false);
});
