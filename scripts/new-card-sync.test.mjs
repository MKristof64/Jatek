import assert from 'node:assert/strict';
import test from 'node:test';
import { boldCards } from '../cloudflare/feedback-worker/src/bold-cards.js';
import { hardcoreCards as workerHardcoreCards } from '../cloudflare/feedback-worker/src/hardcore-cards.js';
import { boldSpicyCards } from '../src/data/boldSpicyCards.js';
import { hardcoreCards } from '../src/data/hardcoreCards.js';

const addedCards = [
  ['bold-pikans-v2-never-279', 'bold'],
  ['bold-pikans-v2-never-280', 'bold'],
  ['bold-pikans-v2-never-281', 'bold'],
  ['bold-pikans-v2-never-282', 'bold'],
  ['bold-pikans-v2-never-283', 'bold'],
  ['bold-pikans-v2-never-284', 'bold'],
  ['bold-pikans-v2-never-285', 'bold'],
  ['bold-pikans-v2-never-286', 'bold'],
  ['hardcore-v1-never-115', 'hardcore'],
  ['hardcore-v1-never-116', 'hardcore'],
  ['hardcore-v1-never-117', 'hardcore'],
  ['hardcore-v1-never-118', 'hardcore'],
  ['hardcore-v1-never-119', 'hardcore'],
];

test('the new bold and hardcore cards are identical in the game and controller sources', () => {
  const gameCards = new Map([...boldSpicyCards, ...hardcoreCards].map((card) => [card.id, card]));
  const controllerCards = new Map(
    [...boldCards, ...workerHardcoreCards].map((card) => [card.id, card]),
  );

  assert.equal(addedCards.length, 13);

  addedCards.forEach(([id, mode]) => {
    const gameCard = gameCards.get(id);
    const controllerCard = controllerCards.get(id);

    assert.ok(gameCard, `Missing game card ${id}`);
    assert.ok(controllerCard, `Missing controller card ${id}`);
    assert.equal(gameCard.mode, mode);
    assert.equal(gameCard.kind, 'never');
    assert.equal(gameCard.title, 'Én még sosem...');
    assert.equal(controllerCard.mode, gameCard.mode);
    assert.equal(controllerCard.kind, gameCard.kind);
    assert.equal(controllerCard.title, gameCard.title);
    assert.equal(controllerCard.text, gameCard.text);
    assert.equal(controllerCard.durationSeconds, 0);
  });
});
