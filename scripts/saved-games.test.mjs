import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  MAX_SAVED_GAMES,
  SAVED_GAMES_STORAGE_KEY,
  createSavedGameSnapshot,
  deleteSavedGame,
  loadSavedGames,
  storeSavedGames,
  upsertSavedGame,
} from '../src/lib/savedGames.js';

const readProjectFile = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const players = [
  { id: 'player-1', name: 'Anna' },
  { id: 'player-2', name: 'Béla' },
];

const makeGame = ({
  cardId = 'card-1',
  cardText = 'voltam már itt',
  usedIds = [cardId],
  orderPosition = 0,
  playerIndex = 0,
  timer = null,
} = {}) => ({
  playerOrder: [0, 1],
  orderPosition,
  playerIndex,
  targetIndex: playerIndex === 0 ? 1 : 0,
  participantIndexes: [playerIndex],
  card: {
    id: cardId,
    mode: 'bold',
    kind: 'never',
    title: 'Én még sosem...',
    text: cardText,
    durationSeconds: timer?.durationSeconds ?? 0,
    safe: true,
  },
  usedIds,
  timer: timer ?? {
    cardId,
    durationSeconds: 0,
    remainingSeconds: 0,
    running: false,
    updatedAt: 0,
  },
});

const snapshotOptions = {
  id: 'saved-game-test',
  players,
  modeId: 'bold',
  cardOptions: {
    includeDuelCards: true,
    includeRoundtableCards: false,
  },
};

test('a saved game keeps players, deck progress and a rendered card history', () => {
  const first = createSavedGameSnapshot({
    ...snapshotOptions,
    game: makeGame(),
    renderedCardText: 'Anna volt már itt',
    now: 1_000,
  });
  const second = createSavedGameSnapshot({
    ...snapshotOptions,
    game: makeGame({
      cardId: 'card-2',
      cardText: 'küldtem már üzenetet',
      usedIds: ['card-1', 'card-2'],
      orderPosition: 1,
      playerIndex: 1,
    }),
    renderedCardText: 'Béla küldött már üzenetet',
    previous: first,
    now: 2_000,
  });

  assert.deepEqual(second.players, players);
  assert.equal(second.modeId, 'bold');
  assert.equal(second.game.card.id, 'card-2');
  assert.deepEqual(second.game.usedIds, ['card-1', 'card-2']);
  assert.deepEqual(
    second.playedCards.map((card) => card.text),
    ['Anna volt már itt', 'Béla küldött már üzenetet'],
  );
  assert.equal(second.cardOptions.includeRoundtableCards, false);
});

test('timer-only saves do not duplicate the current card and pause elapsed time', () => {
  const first = createSavedGameSnapshot({
    ...snapshotOptions,
    game: makeGame({
      timer: {
        cardId: 'card-1',
        durationSeconds: 30,
        remainingSeconds: 30,
        running: true,
        updatedAt: 1_000,
      },
    }),
    renderedCardText: 'Anna volt már itt',
    now: 6_000,
  });
  const timerUpdate = createSavedGameSnapshot({
    ...snapshotOptions,
    game: first.game,
    renderedCardText: 'Anna volt már itt',
    previous: first,
    now: 7_000,
  });

  assert.equal(first.game.timer.remainingSeconds, 25);
  assert.equal(first.game.timer.running, false);
  assert.equal(timerUpdate.playedCards.length, 1);
});

test('storage round-trip rejects corrupt entries and delete removes only the chosen save', () => {
  const values = new Map();
  const storage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
  const snapshot = createSavedGameSnapshot({
    ...snapshotOptions,
    game: makeGame(),
    renderedCardText: 'Anna volt már itt',
    now: 1_000,
  });

  const result = storeSavedGames([snapshot, { broken: true }], storage);
  assert.equal(result.ok, true);
  assert.equal(JSON.parse(values.get(SAVED_GAMES_STORAGE_KEY)).length, 1);
  assert.equal(loadSavedGames(storage)[0].id, snapshot.id);
  assert.deepEqual(deleteSavedGame(loadSavedGames(storage), snapshot.id), []);
});

test('upsert keeps the newest bounded set of saves', () => {
  let savedGames = [];

  for (let index = 0; index < MAX_SAVED_GAMES + 3; index += 1) {
    const snapshot = createSavedGameSnapshot({
      ...snapshotOptions,
      id: `saved-game-${index}`,
      game: makeGame({ cardId: `card-${index + 1}` }),
      renderedCardText: `Kártya ${index + 1}`,
      now: index + 1,
    });
    savedGames = upsertSavedGame(savedGames, snapshot);
  }

  assert.equal(savedGames.length, MAX_SAVED_GAMES);
  assert.equal(savedGames[0].id, `saved-game-${MAX_SAVED_GAMES + 2}`);
  assert.equal(savedGames.at(-1).id, 'saved-game-3');
});

test('settings and home wire game saving without the removed intro sentence', async () => {
  const [appSource, homeSource, settingsSource] = await Promise.all([
    readProjectFile('src/App.jsx'),
    readProjectFile('src/pages/HomePage.jsx'),
    readProjectFile('src/pages/SettingsPage.jsx'),
  ]);

  assert.match(appSource, /savedGames: SAVED_GAMES_STORAGE_KEY/);
  assert.match(appSource, /createSavedGameSnapshot/);
  assert.match(appSource, /<SavedGamesPage/);
  assert.match(homeSource, /Korábbi játékok/);
  assert.match(settingsSource, /label="Játék mentése"/);
  assert.doesNotMatch(settingsSource, /label="Hang"/);
  assert.doesNotMatch(
    homeSource,
    /Gyors körök, céljátékosok és többféle hangulat egy telefonra szabott kártyás felületen/,
  );
});
