import { getModeById } from '../data/modes.js';

export const SAVED_GAMES_STORAGE_KEY = 'enmegsosem.savedGames.v1';
export const SAVED_GAMES_SCHEMA_VERSION = 1;
export const MAX_SAVED_GAMES = 12;
export const MAX_PLAYED_CARDS_PER_GAME = 600;

const allowedCardKinds = new Set(['never', 'duel', 'roundtable']);

function sanitizeText(value, maxLength) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

function sanitizeId(value, maxLength = 100) {
  if (typeof value !== 'string') return '';
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, maxLength);
}

function sanitizeTimestamp(value, fallback) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function sanitizeIndex(value, playerCount, fallback = 0) {
  if (!Number.isInteger(value) || value < 0 || value >= playerCount) return fallback;
  return value;
}

function sanitizeIndexList(value, playerCount, limit = playerCount) {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  return value
    .filter((index) => {
      if (!Number.isInteger(index) || index < 0 || index >= playerCount || seen.has(index)) {
        return false;
      }
      seen.add(index);
      return true;
    })
    .slice(0, limit);
}

function sanitizePlayers(value) {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, 24)
    .map((player, index) => ({
      id: sanitizeId(player?.id, 80) || `saved-player-${index + 1}`,
      name: sanitizeText(player?.name, 24),
    }))
    .filter((player) => player.name.length > 0);
}

function sanitizeCard(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const id = sanitizeId(value.id, 80);
  const text = sanitizeText(value.text, 320);
  if (!id || !text) return null;

  return {
    id,
    mode: getModeById(value.mode).id,
    kind: allowedCardKinds.has(value.kind) ? value.kind : 'never',
    title: sanitizeText(value.title, 80) || 'Én még sosem...',
    text,
    durationSeconds: Number.isFinite(value.durationSeconds)
      ? Math.max(0, Math.min(120, Math.floor(value.durationSeconds)))
      : 0,
    safe: value.safe !== false,
  };
}

function sanitizeTimer(value, card, now) {
  const durationSeconds = Number.isFinite(value?.durationSeconds)
    ? Math.max(0, Math.min(120, Math.floor(value.durationSeconds)))
    : card?.durationSeconds ?? 0;
  let remainingSeconds = Number.isFinite(value?.remainingSeconds)
    ? Math.max(0, Math.min(durationSeconds, Math.ceil(value.remainingSeconds)))
    : durationSeconds;

  if (value?.running && remainingSeconds > 0) {
    const updatedAt = Number.isFinite(value.updatedAt) ? value.updatedAt : now;
    const elapsedSeconds = Math.max(0, Math.floor((now - updatedAt) / 1000));
    remainingSeconds = Math.max(0, remainingSeconds - elapsedSeconds);
  }

  return {
    cardId: card?.id ?? null,
    durationSeconds,
    remainingSeconds,
    running: false,
    updatedAt: now,
  };
}

function sanitizeGame(value, playerCount, now) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const card = sanitizeCard(value.card);
  if (!card) return null;

  const playerOrder = sanitizeIndexList(value.playerOrder, playerCount);
  const completedPlayerOrder = [
    ...playerOrder,
    ...Array.from({ length: playerCount }, (_, index) => index).filter(
      (index) => !playerOrder.includes(index),
    ),
  ];
  const fallbackPlayerIndex = completedPlayerOrder[0] ?? 0;
  const playerIndex = sanitizeIndex(value.playerIndex, playerCount, fallbackPlayerIndex);
  const targetFallback = playerCount > 1 ? (playerIndex + 1) % playerCount : playerIndex;
  const targetIndex = sanitizeIndex(value.targetIndex, playerCount, targetFallback);
  const maxOrderPosition = Math.max(0, completedPlayerOrder.length - 1);
  const orderPosition = Number.isInteger(value.orderPosition)
    ? Math.max(0, Math.min(maxOrderPosition, value.orderPosition))
    : Math.max(0, completedPlayerOrder.indexOf(playerIndex));
  const usedIds = Array.isArray(value.usedIds)
    ? value.usedIds
        .map((id) => sanitizeId(id, 80))
        .filter(Boolean)
        .slice(0, 2000)
    : [card.id];

  if (!usedIds.includes(card.id)) usedIds.push(card.id);

  return {
    playerOrder: completedPlayerOrder,
    orderPosition,
    playerIndex,
    targetIndex,
    participantIndexes: sanitizeIndexList(value.participantIndexes, playerCount),
    card,
    usedIds,
    timer: sanitizeTimer(value.timer, card, now),
  };
}

function sanitizePlayedCard(value, index, fallbackTime) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const id = sanitizeId(value.id, 80);
  const text = sanitizeText(value.text, 320);
  if (!id || !text) return null;

  return {
    id,
    mode: getModeById(value.mode).id,
    kind: allowedCardKinds.has(value.kind) ? value.kind : 'never',
    title: sanitizeText(value.title, 80) || 'Én még sosem...',
    text,
    sequence: Number.isInteger(value.sequence) && value.sequence > 0
      ? value.sequence
      : index + 1,
    playedAt: sanitizeTimestamp(value.playedAt, fallbackTime),
  };
}

export function sanitizeSavedGame(value, now = Date.now()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const id = sanitizeId(value.id, 120);
  const players = sanitizePlayers(value.players);
  const game = sanitizeGame(value.game, players.length, now);
  if (!id || players.length < 2 || !game) return null;

  const createdAt = sanitizeTimestamp(value.createdAt, now);
  const updatedAt = sanitizeTimestamp(value.updatedAt, createdAt);
  const playedCards = (Array.isArray(value.playedCards) ? value.playedCards : [])
    .map((card, index) => sanitizePlayedCard(card, index, createdAt))
    .filter(Boolean)
    .slice(-MAX_PLAYED_CARDS_PER_GAME);

  return {
    schemaVersion: SAVED_GAMES_SCHEMA_VERSION,
    id,
    createdAt,
    updatedAt,
    modeId: getModeById(value.modeId).id,
    players,
    game,
    cardOptions: {
      includeDuelCards: value.cardOptions?.includeDuelCards !== false,
      includeRoundtableCards: value.cardOptions?.includeRoundtableCards !== false,
    },
    playedCards,
  };
}

export function sanitizeSavedGames(value, now = Date.now()) {
  if (!Array.isArray(value)) return [];

  const gamesById = new Map();
  value.forEach((entry) => {
    const game = sanitizeSavedGame(entry, now);
    if (!game) return;

    const existing = gamesById.get(game.id);
    if (!existing || game.updatedAt > existing.updatedAt) {
      gamesById.set(game.id, game);
    }
  });

  return [...gamesById.values()]
    .sort((first, second) => second.updatedAt - first.updatedAt)
    .slice(0, MAX_SAVED_GAMES);
}

export function loadSavedGames(storage = globalThis.localStorage) {
  try {
    const serialized = storage?.getItem(SAVED_GAMES_STORAGE_KEY);
    return serialized ? sanitizeSavedGames(JSON.parse(serialized)) : [];
  } catch {
    return [];
  }
}

export function storeSavedGames(games, storage = globalThis.localStorage) {
  const sanitizedGames = sanitizeSavedGames(games);

  try {
    storage?.setItem(SAVED_GAMES_STORAGE_KEY, JSON.stringify(sanitizedGames));
    return { games: sanitizedGames, ok: true };
  } catch {
    return { games: sanitizedGames, ok: false };
  }
}

export function createSavedGameId() {
  if (globalThis.crypto?.randomUUID) {
    return `saved-game-${globalThis.crypto.randomUUID()}`;
  }

  return `saved-game-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createSavedGameSnapshot({
  id,
  players,
  modeId,
  game,
  cardOptions,
  renderedCardText,
  previous = null,
  now = Date.now(),
}) {
  const safePlayers = sanitizePlayers(players);
  const safeGame = sanitizeGame(game, safePlayers.length, now);
  if (!sanitizeId(id, 120) || safePlayers.length < 2 || !safeGame) return null;

  const safePrevious = previous ? sanitizeSavedGame(previous, now) : null;
  const previousPlayedCards = safePrevious?.playedCards ?? [];
  const previousGame = safePrevious?.game ?? null;
  const shouldAppendCurrentCard =
    previousPlayedCards.length === 0 ||
    previousGame?.card?.id !== safeGame.card.id ||
    previousGame?.usedIds?.length !== safeGame.usedIds.length ||
    previousGame?.orderPosition !== safeGame.orderPosition;
  const playedCards = shouldAppendCurrentCard
    ? [
        ...previousPlayedCards,
        {
          id: safeGame.card.id,
          mode: safeGame.card.mode,
          kind: safeGame.card.kind,
          title: safeGame.card.title,
          text: sanitizeText(renderedCardText, 320) || safeGame.card.text,
          sequence: (previousPlayedCards.at(-1)?.sequence ?? 0) + 1,
          playedAt: now,
        },
      ].slice(-MAX_PLAYED_CARDS_PER_GAME)
    : previousPlayedCards;

  return sanitizeSavedGame(
    {
      schemaVersion: SAVED_GAMES_SCHEMA_VERSION,
      id,
      createdAt: safePrevious?.createdAt ?? now,
      updatedAt: now,
      modeId,
      players: safePlayers,
      game: safeGame,
      cardOptions,
      playedCards,
    },
    now,
  );
}

export function upsertSavedGame(games, savedGame) {
  if (!savedGame) return sanitizeSavedGames(games);
  return sanitizeSavedGames([
    savedGame,
    ...(Array.isArray(games) ? games.filter((entry) => entry?.id !== savedGame.id) : []),
  ]);
}

export function deleteSavedGame(games, savedGameId) {
  const safeId = sanitizeId(savedGameId, 120);
  return sanitizeSavedGames(
    Array.isArray(games) ? games.filter((entry) => entry?.id !== safeId) : [],
  );
}
