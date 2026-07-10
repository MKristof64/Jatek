export function getCardSourceModes(modeId) {
  return modeId === 'university' ? ['bold', 'hardcore', 'university'] : [modeId];
}

export function createRoomCode() {
  const range = 900000;
  const maxAcceptedValue = Math.floor(0x100000000 / range) * range;
  const randomValue = new Uint32Array(1);

  do {
    globalThis.crypto.getRandomValues(randomValue);
  } while (randomValue[0] >= maxAcceptedValue);

  return String(100000 + (randomValue[0] % range));
}

export function pickRandomCard(pool, usedIds = []) {
  if (pool.length === 0) return { card: null, usedIds };

  const usedIdSet = new Set(usedIds);
  const availableCards = pool.filter((card) => !usedIdSet.has(card.id));
  const hasUnusedCards = availableCards.length > 0;
  const nextPool = hasUnusedCards ? availableCards : pool;
  const card = nextPool[Math.floor(Math.random() * nextPool.length)];

  return {
    card,
    usedIds: hasUnusedCards ? [...usedIds, card.id] : [card.id],
  };
}

export function pickTargetIndex(players, playerIndex, modeId = 'classic') {
  const playerIndexes = players.map((_, index) => index);
  const oppositeTeamTargets =
    modeId === 'team'
      ? playerIndexes.filter((index) => index !== playerIndex && index % 2 !== playerIndex % 2)
      : [];
  const targets =
    oppositeTeamTargets.length > 0
      ? oppositeTeamTargets
      : playerIndexes.filter((index) => index !== playerIndex);

  if (targets.length === 0) return playerIndex;
  return targets[Math.floor(Math.random() * targets.length)];
}

export function shufflePlayerIndexes(players) {
  const indexes = players.map((_, index) => index);

  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [indexes[index], indexes[randomIndex]] = [indexes[randomIndex], indexes[index]];
  }

  return indexes;
}

function pickRandomPlayerIndexes(players, count) {
  return shufflePlayerIndexes(players).slice(0, Math.min(count, players.length));
}

export function getParticipantIndexes(card, players, playerIndex) {
  if (!card) return [];
  if (card.kind === 'roundtable') return [];
  if (card.kind === 'duel') return pickRandomPlayerIndexes(players, 2);
  return [playerIndex];
}

export function buildTeams(players) {
  if (players.length < 2) return [];

  return [
    {
      id: 'neon',
      name: 'Neon csapat',
      players: players.filter((_, index) => index % 2 === 0),
    },
    {
      id: 'lime',
      name: 'Lime csapat',
      players: players.filter((_, index) => index % 2 === 1),
    },
  ].filter((team) => team.players.length > 0);
}
