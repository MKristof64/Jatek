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

const initialGame = {
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

function createId(prefix) {
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

function pickRandomPlayerIndexes(players, count) {
  const indexes = players.map((_, index) => index);
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [indexes[index], indexes[randomIndex]] = [indexes[randomIndex], indexes[index]];
  }

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
  const [players, setPlayers] = useState(() => loadJson(storageKeys.players, []));
  const [customCards, setCustomCards] = useState(() =>
    loadJson(storageKeys.customCards, []),
  );
  const [settings, setSettings] = useState(() => ({
    ...defaultSettings,
    ...loadJson(storageKeys.settings, defaultSettings),
  }));
  const [selectedMode, setSelectedMode] = useState('classic');
  const [game, setGame] = useState(initialGame);
  const [pendingExit, setPendingExit] = useState('exit');

  useEffect(() => {
    localStorage.setItem(storageKeys.players, JSON.stringify(players));
  }, [players]);

  useEffect(() => {
    localStorage.setItem(storageKeys.customCards, JSON.stringify(customCards));
  }, [customCards]);

  useEffect(() => {
    localStorage.setItem(storageKeys.settings, JSON.stringify(settings));
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
    setPlayers((currentPlayers) => [
      ...currentPlayers,
      { id: createId('player'), name },
    ]);
  };

  const removePlayer = (id) => {
    setPlayers((currentPlayers) =>
      currentPlayers.filter((player) => player.id !== id),
    );
  };

  const addCustomCard = (text) => {
    setCustomCards((currentCards) => [
      { id: createId('custom'), text, safe: true },
      ...currentCards,
    ]);
  };

  const deleteCustomCard = (id) => {
    setCustomCards((currentCards) => currentCards.filter((card) => card.id !== id));
  };

  const startGame = () => {
    if (players.length < 2 || cardPool.length === 0) return;
    const picked = pickRandomCard(cardPool);
    setGame({
      ...initialGame,
      playerIndex: 0,
      targetIndex: pickTargetIndex(players, 0, selectedMode),
      participantIndexes: getParticipantIndexes(picked.card, players, 0),
      card: picked.card,
      usedIds: picked.usedIds,
    });
    playFeedback(settings);
    setPage(pages.game);
  };

  const advanceGame = () => {
    const nextPlayerIndex = (game.playerIndex + 1) % players.length;
    const picked = pickRandomCard(cardPool, game.usedIds);

    setGame({
      playerIndex: nextPlayerIndex,
      targetIndex: pickTargetIndex(players, nextPlayerIndex, selectedMode),
      participantIndexes: getParticipantIndexes(picked.card, players, nextPlayerIndex),
      card: picked.card,
      usedIds: picked.usedIds,
    });
    playFeedback(settings);
  };

  const clearData = () => {
    Object.values(storageKeys).forEach((key) => localStorage.removeItem(key));
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
