import { useEffect, useMemo, useState } from 'react';
import Layout from './components/Layout.jsx';
import { cards } from './data/cards.js';
import { getModeById } from './data/modes.js';
import CustomCardsPage from './pages/CustomCardsPage.jsx';
import GamePage from './pages/GamePage.jsx';
import HomePage from './pages/HomePage.jsx';
import ModeSelectPage from './pages/ModeSelectPage.jsx';
import PlayersPage from './pages/PlayersPage.jsx';
import RoomPage from './pages/RoomPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

const storageKeys = {
  players: 'enmegsosem.players',
  customCards: 'enmegsosem.customCards',
  settings: 'enmegsosem.settings',
  selectedMode: 'enmegsosem.selectedMode',
  game: 'enmegsosem.game',
  room: 'enmegsosem.room',
  currentRoomPlayerId: 'enmegsosem.currentRoomPlayerId',
};

const roomRoles = {
  host: 'host',
  narrator: 'narrator',
  player: 'player',
};

const defaultSettings = {
  darkMode: true,
  sound: true,
  vibration: true,
  safeMode: true,
};

const limits = {
  players: 24,
  roomParticipants: 15,
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
  room: 'room',
  modes: 'modes',
  game: 'game',
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
    const serialized = JSON.stringify(value);
    if (localStorage.getItem(key) !== serialized) {
      localStorage.setItem(key, serialized);
    }
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

function loadSessionJson(key, fallback) {
  try {
    const saved = sessionStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function saveSessionJson(key, value) {
  try {
    const serialized = JSON.stringify(value);
    if (sessionStorage.getItem(key) !== serialized) {
      sessionStorage.setItem(key, serialized);
    }
  } catch {
    // Session storage is best-effort; the current tab state still works.
  }
}

function removeSessionKey(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
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

function loadRoom() {
  const savedRoom = loadJson(storageKeys.room, null);
  if (!savedRoom || typeof savedRoom !== 'object' || Array.isArray(savedRoom)) {
    return null;
  }

  const code = String(savedRoom.code ?? '').replace(/\D/g, '').slice(0, 6);
  const hostPlayerId = sanitizeId(savedRoom.hostPlayerId, 'player');
  const savedRoles =
    savedRoom.rolesByPlayerId && typeof savedRoom.rolesByPlayerId === 'object'
      ? savedRoom.rolesByPlayerId
      : {};
  const rolesByPlayerId = Object.entries(savedRoles).reduce((roles, [playerId, role]) => {
    const safeRole = Object.values(roomRoles).includes(role) ? role : roomRoles.player;
    roles[sanitizeId(playerId, 'player')] = safeRole;
    return roles;
  }, {});

  if (code.length !== 6) return null;

  return {
    code,
    hostPlayerId,
    rolesByPlayerId: {
      ...rolesByPlayerId,
      [hostPlayerId]: roomRoles.host,
    },
    createdAt: Number.isFinite(savedRoom.createdAt) ? savedRoom.createdAt : Date.now(),
  };
}

function getCurrentRoomPlayerStorageKey() {
  try {
    const existingName = typeof window.name === 'string' ? window.name : '';
    if (!existingName.startsWith('enmegsosem-tab-')) {
      const randomPart =
        globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 14);
      window.name = `enmegsosem-tab-${randomPart}`;
    }

    return `${storageKeys.currentRoomPlayerId}.${window.name}`;
  } catch {
    return storageKeys.currentRoomPlayerId;
  }
}

function loadCurrentRoomPlayerId() {
  const savedId = loadSessionJson(getCurrentRoomPlayerStorageKey(), null);
  return typeof savedId === 'string' ? sanitizeId(savedId, 'player') : null;
}

function loadSelectedMode() {
  const savedMode = loadJson(storageKeys.selectedMode, 'classic');
  return getModeById(typeof savedMode === 'string' ? savedMode : 'classic').id;
}

function loadGame() {
  const savedGame = loadJson(storageKeys.game, initialGame);
  if (!savedGame || typeof savedGame !== 'object' || Array.isArray(savedGame)) {
    return initialGame;
  }

  const playerOrder = Array.isArray(savedGame.playerOrder)
    ? savedGame.playerOrder.filter(Number.isInteger)
    : [];
  const participantIndexes = Array.isArray(savedGame.participantIndexes)
    ? savedGame.participantIndexes.filter(Number.isInteger)
    : [];
  const usedIds = Array.isArray(savedGame.usedIds)
    ? savedGame.usedIds.filter((id) => typeof id === 'string').slice(0, 300)
    : [];
  const card =
    savedGame.card && typeof savedGame.card === 'object' && !Array.isArray(savedGame.card)
      ? savedGame.card
      : null;

  return {
    playerOrder,
    orderPosition: Number.isInteger(savedGame.orderPosition) ? savedGame.orderPosition : 0,
    playerIndex: Number.isInteger(savedGame.playerIndex) ? savedGame.playerIndex : 0,
    targetIndex: Number.isInteger(savedGame.targetIndex) ? savedGame.targetIndex : 1,
    participantIndexes,
    card,
    usedIds,
  };
}

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
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
  const [selectedMode, setSelectedMode] = useState(loadSelectedMode);
  const [game, setGame] = useState(loadGame);
  const [room, setRoom] = useState(loadRoom);
  const [currentRoomPlayerId, setCurrentRoomPlayerId] = useState(loadCurrentRoomPlayerId);

  useEffect(() => {
    saveJson(storageKeys.players, players);
  }, [players]);

  useEffect(() => {
    saveJson(storageKeys.customCards, customCards);
  }, [customCards]);

  useEffect(() => {
    saveJson(storageKeys.settings, settings);
  }, [settings]);

  useEffect(() => {
    saveJson(storageKeys.selectedMode, selectedMode);
  }, [selectedMode]);

  useEffect(() => {
    if (room) {
      saveJson(storageKeys.game, game);
      return;
    }

    removeStoredKey(storageKeys.game);
  }, [game, room]);

  useEffect(() => {
    if (room) {
      saveJson(storageKeys.room, room);
      return;
    }

    removeStoredKey(storageKeys.room);
  }, [room]);

  useEffect(() => {
    const currentRoomStorageKey = getCurrentRoomPlayerStorageKey();
    if (currentRoomPlayerId) {
      saveSessionJson(currentRoomStorageKey, currentRoomPlayerId);
      removeSessionKey(storageKeys.currentRoomPlayerId);
      removeStoredKey(storageKeys.currentRoomPlayerId);
      return;
    }

    removeSessionKey(currentRoomStorageKey);
    removeSessionKey(storageKeys.currentRoomPlayerId);
    removeStoredKey(storageKeys.currentRoomPlayerId);
  }, [currentRoomPlayerId]);

  useEffect(() => {
    const syncFromStorage = (event) => {
      if (event.key === null || event.key === storageKeys.players) {
        setPlayers(loadPlayers());
      }
      if (event.key === null || event.key === storageKeys.room) {
        setRoom(loadRoom());
      }
      if (event.key === null || event.key === storageKeys.game) {
        setGame(loadGame());
      }
      if (event.key === null || event.key === storageKeys.selectedMode) {
        setSelectedMode(loadSelectedMode());
      }
    };

    window.addEventListener('storage', syncFromStorage);
    return () => window.removeEventListener('storage', syncFromStorage);
  }, []);

  useEffect(() => {
    if (room && game.card && currentRoomPlayerId && page !== pages.game) {
      setPage(pages.game);
    }
  }, [currentRoomPlayerId, game.card, page, room]);

  useEffect(() => {
    if (room && !game.card && currentRoomPlayerId && page === pages.game) {
      setPage(pages.room);
    }
  }, [currentRoomPlayerId, game.card, page, room]);

  useEffect(() => {
    if (!room && currentRoomPlayerId) {
      setCurrentRoomPlayerId(null);
      setGame(initialGame);
      if (page === pages.game || page === pages.room) {
        setPage(pages.home);
      }
    }
  }, [currentRoomPlayerId, page, room]);

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
  const currentRoomRole = room?.rolesByPlayerId?.[currentRoomPlayerId] ?? null;
  const isRoomHost = currentRoomRole === roomRoles.host;
  const canControlRoomGame =
    !room || currentRoomRole === roomRoles.host || currentRoomRole === roomRoles.narrator;

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
    setRoom((currentRoom) => {
      if (!currentRoom) return currentRoom;
      const nextRoles = { ...currentRoom.rolesByPlayerId };
      delete nextRoles[id];
      return {
        ...currentRoom,
        rolesByPlayerId: nextRoles,
      };
    });
    if (currentRoomPlayerId === id) {
      setCurrentRoomPlayerId(null);
    }
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

  const createRoom = (hostName) => {
    const safeName = sanitizeText(hostName, limits.playerNameLength) || 'Házigazda';
    const hostId = createId('player');
    const nextRoom = {
      code: createRoomCode(),
      hostPlayerId: hostId,
      rolesByPlayerId: {
        [hostId]: roomRoles.host,
      },
      createdAt: Date.now(),
    };

    setPlayers([{ id: hostId, name: safeName }]);
    setRoom(nextRoom);
    setCurrentRoomPlayerId(hostId);
    setGame(initialGame);
    return null;
  };

  const joinRoom = (code, name) => {
    const safeCode = String(code ?? '').replace(/\D/g, '').slice(0, 6);
    const safeName = sanitizeText(name, limits.playerNameLength);

    if (!room || safeCode !== room.code) {
      return 'Nincs ilyen helyi szoba.';
    }

    if (!safeName) {
      return 'Adj meg egy nevet.';
    }

    if (players.length >= limits.roomParticipants) {
      return 'A szoba megtelt.';
    }

    const alreadyExists = players.some(
      (player) => player.name.toLocaleLowerCase('hu-HU') === safeName.toLocaleLowerCase('hu-HU'),
    );

    if (alreadyExists) {
      return 'Ez a név már szerepel a szobában.';
    }

    const newPlayer = { id: createId('player'), name: safeName };
    const keepHostView = room.rolesByPlayerId?.[currentRoomPlayerId] === roomRoles.host;

    setPlayers((currentPlayers) => [...currentPlayers, newPlayer].slice(0, limits.roomParticipants));
    setRoom((currentRoom) => {
      if (!currentRoom) return currentRoom;
      return {
        ...currentRoom,
        rolesByPlayerId: {
          ...currentRoom.rolesByPlayerId,
          [newPlayer.id]: roomRoles.player,
        },
      };
    });

    if (!keepHostView) {
      setCurrentRoomPlayerId(newPlayer.id);
    }

    return null;
  };

  const setParticipantRole = (playerId, role) => {
    if (!isRoomHost || !Object.values(roomRoles).includes(role) || role === roomRoles.host) return;

    setRoom((currentRoom) => {
      if (!currentRoom || currentRoom.hostPlayerId === playerId) return currentRoom;
      const nextRoles = Object.fromEntries(
        Object.entries(currentRoom.rolesByPlayerId).map(([id, currentRole]) => [
          id,
          role === roomRoles.narrator && currentRole === roomRoles.narrator
            ? roomRoles.player
            : currentRole,
        ]),
      );

      return {
        ...currentRoom,
        rolesByPlayerId: {
          ...nextRoles,
          [playerId]: role,
          [currentRoom.hostPlayerId]: roomRoles.host,
        },
      };
    });
  };

  const removeParticipant = (playerId) => {
    if (!isRoomHost || room?.hostPlayerId === playerId) return;

    setPlayers((currentPlayers) => currentPlayers.filter((player) => player.id !== playerId));
    setRoom((currentRoom) => {
      if (!currentRoom) return currentRoom;
      const nextRoles = { ...currentRoom.rolesByPlayerId };
      delete nextRoles[playerId];
      return {
        ...currentRoom,
        rolesByPlayerId: nextRoles,
      };
    });

    if (currentRoomPlayerId === playerId) {
      setCurrentRoomPlayerId(null);
      setGame(initialGame);
      setPage(pages.home);
    }
  };

  const leaveRoom = () => {
    if (!room || !currentRoomPlayerId) {
      setGame(initialGame);
      setPage(pages.home);
      return;
    }

    if (currentRoomRole === roomRoles.host) {
      setGame(initialGame);
      setPage(pages.home);
      return;
    }

    const leavingId = currentRoomPlayerId;
    setPlayers((currentPlayers) => currentPlayers.filter((player) => player.id !== leavingId));
    setRoom((currentRoom) => {
      if (!currentRoom) return currentRoom;
      const nextRoles = { ...currentRoom.rolesByPlayerId };
      delete nextRoles[leavingId];
      return {
        ...currentRoom,
        rolesByPlayerId: nextRoles,
      };
    });
    setCurrentRoomPlayerId(null);
    setGame(initialGame);
    setPage(pages.home);
  };

  const finishRoomGame = () => {
    if (!isRoomHost) return;

    setRoom(null);
    setCurrentRoomPlayerId(null);
    setGame(initialGame);
    setPage(pages.home);
  };

  const startGame = () => {
    if (room && !isRoomHost) return;
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
    if (!canControlRoomGame) return;
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
    removeSessionKey(getCurrentRoomPlayerStorageKey());
    removeSessionKey(storageKeys.currentRoomPlayerId);
    setPlayers([]);
    setCustomCards([]);
    setSettings(defaultSettings);
    setSelectedMode('classic');
    setGame(initialGame);
    setRoom(null);
    setCurrentRoomPlayerId(null);
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
    if (room && players.length < 2) {
      setPage(pages.room);
      return;
    }

    setPage(players.length >= 2 ? pages.modes : pages.players);
  };

  const exitGameToHome = () => {
    if (room && currentRoomRole !== roomRoles.host) {
      leaveRoom();
      return;
    }

    setGame(initialGame);
    setPage(pages.home);
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
          onRoom={() => setPage(pages.room)}
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

      {page === pages.room ? (
        <RoomPage
          room={room}
          players={players}
          currentParticipantId={currentRoomPlayerId}
          maxParticipants={limits.roomParticipants}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onSetRole={setParticipantRole}
          onRemoveParticipant={removeParticipant}
          onLeaveRoom={leaveRoom}
          onStartGame={() => setPage(pages.modes)}
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
          onBack={() => setPage(room ? pages.room : pages.players)}
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
          canControlGame={canControlRoomGame}
          isHost={isRoomHost}
          onNext={() => advanceGame('next')}
          onSkip={() => advanceGame('skip')}
          onExit={exitGameToHome}
          onFinishGame={finishRoomGame}
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
