import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRoomCode,
  getCardSourceModes,
  getParticipantIndexes,
  pickRandomCard,
  pickTargetIndex,
  shufflePlayerIndexes,
} from '../src/lib/gameEngine.js';

const players = Array.from({ length: 8 }, (_, index) => ({
  id: `player-${index}`,
  name: `Játékos ${index + 1}`,
}));

test('a szobakód mindig hatjegyű és kellően változatos', () => {
  const codes = Array.from({ length: 100 }, createRoomCode);
  assert.ok(codes.every((code) => /^\d{6}$/.test(code)));
  assert.ok(new Set(codes).size >= 95);
});

test('egy pakli teljesen lemegy ismétlődés előtt', () => {
  const pool = Array.from({ length: 40 }, (_, index) => ({ id: `card-${index}` }));
  let usedIds = [];
  const firstCycle = [];

  for (let index = 0; index < pool.length; index += 1) {
    const picked = pickRandomCard(pool, usedIds);
    firstCycle.push(picked.card.id);
    usedIds = picked.usedIds;
  }

  assert.equal(new Set(firstCycle).size, pool.length);
  const nextCycle = pickRandomCard(pool, usedIds);
  assert.equal(nextCycle.usedIds.length, 1);
});

test('a játékossorrend kevert, de minden játékost pontosan egyszer tartalmaz', () => {
  const order = shufflePlayerIndexes(players);
  assert.deepEqual([...order].sort((a, b) => a - b), players.map((_, index) => index));
});

test('a céljátékos nem lehet az aktuális játékos', () => {
  for (let index = 0; index < 50; index += 1) {
    assert.notEqual(pickTargetIndex(players, 3), 3);
  }
});

test('a kártyatípus a megfelelő számú résztvevőt emeli ki', () => {
  assert.deepEqual(getParticipantIndexes({ kind: 'never' }, players, 4), [4]);
  assert.deepEqual(getParticipantIndexes({ kind: 'roundtable' }, players, 4), []);
  const duel = getParticipantIndexes({ kind: 'duel' }, players, 4);
  assert.equal(duel.length, 2);
  assert.equal(new Set(duel).size, 2);
});

test('az Egyetemista mód a Merész és Hardcore paklit is használja', () => {
  assert.deepEqual(getCardSourceModes('university'), ['bold', 'hardcore', 'university']);
  assert.deepEqual(getCardSourceModes('classic'), ['classic']);
});
