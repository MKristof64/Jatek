import { useEffect, useMemo, useState } from 'react';
import Layout from './components/Layout.jsx';
import { cards } from './data/cards.js';
import { getModeById } from './data/modes.js';
import ConfirmExitPage from './pages/ConfirmExitPage.jsx';
import CustomCardsPage from './pages/CustomCardsPage.jsx';
import GamePage from './pages/GamePage.jsx';
import HomePage from './pages/HomePage.jsx';
import ModeSelectPage from './pages/ModeSelectPage.jsx';
import PlayersPage from './pages/PlayersPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

const storageKeys = {
  players: 'enmegsosem.players',
  customCards: 'enmegsosem.customCards',
  settings: 'enmegsosem.settings',
};

const defaultSettings = {
  darkMode: true,
  sound: true,
  vibration: true,
  safeMode: true,
};

const limits = {
  players: 24,
  playerNameLength: 24,
  customCards: 120,
  customCardLength: 180,
};

const initialGame = {
  playerOrder: [],
  orderPosition: 0,
  playerIndex: 0,
  targetIndex: 1,
  participantIndexes: [],
  card: null,
  usedIds: [],
};

const pages = {
  home: 'home',
  players: 'players',
  modes: 'modes',
  game: 'game',
  confirmExit: 'confirmExit',
  custom: 'custom',
  settings: 'settings',
};

function loadJson(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be disabled or full; the in-memory game state should still work.
  }
}

function removeStoredKey(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures so clearing data never crashes the UI.
  }
}

function sanitizeText(value, maxLength) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

function sanitizeId(value, fallbackPrefix) {
  if (typeof value !== 'string') return createId(fallbackPrefix);
  const safeId = value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  return safeId || createId(fallbackPrefix);
}

function loadPlayers() {
  const savedPlayers = loadJson(storageKeys.players, []);
  if (!Array.isArray(savedPlayers)) return [];

  return savedPlayers
    .slice(0, limits.players)
    .map((player) => ({
      id: sanitizeId(player?.id, 'player'),
      name: sanitizeText(player?.name, limits.playerNameLength),
    }))
    .filter((player) => player.name.length > 0);
}

function loadCustomCards() {
  const savedCards = loadJson(storageKeys.customCards, []);
  if (!Array.isArray(savedCards)) return [];

  return savedCards
    .slice(0, limits.customCards)
    .map((card) => ({
      id: sanitizeId(card?.id, 'custom'),
      text: sanitizeText(card?.text, limits.customCardLength),
      safe: true,
    }))
    .filter((card) => card.text.length > 0);
}

function loadSettings() {
  const savedSettings = loadJson(storageKeys.settings, {});
  if (!savedSettings || typeof savedSettings !== 'object' || Array.isArray(savedSettings)) {
    return defaultSettings;
  }

  return {
    darkMode:
      typeof savedSettings.darkMode === 'boolean'
        ? savedSettings.darkMode
        : defaultSettings.darkMode,
    sound:
      typeof savedSettings.sound === 'boolean'
        ? savedSettings.sound
        : defaultSettings.sound,
    vibration:
      typeof savedSettings.vibration === 'boolean'
        ? savedSettings.vibration
        : defaultSettings.vibration,
    safeMode:
      typeof savedSettings.safeMode === 'boolean'
        ? savedSettings.safeMode
        : defaultSettings.safeMode,
  };
}

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function pickRandomCard(pool, usedIds = []) {
  if (pool.length === 0) return { card: null, usedIds };
  const availableCards = pool.filter((card) => !usedIds.includes(card.id));
  const nextPool = availableCards.length > 0 ? availableCards : pool;
  const card = nextPool[Math.floor(Math.random() * nextPool.length)];
  return {
    card,
    usedIds: availableCards.length > 0 ? [...usedIds, card.id] : [card.id],
  };
}

function pickTargetIndex(players, playerIndex, modeId = 'classic') {
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

function shufflePlayerIndexes(players) {
  const indexes = players.map((_, index) => index);
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [indexes[index], indexes[randomIndex]] = [indexes[randomIndex], indexes[index]];
  }

  return indexes;
}

function pickRandomPlayerIndexes(players, count) {
  const indexes = shufflePlayerIndexes(players);
  return indexes.slice(0, Math.min(count, indexes.length));
}

function getParticipantIndexes(card, players, playerIndex) {
  if (!card) return [];
  if (card.kind === 'roundtable') return [];
  if (card.kind === 'duel') return pickRandomPlayerIndexes(players, 2);
  return [playerIndex];
}

function buildTeams(players) {
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

function playFeedback(settings) {
  if (settings.vibration && 'vibrate' in navigator) {
    navigator.vibrate(24);
  }

  if (!settings.sound) return;

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.12);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.13);
  } catch {
    // Browser audio can be blocked until user interaction; the game still works.
  }
}

export default function App() {
  const [page, setPage] = useState(pages.home);
  const [players, setPlayers] = useState(loadPlayers);
  const [customCards, setCustomCards] = useState(loadCustomCards);
  const [settings, setSettings] = useState(loadSettings);
  const [selectedMode, setSelectedMode] = useState('classic');
  const [game, setGame] = useState(initialGame);
  const [pendingExit, setPendingExit] = useState('exit');

  useEffect(() => {
    saveJson(storageKeys.players, players);
  }, [players]);

  useEffect(() => {
    saveJson(storageKeys.customCards, customCards);
  }, [customCards]);

  useEffect(() => {
    saveJson(storageKeys.settings, settings);
  }, [settings]);

  const activeMode = useMemo(() => getModeById(selectedMode), [selectedMode]);

  const cardPool = useMemo(() => {
    if (selectedMode === 'custom') {
      return customCards.map((card) => ({
        ...card,
        mode: 'custom',
        safe: true,
      }));
    }

    return cards.filter((card) => {
      const modeMatches = card.mode === selectedMode;
      const safetyMatches = settings.safeMode ? card.safe !== false : true;
      return modeMatches && safetyMatches;
    });
  }, [customCards, selectedMode, settings.safeMode]);

  const teams = useMemo(() => buildTeams(players), [players]);
  const currentPlayerObject = players[game.playerIndex];
  const currentPlayer = currentPlayerObject?.name ?? 'Játékos';
  const targetPlayer = players[game.targetIndex]?.name ?? 'valaki';
  const participants = game.participantIndexes
    .map((index) => players[index])
    .filter(Boolean);
  const currentTeam = activeMode.teamMode
    ? teams.find((team) =>
        team.players.some((player) => player.id === currentPlayerObject?.id),
      )
    : null;
  const cardText = (game.card?.text ?? 'Nincs betöltött kártya ehhez a módhoz.')
    .replaceAll('{player}', currentPlayer)
    .replaceAll('{target}', targetPlayer)
    .trim();

  const addPlayer = (name) => {
    const safeName = sanitizeText(name, limits.playerNameLength);
    if (!safeName) return;

    setPlayers((currentPlayers) => [
      ...currentPlayers.slice(0, limits.players - 1),
      { id: createId('player'), name: safeName },
    ]);
  };

  const removePlayer = (id) => {
    setPlayers((currentPlayers) =>
      currentPlayers.filter((player) => player.id !== id),
    );
  };

  const addCustomCard = (text) => {
    const safeText = sanitizeText(text, limits.customCardLength);
    if (!safeText) return;

    setCustomCards((currentCards) => [
      { id: createId('custom'), text: safeText, safe: true },
      ...currentCards.slice(0, limits.customCards - 1),
    ]);
  };

  const deleteCustomCard = (id) => {
    setCustomCards((currentCards) => currentCards.filter((card) => card.id !== id));
  };

  const startGame = () => {
    if (players.length < 2 || cardPool.length === 0) return;
    const picked = pickRandomCard(cardPool);
    const playerOrder = shufflePlayerIndexes(players);
    const firstPlayerIndex = playerOrder[0] ?? 0;
    setGame({
      ...initialGame,
      playerOrder,
      playerIndex: firstPlayerIndex,
      targetIndex: pickTargetIndex(players, firstPlayerIndex, selectedMode),
      participantIndexes: getParticipantIndexes(picked.card, players, firstPlayerIndex),
      card: picked.card,
      usedIds: picked.usedIds,
    });
    playFeedback(settings);
    setPage(pages.game);
  };

  const advanceGame = () => {
    if (players.length < 2 || cardPool.length === 0) return;
    const playerOrder =
      game.playerOrder.length === players.length
        ? game.playerOrder
        : shufflePlayerIndexes(players);
    if (playerOrder.length === 0) return;

    const currentOrderPosition = Number.isInteger(game.orderPosition)
      ? game.orderPosition
      : Math.max(0, playerOrder.indexOf(game.playerIndex));
    const nextOrderPosition = (currentOrderPosition + 1) % playerOrder.length;
    const nextPlayerIndex = playerOrder[nextOrderPosition] ?? 0;
    const picked = pickRandomCard(cardPool, game.usedIds);

    setGame({
      playerOrder,
      orderPosition: nextOrderPosition,
      playerIndex: nextPlayerIndex,
      targetIndex: pickTargetIndex(players, nextPlayerIndex, selectedMode),
      participantIndexes: getParticipantIndexes(picked.card, players, nextPlayerIndex),
      card: picked.card,
      usedIds: picked.usedIds,
    });
    playFeedback(settings);
  };

  const clearData = () => {
    Object.values(storageKeys).forEach((key) => removeStoredKey(key));
    setPlayers([]);
    setCustomCards([]);
    setSettings(defaultSettings);
    setSelectedMode('classic');
    setGame(initialGame);
    setPage(pages.home);
  };

  const toggleSetting = (key, value) => {
    const nextSettings = {
      ...settings,
      [key]: value,
    };

    setSettings((currentSettings) => ({
      ...currentSettings,
      [key]: value,
    }));

    if ((key === 'sound' || key === 'vibration') && value) {
      window.setTimeout(() => playFeedback(nextSettings), 0);
    }
  };

  const goToStartFlow = () => {
    setPage(players.length >= 2 ? pages.modes : pages.players);
  };

  const requestGameNavigation = (intent) => {
    setPendingExit(intent);
    setPage(pages.confirmExit);
  };

  const confirmGameNavigation = () => {
    setPage(pendingExit === 'home' ? pages.home : pages.modes);
  };

  return (
    <Layout darkMode={settings.darkMode}>
      {page === pages.home ? (
        <HomePage
          playersCount={players.length}
          customCount={customCards.length}
          onStart={goToStartFlow}
          onPlayers={() => setPage(pages.players)}
          onCustomCards={() => setPage(pages.custom)}
          onSettings={() => setPage(pages.settings)}
        />
      ) : null}

      {page === pages.players ? (
        <PlayersPage
          players={players}
          onAdd={addPlayer}
          onRemove={removePlayer}
          onNext={() => setPage(pages.modes)}
          onBack={() => setPage(pages.home)}
        />
      ) : null}

      {page === pages.modes ? (
        <ModeSelectPage
          selectedMode={selectedMode}
          playersCount={players.length}
          customCount={customCards.length}
          onSelectMode={setSelectedMode}
          onStartGame={startGame}
          onBack={() => setPage(pages.players)}
        />
      ) : null}

      {page === pages.game ? (
        <GamePage
          currentPlayer={currentPlayer}
          participants={participants}
          mode={activeMode}
          card={game.card}
          cardText={cardText}
          currentTeam={currentTeam}
          onNext={() => advanceGame('next')}
          onSkip={() => advanceGame('skip')}
          onExit={() => requestGameNavigation('exit')}
          onHome={() => requestGameNavigation('home')}
        />
      ) : null}

      {page === pages.confirmExit ? (
        <ConfirmExitPage
          intent={pendingExit}
          onCancel={() => setPage(pages.game)}
          onConfirm={confirmGameNavigation}
        />
      ) : null}

      {page === pages.custom ? (
        <CustomCardsPage
          customCards={customCards}
          onAddCard={addCustomCard}
          onDeleteCard={deleteCustomCard}
          onBack={() => setPage(pages.home)}
        />
      ) : null}

      {page === pages.settings ? (
        <SettingsPage
          settings={settings}
          onToggle={toggleSetting}
          onClearData={clearData}
          onBack={() => setPage(pages.home)}
        />
      ) : null}
    </Layout>
  );
}
