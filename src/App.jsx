import { useEffect, useMemo, useRef, useState } from 'react';
import { Peer } from 'peerjs';
import ConfirmDialog from './components/ConfirmDialog.jsx';
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

const onlineMessageTypes = {
  joinRoom: 'join-room',
  joinAccepted: 'join-accepted',
  joinRejected: 'join-rejected',
  state: 'state',
  control: 'control',
  leave: 'leave',
  removed: 'removed',
  roomEnded: 'room-ended',
};

const defaultOnlineStatus = {
  mode: 'offline',
  state: 'idle',
  message: 'Offline',
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
    peerId: createRoomPeerId(code),
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

function createRoomPeerId(code) {
  return `enmegsosem-${String(code ?? '').replace(/\D/g, '').slice(0, 6)}`;
}

function sanitizeRoomCode(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 6);
}

function sendPeerMessage(connection, message) {
  try {
    if (connection?.open) {
      connection.send(message);
      return true;
    }
  } catch {
    // Dead connections are removed lazily by close/error handlers.
  }

  return false;
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
  const [game, setGame] = useState(initialGame);
  const [room, setRoom] = useState(null);
  const [currentRoomPlayerId, setCurrentRoomPlayerId] = useState(null);
  const [onlineStatus, setOnlineStatus] = useState(defaultOnlineStatus);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const peerRef = useRef(null);
  const peerModeRef = useRef('offline');
  const hostConnectionsRef = useRef(new Map());
  const guestConnectionRef = useRef(null);
  const latestStateRef = useRef(null);
  const advanceGameRef = useRef(null);
  const localPlayersRef = useRef(loadPlayers());

  useEffect(() => {
    removeStoredKey(storageKeys.room);
    removeStoredKey(storageKeys.game);
    removeStoredKey(storageKeys.currentRoomPlayerId);
    removeSessionKey(getCurrentRoomPlayerStorageKey());
    removeSessionKey(storageKeys.currentRoomPlayerId);
  }, []);

  useEffect(() => {
    if (room) return;
    localPlayersRef.current = players;
    saveJson(storageKeys.players, players);
  }, [players, room]);

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
    removeStoredKey(storageKeys.game);
  }, [game]);

  useEffect(() => {
    removeStoredKey(storageKeys.room);
  }, [room]);

  useEffect(() => {
    const currentRoomStorageKey = getCurrentRoomPlayerStorageKey();
    removeSessionKey(currentRoomStorageKey);
    removeSessionKey(storageKeys.currentRoomPlayerId);
    removeStoredKey(storageKeys.currentRoomPlayerId);
  }, [currentRoomPlayerId]);

  useEffect(() => {
    latestStateRef.current = {
      room,
      players,
      selectedMode,
      game,
      currentRoomPlayerId,
    };
  }, [currentRoomPlayerId, game, players, room, selectedMode]);

  useEffect(() => {
    const syncFromStorage = (event) => {
      if (event.key === null || event.key === storageKeys.players) {
        setPlayers(loadPlayers());
      }
      if (
        event.key === null ||
        event.key === storageKeys.room ||
        event.key === storageKeys.game ||
        event.key === storageKeys.currentRoomPlayerId
      ) {
        removeStoredKey(storageKeys.room);
        removeStoredKey(storageKeys.game);
        removeStoredKey(storageKeys.currentRoomPlayerId);
        removeSessionKey(getCurrentRoomPlayerStorageKey());
        removeSessionKey(storageKeys.currentRoomPlayerId);
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
  const isRoomHost =
    currentRoomRole === roomRoles.host ||
    Boolean(room?.hostPlayerId && currentRoomPlayerId === room.hostPlayerId);
  const canControlRoomGame =
    !room || currentRoomRole === roomRoles.host || currentRoomRole === roomRoles.narrator;
  const isOnlineGuest = onlineStatus.mode === 'guest';

  const createSharedState = (overrides = {}) => ({
    room,
    players,
    selectedMode,
    game,
    ...overrides,
  });

  const broadcastSharedState = (overrides = {}) => {
    if (!isRoomHost) return;

    const message = {
      type: onlineMessageTypes.state,
      state: createSharedState(overrides),
    };

    hostConnectionsRef.current.forEach((connection, playerId) => {
      if (!sendPeerMessage(connection, message)) {
        hostConnectionsRef.current.delete(playerId);
      }
    });
  };

  const clearPeerConnections = () => {
    hostConnectionsRef.current.forEach((connection) => {
      try {
        connection.close();
      } catch {
        // Ignore connection cleanup failures.
      }
    });
    hostConnectionsRef.current.clear();

    try {
      guestConnectionRef.current?.close();
    } catch {
      // Ignore connection cleanup failures.
    }
    guestConnectionRef.current = null;

    try {
      peerRef.current?.destroy();
    } catch {
      // Ignore peer cleanup failures.
    }
    peerRef.current = null;
    peerModeRef.current = 'offline';
  };

  const applySharedState = (sharedState, nextCurrentPlayerId = currentRoomPlayerId) => {
    if (!sharedState?.room || !Array.isArray(sharedState.players)) return;

    setRoom(sharedState.room);
    setPlayers(sharedState.players.slice(0, limits.roomParticipants));
    setSelectedMode(getModeById(sharedState.selectedMode).id);
    setGame(sharedState.game ?? initialGame);
    if (nextCurrentPlayerId) {
      setCurrentRoomPlayerId(nextCurrentPlayerId);
    }
  };

  const removeParticipantById = (playerId) => {
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
  };

  const closeRoomLocally = () => {
    clearPeerConnections();
    setOnlineStatus(defaultOnlineStatus);
    setPlayers(localPlayersRef.current ?? loadPlayers());
    setRoom(null);
    setCurrentRoomPlayerId(null);
    setGame(initialGame);
    setPage(pages.home);
  };

  const handleGuestMessage = (message) => {
    if (!message || typeof message !== 'object') return;

    if (message.type === onlineMessageTypes.state) {
      applySharedState(message.state);
      if (message.state?.game?.card) {
        setPage(pages.game);
      }
      return;
    }

    if (message.type === onlineMessageTypes.removed) {
      closeRoomLocally();
      setOnlineStatus({
        mode: 'offline',
        state: 'removed',
        message: 'A házigazda eltávolított a szobából.',
      });
      return;
    }

    if (message.type === onlineMessageTypes.roomEnded) {
      closeRoomLocally();
      setOnlineStatus({
        mode: 'offline',
        state: 'ended',
        message: 'A házigazda befejezte a játékot.',
      });
    }
  };

  const attachGuestConnection = (connection) => {
    guestConnectionRef.current = connection;
    connection.on('data', handleGuestMessage);
    connection.on('close', () => {
      if (peerModeRef.current === 'guest') {
        setOnlineStatus({
          mode: 'guest',
          state: 'disconnected',
          message: 'Megszakadt a kapcsolat a házigazdával.',
        });
      }
    });
    connection.on('error', () => {
      setOnlineStatus({
        mode: 'guest',
        state: 'error',
        message: 'Nem sikerült tartani a kapcsolatot.',
      });
    });
  };

  const acceptOnlineParticipant = (connection, player) => {
    const current = latestStateRef.current;
    if (!current?.room) return;

    const nextPlayers = [...current.players, player].slice(0, limits.roomParticipants);
    const nextRoom = {
      ...current.room,
      rolesByPlayerId: {
        ...current.room.rolesByPlayerId,
        [player.id]: roomRoles.player,
      },
    };

    hostConnectionsRef.current.set(player.id, connection);
    connection.partyrushPlayerId = player.id;
    setPlayers(nextPlayers);
    setRoom(nextRoom);
    sendPeerMessage(connection, {
      type: onlineMessageTypes.joinAccepted,
      playerId: player.id,
      state: {
        room: nextRoom,
        players: nextPlayers,
        selectedMode: current.selectedMode,
        game: current.game,
      },
    });
    window.setTimeout(() => {
      broadcastSharedState({
        room: nextRoom,
        players: nextPlayers,
      });
    }, 0);
  };

  const handleHostConnection = (connection) => {
    connection.on('data', (message) => {
      if (!message || typeof message !== 'object') return;

      if (message.type === onlineMessageTypes.joinRoom) {
        const current = latestStateRef.current;
        const safeCode = sanitizeRoomCode(message.code);
        const safeName = sanitizeText(message.player?.name, limits.playerNameLength);
        const requestedPlayerId = sanitizeId(message.player?.id, 'player');

        if (!current?.room || safeCode !== current.room.code) {
          sendPeerMessage(connection, {
            type: onlineMessageTypes.joinRejected,
            message: 'Nincs ilyen aktív szoba.',
          });
          return;
        }

        if (!safeName) {
          sendPeerMessage(connection, {
            type: onlineMessageTypes.joinRejected,
            message: 'Adj meg egy nevet.',
          });
          return;
        }

        if (current.players.length >= limits.roomParticipants) {
          sendPeerMessage(connection, {
            type: onlineMessageTypes.joinRejected,
            message: 'A szoba megtelt.',
          });
          return;
        }

        const alreadyExists = current.players.some(
          (player) =>
            player.id === requestedPlayerId ||
            player.name.toLocaleLowerCase('hu-HU') === safeName.toLocaleLowerCase('hu-HU'),
        );

        if (alreadyExists) {
          sendPeerMessage(connection, {
            type: onlineMessageTypes.joinRejected,
            message: 'Ez a név már szerepel a szobában.',
          });
          return;
        }

        acceptOnlineParticipant(connection, {
          id: requestedPlayerId,
          name: safeName,
        });
        return;
      }

      if (message.type === onlineMessageTypes.control) {
        const participantId = connection.partyrushPlayerId;
        const role = latestStateRef.current?.room?.rolesByPlayerId?.[participantId];
        if (role === roomRoles.narrator && (message.action === 'next' || message.action === 'skip')) {
          advanceGameRef.current?.();
        }
        return;
      }

      if (message.type === onlineMessageTypes.leave) {
        const participantId = connection.partyrushPlayerId;
        if (participantId) {
          hostConnectionsRef.current.delete(participantId);
          removeParticipantById(participantId);
        }
      }
    });

    connection.on('close', () => {
      if (connection.partyrushPlayerId) {
        hostConnectionsRef.current.delete(connection.partyrushPlayerId);
      }
    });
  };

  useEffect(() => {
    if (!room || !isRoomHost) return undefined;

    const peerId = createRoomPeerId(room.code);
    if (peerRef.current && peerModeRef.current === 'host' && peerRef.current.id === peerId) {
      return undefined;
    }

    clearPeerConnections();
    peerModeRef.current = 'host';
    const peer = new Peer(peerId, { debug: 1 });
    peerRef.current = peer;
    setOnlineStatus({
      mode: 'host',
      state: 'connecting',
      message: 'Online szoba indítása...',
    });

    peer.on('open', () => {
      setOnlineStatus({
        mode: 'host',
        state: 'ready',
        message: 'Online szoba aktív',
      });
    });

    peer.on('connection', handleHostConnection);

    peer.on('error', (error) => {
      if (error?.type === 'unavailable-id') {
        setRoom((currentRoom) => {
          if (!currentRoom) return currentRoom;
          const nextCode = createRoomCode();
          return {
            ...currentRoom,
            code: nextCode,
            peerId: createRoomPeerId(nextCode),
          };
        });
        setOnlineStatus({
          mode: 'host',
          state: 'connecting',
          message: 'Új kód készül...',
        });
        return;
      }

      setOnlineStatus({
        mode: 'host',
        state: 'error',
        message: 'Nem sikerült online szobát nyitni.',
      });
    });

    return () => {
      if (peerRef.current === peer) {
        clearPeerConnections();
      }
    };
  }, [isRoomHost, room?.code]);

  useEffect(() => {
    if (isRoomHost) {
      broadcastSharedState();
    }
  }, [game, isRoomHost, players, room, selectedMode]);

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
    const code = createRoomCode();
    const nextRoom = {
      code,
      peerId: createRoomPeerId(code),
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

  const joinOnlineRoom = (code, name) =>
    new Promise((resolve) => {
      const safeCode = sanitizeRoomCode(code);
      const safeName = sanitizeText(name, limits.playerNameLength);

      if (safeCode.length !== 6) {
        resolve('Adj meg egy 6 jegyű kódot.');
        return;
      }

      if (!safeName) {
        resolve('Adj meg egy nevet.');
        return;
      }

      clearPeerConnections();
      setOnlineStatus({
        mode: 'guest',
        state: 'connecting',
        message: 'Csatlakozás a szobához...',
      });

      const playerId = createId('player');
      const peer = new Peer(undefined, { debug: 1 });
      let settled = false;
      let timeoutId = null;

      const finish = (error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        if (error) {
          clearPeerConnections();
          setOnlineStatus({
            mode: 'offline',
            state: 'error',
            message: error,
          });
        }
        resolve(error ?? null);
      };

      peerRef.current = peer;
      peerModeRef.current = 'guest';
      timeoutId = window.setTimeout(() => {
        finish('Nem sikerült csatlakozni ehhez a kódhoz.');
      }, 15000);

      peer.on('open', () => {
        const connection = peer.connect(createRoomPeerId(safeCode), {
          reliable: true,
          metadata: {
            playerId,
            name: safeName,
          },
        });

        attachGuestConnection(connection);

        connection.on('open', () => {
          sendPeerMessage(connection, {
            type: onlineMessageTypes.joinRoom,
            code: safeCode,
            player: {
              id: playerId,
              name: safeName,
            },
          });
        });

        connection.on('error', () => {
          finish('Nem sikerült kapcsolódni a házigazdához.');
        });

        connection.on('close', () => {
          finish('A házigazda nem érhető el ezzel a kóddal.');
        });

        connection.on('data', (message) => {
          if (message?.type === onlineMessageTypes.joinAccepted) {
            applySharedState(message.state, message.playerId ?? playerId);
            setOnlineStatus({
              mode: 'guest',
              state: 'ready',
              message: 'Csatlakozva',
            });
            setPage(message.state?.game?.card ? pages.game : pages.room);
            finish(null);
            return;
          }

          if (message?.type === onlineMessageTypes.joinRejected) {
            finish(message.message ?? 'A csatlakozás elutasítva.');
          }
        });
      });

      peer.on('error', (error) => {
        if (error?.type === 'peer-unavailable') {
          finish('Nincs aktív szoba ezzel a kóddal.');
          return;
        }

        finish('Nem sikerült online kapcsolatot nyitni.');
      });
    });

  const joinRoom = (code, name) => {
    const safeCode = sanitizeRoomCode(code);
    const safeName = sanitizeText(name, limits.playerNameLength);

    if (!room || safeCode !== room.code || !isRoomHost) {
      return joinOnlineRoom(safeCode, safeName);
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

    const onlineConnection = hostConnectionsRef.current.get(playerId);
    if (onlineConnection) {
      sendPeerMessage(onlineConnection, {
        type: onlineMessageTypes.removed,
      });
      try {
        onlineConnection.close();
      } catch {
        // Ignore stale connection cleanup.
      }
      hostConnectionsRef.current.delete(playerId);
    }

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

  const leaveRoomNow = () => {
    setPendingConfirmation(null);

    if (!room || !currentRoomPlayerId) {
      setGame(initialGame);
      setPage(pages.home);
      return;
    }

    if (isRoomHost) {
      finishRoomNow();
      return;
    }

    if (isOnlineGuest) {
      sendPeerMessage(guestConnectionRef.current, {
        type: onlineMessageTypes.leave,
      });
      clearPeerConnections();
      setOnlineStatus(defaultOnlineStatus);
    }

    setPlayers(localPlayersRef.current ?? loadPlayers());
    setRoom(null);
    setCurrentRoomPlayerId(null);
    setGame(initialGame);
    setPage(pages.home);
  };

  const requestLeaveRoom = () => {
    if (isRoomHost) {
      setPendingConfirmation('finish-room');
      return;
    }

    setPendingConfirmation('leave-room');
  };

  const finishRoomNow = () => {
    if (!isRoomHost) {
      setPendingConfirmation(null);
      return;
    }

    hostConnectionsRef.current.forEach((connection) => {
      sendPeerMessage(connection, {
        type: onlineMessageTypes.roomEnded,
      });
    });
    setPendingConfirmation(null);
    closeRoomLocally();
  };

  const finishRoomGame = () => {
    if (!isRoomHost) return;
    setPendingConfirmation('finish-room');
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
    if (isOnlineGuest) {
      sendPeerMessage(guestConnectionRef.current, {
        type: onlineMessageTypes.control,
        action: 'next',
      });
      playFeedback(settings);
      return;
    }

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

  advanceGameRef.current = advanceGame;

  const clearData = () => {
    Object.values(storageKeys).forEach((key) => removeStoredKey(key));
    removeSessionKey(getCurrentRoomPlayerStorageKey());
    removeSessionKey(storageKeys.currentRoomPlayerId);
    clearPeerConnections();
    setOnlineStatus(defaultOnlineStatus);
    setPlayers([]);
    localPlayersRef.current = [];
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

  const exitGameToHomeNow = () => {
    setPendingConfirmation(null);

    if (room && !isRoomHost) {
      leaveRoomNow();
      return;
    }

    setGame(initialGame);
    setPage(pages.home);
  };

  const requestExitGame = () => {
    setPendingConfirmation('exit-game');
  };

  const backFromRoom = () => {
    if (room) {
      requestLeaveRoom();
      return;
    }

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
          onLeaveRoom={requestLeaveRoom}
          onFinishRoom={finishRoomGame}
          onStartGame={() => setPage(pages.modes)}
          onlineStatus={onlineStatus}
          onBack={backFromRoom}
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
          onExit={requestExitGame}
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

      {pendingConfirmation === 'finish-room' ? (
        <ConfirmDialog
          title="Befejezed a szobát?"
          description="Ez lezárja a játékot, bezárja a szobát, és minden csatlakozott játékost visszaküld a kezdőlapra."
          confirmLabel="Befejezés"
          onCancel={() => setPendingConfirmation(null)}
          onConfirm={finishRoomNow}
        />
      ) : null}

      {pendingConfirmation === 'leave-room' ? (
        <ConfirmDialog
          title="Kilépsz a szobából?"
          description="Ezzel elhagyod a szobát, és visszakerülsz a kezdőlapra. A többiek játéka ettől még folytatódhat."
          confirmLabel="Kilépés"
          onCancel={() => setPendingConfirmation(null)}
          onConfirm={leaveRoomNow}
        />
      ) : null}

      {pendingConfirmation === 'exit-game' ? (
        <ConfirmDialog
          title="Kilépsz a játékból?"
          description={
            room && !isRoomHost
              ? 'Ezzel kilépsz a szobából, és visszakerülsz a kezdőlapra.'
              : 'Ezzel megszakítod a jelenlegi játék nézetet, és visszakerülsz a kezdőlapra.'
          }
          confirmLabel="Kilépés"
          onCancel={() => setPendingConfirmation(null)}
          onConfirm={exitGameToHomeNow}
        />
      ) : null}
    </Layout>
  );
}
