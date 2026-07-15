import assert from 'node:assert/strict';
import test from 'node:test';
import { cards } from '../src/data/cards.js';
import { getModeById, modes } from '../src/data/modes.js';

const availableModeIds = modes.map((mode) => mode.id);
const removedModeIds = new Set(['team', 'custom']);

test('csak a négy támogatott játékmód választható', () => {
  assert.deepEqual(availableModeIds, ['classic', 'bold', 'hardcore', 'university']);
});

test('az eltávolított módokhoz nem maradt beépített kártya', () => {
  assert.equal(cards.some((card) => removedModeIds.has(card.mode)), false);
});

test('egy korábban eltárolt eltávolított mód biztonságosan a Klasszikusra áll vissza', () => {
  assert.equal(getModeById('team').id, 'classic');
  assert.equal(getModeById('custom').id, 'classic');
});
