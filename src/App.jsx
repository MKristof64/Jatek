import { useEffect, useMemo, useRef, useState } from 'react';
import { Peer } from 'peerjs';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import {
  clearFullscreenViewport,
  enterAppFullscreen,
  getFullscreenElement,
  getFallbackFullscreen,
  lockGameFullscreen,
  refreshFullscreenViewport,
  unlockGameFullscreen,
} from './lib/fullscreen.js';
import Layout from './components/Layout.jsx';
import { cards } from './data/cards.js';
import { getModeById } from './data/modes.js';
import { fetchRemoteCards } from './lib/feedback.js';
import {
  buildTeams,
  createRoomCode,
  getCardSourceModes,
  getParticipantIndexes,
  pickRandomCard,
  pickTargetIndex,
  shufflePlayerIndexes,
} from './lib/gameEngine.js';
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
  includeDuelCards: true,
  includeRoundtableCards: true,
};

const limits = {
  players: 24,
  roomParticipants: 15,
  playerNameLength: 24,
  customCards: 120,
  customCardLength: 180,
};

const initialTimer = {
  cardId: null,
  durationSeconds: 0,
  remainingSeconds: 0,
  running: false,
  updatedAt: 0,
};

const initialGame = {
  playerOrder: [],
  orderPosition: 0,
  playerIndex: 0,
  targetIndex: 1,
  participantIndexes: [],
  card: null,
  usedIds: [],
  timer: initialTimer,
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

function isInstalledAppDisplayMode() {
  return Boolean(
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true,
  );
}

function shouldRequestNativeGameFullscreen() {
  return !isInstalledAppDisplayMode();
}

function shouldRequestNativePageFullscreen(page) {
  return isInstalledAppDisplayMode() || page === pages.game;
}

function syncAppChromeColor(darkMode = true) {
  const color = darkMode ? '#5f0029' : '#fff0f4';
  document
    .querySelectorAll('meta[name="theme-color"], meta[name="msapplication-TileColor"]')
    .forEach((meta) => meta.setAttribute('content', color));
  document.documentElement.dataset.appTheme = darkMode ? 'dark' : 'light';
  document.documentElement.style.backgroundColor = color;
  document.body.style.backgroundColor = color;
}

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

function sanitizePlayers(value, limit = limits.players) {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, limit)
    .map((player) => ({
      id: sanitizeId(player?.id, 'player'),
      name: sanitizeText(player?.name, limits.playerNameLength),
    }))
    .filter((player) => player.name.length > 0);
}

function loadPlayers() {
  return sanitizePlayers(loadJson(storageKeys.players, []));
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
    includeDuelCards:
      typeof savedSettings.includeDuelCards === 'boolean'
        ? savedSettings.includeDuelCards
        : defaultSettings.includeDuelCards,
    includeRoundtableCards:
      typeof savedSettings.includeRoundtableCards === 'boolean'
        ? savedSettings.includeRoundtableCards
        : defaultSettings.includeRoundtableCards,
  };
}

function sanitizeRoom(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const code = String(value.code ?? '').replace(/\D/g, '').slice(0, 6);
  const hostPlayerId = sanitizeId(value.hostPlayerId, 'player');
  const savedRoles =
    value.rolesByPlayerId && typeof value.rolesByPlayerId === 'object'
      ? value.rolesByPlayerId
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
    createdAt: Number.isFinite(value.createdAt) ? value.createdAt : Date.now(),
  };
}

function loadSelectedMode() {
  const savedMode = loadJson(storageKeys.selectedMode, 'classic');
  return getModeById(typeof savedMode === 'string' ? savedMode : 'classic').id;
}

function sanitizeCard(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const safeKind = ['never', 'duel', 'roundtable'].includes(value.kind) ? value.kind : 'never';
  const durationSeconds = Number.isFinite(value.durationSeconds)
    ? Math.max(0, Math.min(120, Math.floor(value.durationSeconds)))
    : 0;

  return {
    id: sanitizeId(value.id, 'card'),
    mode: getModeById(value.mode).id,
    kind: safeKind,
    title: sanitizeText(value.title, 80) || 'Én még sosem...',
    text: sanitizeText(value.text, 320),
    durationSeconds,
    safe: value.safe !== false,
  };
}

function getCardDurationSeconds(card) {
  return Number.isFinite(card?.durationSeconds)
    ? Math.max(0, Math.min(120, Math.floor(card.durationSeconds)))
    : 0;
}

function createTimerState(card, now = Date.now()) {
  const durationSeconds = getCardDurationSeconds(card);

  return {
    cardId: card?.id ?? null,
    durationSeconds,
    remainingSeconds: durationSeconds,
    running: false,
    updatedAt: now,
  };
}

function getTimerRemainingSeconds(timer, now = Date.now()) {
  if (!timer || typeof timer !== 'object' || Array.isArray(timer)) return 0;

  const durationSeconds = Number.isFinite(timer.durationSeconds)
    ? Math.max(0, Math.min(120, Math.floor(timer.durationSeconds)))
    : 0;
  const remainingSeconds = Number.isFinite(timer.remainingSeconds)
    ? Math.max(0, Math.min(durationSeconds, Math.ceil(timer.remainingSeconds)))
    : 0;

  if (!timer.running) return remainingSeconds;

  const updatedAt = Number.isFinite(timer.updatedAt) ? timer.updatedAt : now;
  const elapsedSeconds = Math.max(0, Math.floor((now - updatedAt) / 1000));
  return Math.max(0, remainingSeconds - elapsedSeconds);
}

function sanitizeTimer(value, card = null) {
  const fallback = createTimerState(card);

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  const cardId = typeof value.cardId === 'string' ? sanitizeId(value.cardId, 'card') : fallback.cardId;
  if (card?.id && cardId !== card.id) {
    return fallback;
  }

  const durationSeconds = Number.isFinite(value.durationSeconds)
    ? Math.max(0, Math.min(120, Math.floor(value.durationSeconds)))
    : fallback.durationSeconds;
  const remainingSeconds = Number.isFinite(value.remainingSeconds)
    ? Math.max(0, Math.min(durationSeconds, Math.ceil(value.remainingSeconds)))
    : fallback.remainingSeconds;

  return {
    cardId,
    durationSeconds,
    remainingSeconds,
    running: Boolean(value.running && durationSeconds > 0 && remainingSeconds > 0),
    updatedAt: Number.isFinite(value.updatedAt) ? Math.max(0, value.updatedAt) : fallback.updatedAt,
  };
}

function sanitizeGame(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return initialGame;
  }

  const playerOrder = Array.isArray(value.playerOrder)
    ? value.playerOrder.filter(Number.isInteger)
    : [];
  const participantIndexes = Array.isArray(value.participantIndexes)
    ? value.participantIndexes.filter(Number.isInteger)
    : [];
  const usedIds = Array.isArray(value.usedIds)
    ? value.usedIds.filter((id) => typeof id === 'string').slice(0, 2000)
    : [];
  const card = sanitizeCard(value.card);

  return {
    playerOrder,
    orderPosition: Number.isInteger(value.orderPosition) ? value.orderPosition : 0,
    playerIndex: Number.isInteger(value.playerIndex) ? value.playerIndex : 0,
    targetIndex: Number.isInteger(value.targetIndex) ? value.targetIndex : 1,
    participantIndexes,
    card,
    usedIds,
    timer: sanitizeTimer(value.timer, card),
  };
}

function getLiveGameState(value, now = Date.now()) {
  const safeGame = sanitizeGame(value);
  const timer = sanitizeTimer(safeGame.timer, safeGame.card);
  if (!timer.running) return safeGame;

  const remainingSeconds = getTimerRemainingSeconds(timer, now);
  return {
    ...safeGame,
    timer: {
      ...timer,
      remainingSeconds,
      running: remainingSeconds > 0,
      updatedAt: now,
    },
  };
}

function toggleTimerState(value, now = Date.now()) {
  const safeGame = sanitizeGame(value);
  const timer = sanitizeTimer(safeGame.timer, safeGame.card);
  if (!timer.cardId || timer.durationSeconds <= 0) return safeGame;

  const remainingSeconds = getTimerRemainingSeconds(timer, now);
  const shouldPause = timer.running && remainingSeconds > 0;
  const nextRemainingSeconds = shouldPause
    ? remainingSeconds
    : remainingSeconds > 0
      ? remainingSeconds
      : timer.durationSeconds;

  return {
    ...safeGame,
    timer: {
      ...timer,
      remainingSeconds: nextRemainingSeconds,
      running: !shouldPause,
      updatedAt: now,
    },
  };
}

function clearStoredRoomState() {
  removeStoredKey(storageKeys.room);
  removeStoredKey(storageKeys.game);
  removeStoredKey(storageKeys.currentRoomPlayerId);
  removeSessionKey(storageKeys.currentRoomPlayerId);

  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(`${storageKeys.currentRoomPlayerId}.`))
      .forEach(removeSessionKey);
  } catch {
    // Session storage may be blocked; the in-memory room still works.
  }
}

function removeRoomRole(room, playerId) {
  if (!room) return room;
  const nextRoles = { ...room.rolesByPlayerId };
  delete nextRoles[playerId];
  return {
    ...room,
    rolesByPlayerId: nextRoles,
  };
}

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

function mergeLocalAndRemoteCards(localCards, remoteCards, modeId) {
  const sourceModes = getCardSourceModes(modeId);
  const remoteModeCards = remoteCards.filter((card) => sourceModes.includes(card.mode));
  if (['bold', 'hardcore', 'university'].includes(modeId) && remoteModeCards.length > 0) {
    return remoteModeCards;
  }

  const cardsById = new Map(localCards.map((card) => [card.id, card]));
  remoteModeCards.forEach((card) => {
    cardsById.set(card.id, card);
  });

  return [...cardsById.values()].sort((firstCard, secondCard) => {
    const firstOrder = Number(firstCard.sortOrder) || 0;
    const secondOrder = Number(secondCard.sortOrder) || 0;
    return firstOrder - secondOrder;
  });
}

function playFeedback(settings) {
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
  const [remoteCards, setRemoteCards] = useState([]);
  const [installPrompt, setInstallPrompt] = useState(null);
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
  const toggleTimerRef = useRef(null);
  const localPlayersRef = useRef(loadPlayers());
  const gameHistoryGuardRef = useRef(false);
  const gameWasBackgroundedRef = useRef(false);

  useEffect(() => {
    const syncChrome = () => syncAppChromeColor(settings.darkMode);
    syncChrome();

    window.addEventListener('focus', syncChrome);
    window.addEventListener('pageshow', syncChrome);
    document.addEventListener('visibilitychange', syncChrome);

    return () => {
      window.removeEventListener('focus', syncChrome);
      window.removeEventListener('pageshow', syncChrome);
      document.removeEventListener('visibilitychange', syncChrome);
    };
  }, [settings.darkMode]);

  useEffect(() => {
    if (isInstalledAppDisplayMode()) return undefined;

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    clearStoredRoomState();
  }, []);

  useEffect(() => {
    let viewportFrame = 0;

    const syncAppViewport = () => {
      window.cancelAnimationFrame(viewportFrame);
      viewportFrame = window.requestAnimationFrame(refreshFullscreenViewport);
    };

    const syncAppViewportSoon = () => {
      syncAppViewport();
      window.setTimeout(refreshFullscreenViewport, 120);
      window.setTimeout(refreshFullscreenViewport, 420);
    };

    syncAppViewportSoon();
    window.addEventListener('focus', syncAppViewportSoon);
    window.addEventListener('pageshow', syncAppViewportSoon);
    window.addEventListener('resize', syncAppViewport);
    window.addEventListener('orientationchange', syncAppViewportSoon);
    window.visualViewport?.addEventListener('resize', syncAppViewport);
    window.visualViewport?.addEventListener('scroll', syncAppViewport);

    return () => {
      window.cancelAnimationFrame(viewportFrame);
      window.removeEventListener('focus', syncAppViewportSoon);
      window.removeEventListener('pageshow', syncAppViewportSoon);
      window.removeEventListener('resize', syncAppViewport);
      window.removeEventListener('orientationchange', syncAppViewportSoon);
      window.visualViewport?.removeEventListener('resize', syncAppViewport);
      window.visualViewport?.removeEventListener('scroll', syncAppViewport);
      clearFullscreenViewport();
    };
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
    let ignore = false;
    let loading = false;

    const loadRemoteCards = async () => {
      if (ignore || loading || document.visibilityState === 'hidden') return;

      loading = true;
      const result = await fetchRemoteCards();
      loading = false;

      if (!ignore && result.ok) {
        setRemoteCards(result.cards);
      }
    };

    void loadRemoteCards();
    const intervalId = window.setInterval(loadRemoteCards, 300000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadRemoteCards();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      ignore = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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
      if ((event.key === null || event.key === storageKeys.players) && !latestStateRef.current?.room) {
        setPlayers(loadPlayers());
      }
      if (
        event.key === null ||
        event.key === storageKeys.room ||
        event.key === storageKeys.game ||
        event.key === storageKeys.currentRoomPlayerId
      ) {
        clearStoredRoomState();
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

  useEffect(() => {
    const shouldLockPageFullscreen = shouldRequestNativePageFullscreen(page);

    if (!shouldLockPageFullscreen) {
      void unlockGameFullscreen();
      gameHistoryGuardRef.current = false;
      gameWasBackgroundedRef.current = false;
      return undefined;
    }

    let viewportFrame = 0;
    const persistGameFullscreen = page === pages.game;
    const requestNativeFullscreen =
      persistGameFullscreen && shouldRequestNativeGameFullscreen();

    const syncViewport = () => {
      window.cancelAnimationFrame(viewportFrame);
      viewportFrame = window.requestAnimationFrame(refreshFullscreenViewport);
    };

    const enterFullscreenForCurrentPage = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;

      syncAppChromeColor(settings.darkMode);
      refreshFullscreenViewport();

      if (persistGameFullscreen) {
        void lockGameFullscreen({ requestNative: requestNativeFullscreen });
      } else {
        void enterAppFullscreen({ persistGame: false, requestNative: false });
      }

      window.setTimeout(refreshFullscreenViewport, 120);
      window.setTimeout(refreshFullscreenViewport, 420);
    };

    const requestFullscreenAfterGesture = (event) => {
      if (event?.type === 'keydown' && event.key === 'Escape') return;
      if (document.visibilityState && document.visibilityState !== 'visible') return;

      refreshFullscreenViewport();
      if (requestNativeFullscreen && !getFullscreenElement()) {
        void lockGameFullscreen({ requestNative: true });
      }
    };

    enterFullscreenForCurrentPage();
    window.addEventListener('focus', enterFullscreenForCurrentPage);
    window.addEventListener('pageshow', enterFullscreenForCurrentPage);
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', enterFullscreenForCurrentPage);
    if (requestNativeFullscreen) {
      window.addEventListener('pointerdown', requestFullscreenAfterGesture, true);
      window.addEventListener('touchstart', requestFullscreenAfterGesture, true);
      window.addEventListener('click', requestFullscreenAfterGesture, true);
      window.addEventListener('keydown', requestFullscreenAfterGesture, true);
    }
    document.addEventListener('visibilitychange', enterFullscreenForCurrentPage);
    document.addEventListener('resume', enterFullscreenForCurrentPage);
    window.visualViewport?.addEventListener('resize', syncViewport);
    window.visualViewport?.addEventListener('scroll', syncViewport);

    return () => {
      window.cancelAnimationFrame(viewportFrame);
      window.removeEventListener('focus', enterFullscreenForCurrentPage);
      window.removeEventListener('pageshow', enterFullscreenForCurrentPage);
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', enterFullscreenForCurrentPage);
      if (requestNativeFullscreen) {
        window.removeEventListener('pointerdown', requestFullscreenAfterGesture, true);
        window.removeEventListener('touchstart', requestFullscreenAfterGesture, true);
        window.removeEventListener('click', requestFullscreenAfterGesture, true);
        window.removeEventListener('keydown', requestFullscreenAfterGesture, true);
      }
      document.removeEventListener('visibilitychange', enterFullscreenForCurrentPage);
      document.removeEventListener('resume', enterFullscreenForCurrentPage);
      window.visualViewport?.removeEventListener('resize', syncViewport);
      window.visualViewport?.removeEventListener('scroll', syncViewport);
    };
  }, [page, settings.darkMode]);

  const activeMode = useMemo(() => getModeById(selectedMode), [selectedMode]);

  const cardPool = useMemo(() => {
    if (selectedMode === 'custom') {
      return customCards.map((card) => ({
        ...card,
        mode: 'custom',
        kind: 'never',
        title: 'Én még sosem...',
        safe: true,
      }));
    }

    const sourceModes = getCardSourceModes(selectedMode);
    const filteredCards = cards.filter((card) => {
      const modeMatches = sourceModes.includes(card.mode);
      const kindMatches =
        card.kind === 'duel'
          ? settings.includeDuelCards
          : card.kind === 'roundtable'
            ? settings.includeRoundtableCards
            : true;
      return modeMatches && kindMatches;
    });

    const mergedCards = mergeLocalAndRemoteCards(filteredCards, remoteCards, selectedMode);

    return mergedCards.filter((card) =>
      card.kind === 'duel'
        ? settings.includeDuelCards
        : card.kind === 'roundtable'
          ? settings.includeRoundtableCards
          : true,
    );
  }, [
    customCards,
    remoteCards,
    selectedMode,
    settings.includeDuelCards,
    settings.includeRoundtableCards,
  ]);

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
  const timerState = useMemo(() => sanitizeTimer(game.timer, game.card), [game.card, game.timer]);
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

  const createSharedState = (overrides = {}) => {
    const nextState = {
      room,
      players,
      selectedMode,
      game,
      ...overrides,
    };

    return {
      ...nextState,
      game: getLiveGameState(nextState.game),
    };
  };

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
    const nextRoom = sanitizeRoom(sharedState?.room);
    const nextPlayers = sanitizePlayers(sharedState?.players, limits.roomParticipants);
    if (!nextRoom || nextPlayers.length === 0) return;

    setRoom(nextRoom);
    setPlayers(nextPlayers);
    setSelectedMode(getModeById(sharedState.selectedMode).id);
    setGame(sanitizeGame(sharedState.game));
    if (nextCurrentPlayerId) {
      setCurrentRoomPlayerId(nextCurrentPlayerId);
    }
  };

  const removeParticipantById = (playerId) => {
    setPlayers((currentPlayers) => currentPlayers.filter((player) => player.id !== playerId));
    setRoom((currentRoom) => removeRoomRole(currentRoom, playerId));
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
        game: getLiveGameState(current.game),
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
    const removeDisconnectedParticipant = () => {
      const participantId = connection.partyrushPlayerId;
      if (!participantId) return;

      hostConnectionsRef.current.delete(participantId);
      removeParticipantById(participantId);
      connection.partyrushPlayerId = null;
    };

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
        if (role === roomRoles.narrator) {
          if (message.action === 'next') {
            advanceGameRef.current?.();
          }

          if (message.action === 'timer-toggle') {
            toggleTimerRef.current?.();
          }
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

    connection.on('close', removeDisconnectedParticipant);
    connection.on('error', removeDisconnectedParticipant);
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
    let reconnectTimer = 0;
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

    peer.on('disconnected', () => {
      setOnlineStatus({
        mode: 'host',
        state: 'connecting',
        message: 'Kapcsolat helyreállítása...',
      });
      window.clearTimeout(reconnectTimer);
      reconnectTimer = window.setTimeout(() => {
        if (peerRef.current !== peer || peer.destroyed) return;
        try {
          peer.reconnect();
        } catch {
          setOnlineStatus({
            mode: 'host',
            state: 'error',
            message: 'A szoba kapcsolata megszakadt.',
          });
        }
      }, 1500);
    });

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
      window.clearTimeout(reconnectTimer);
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
    if (!safeName) return 'Adj meg egy nevet.';
    if (players.length >= limits.players) {
      return `Legfeljebb ${limits.players} játékost adhatsz hozzá.`;
    }

    const alreadyExists = players.some(
      (player) => player.name.toLocaleLowerCase('hu-HU') === safeName.toLocaleLowerCase('hu-HU'),
    );
    if (alreadyExists) return 'Ez a név már szerepel a játékosok között.';

    setPlayers((currentPlayers) => [
      ...currentPlayers,
      { id: createId('player'), name: safeName },
    ]);
    return null;
  };

  const removePlayer = (id) => {
    setPlayers((currentPlayers) =>
      currentPlayers.filter((player) => player.id !== id),
    );
    setRoom((currentRoom) => removeRoomRole(currentRoom, id));
    if (currentRoomPlayerId === id) {
      setCurrentRoomPlayerId(null);
    }
  };

  const addCustomCard = (text) => {
    const safeText = sanitizeText(text, limits.customCardLength);
    if (!safeText) return 'Írj szöveget a kártyára.';
    if (customCards.length >= limits.customCards) {
      return `Legfeljebb ${limits.customCards} saját kártyát tárolhatsz.`;
    }

    setCustomCards((currentCards) => [
      { id: createId('custom'), text: safeText, safe: true },
      ...currentCards,
    ]);
    return null;
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
    setRoom((currentRoom) => removeRoomRole(currentRoom, playerId));

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
    void lockGameFullscreen({ requestNative: shouldRequestNativeGameFullscreen() });
    const picked = pickRandomCard(cardPool, []);
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
      timer: createTimerState(picked.card),
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
      timer: createTimerState(picked.card),
    });
    playFeedback(settings);
  };

  advanceGameRef.current = advanceGame;

  const toggleTimer = () => {
    if (!canControlRoomGame) return;

    if (isOnlineGuest) {
      sendPeerMessage(guestConnectionRef.current, {
        type: onlineMessageTypes.control,
        action: 'timer-toggle',
      });
      playFeedback(settings);
      return;
    }

    setGame((currentGame) => toggleTimerState(currentGame));
    playFeedback(settings);
  };

  toggleTimerRef.current = toggleTimer;

  const clearData = () => {
    setPendingConfirmation(null);
    Object.values(storageKeys).forEach((key) => removeStoredKey(key));
    clearStoredRoomState();
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

    if (key === 'sound' && value) {
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

  const installApp = async () => {
    if (!installPrompt) return;

    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch {
      // Browsers can reject the prompt if it is no longer available.
    } finally {
      setInstallPrompt(null);
    }
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

  const restoreGameFullscreenNow = () => {
    refreshFullscreenViewport();
    void lockGameFullscreen({ requestNative: shouldRequestNativeGameFullscreen() });
    window.setTimeout(refreshFullscreenViewport, 80);
    window.setTimeout(() => {
      refreshFullscreenViewport();
      void lockGameFullscreen({ requestNative: shouldRequestNativeGameFullscreen() });
    }, 220);
  };

  const cancelPendingConfirmation = () => {
    const shouldRestoreFullscreen = page === pages.game;
    setPendingConfirmation(null);

    if (shouldRestoreFullscreen) {
      restoreGameFullscreenNow();
    }
  };

  const requestGameBackExit = () => {
    if (page !== pages.game || pendingConfirmation) return false;

    setPendingConfirmation(room && isRoomHost ? 'finish-room' : 'exit-game');
    return true;
  };

  useEffect(() => {
    if (page !== pages.game) return undefined;

    gameWasBackgroundedRef.current = false;

    if (!gameHistoryGuardRef.current) {
      window.history.pushState({ enMegSosemGameGuard: true }, '', window.location.href);
      gameHistoryGuardRef.current = true;
    }

    const keepGameHistoryGuard = () => {
      window.history.pushState({ enMegSosemGameGuard: true }, '', window.location.href);
    };

    const requestGameExitAndKeepGuard = () => {
      const didOpenConfirmation = requestGameBackExit();
      keepGameHistoryGuard();
      return didOpenConfirmation;
    };

    const handlePopState = () => {
      requestGameExitAndKeepGuard();
    };

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (requestGameBackExit()) {
        event.preventDefault();
      }
    };

    const handleFullscreenChange = () => {
      const hasNativeFullscreen = Boolean(getFullscreenElement());

      if (hasNativeFullscreen) return;

      refreshFullscreenViewport();

      if (!getFallbackFullscreen()) {
        requestGameExitAndKeepGuard();
      }
    };

    const markGameBackgrounded = () => {
      gameWasBackgroundedRef.current = true;
    };

    const handleVisibilityForFullscreenExit = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') {
        markGameBackgrounded();
        return;
      }

      if (gameWasBackgroundedRef.current) {
        gameWasBackgroundedRef.current = false;
        requestGameExitAndKeepGuard();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', markGameBackgrounded);
    window.addEventListener('focus', handleVisibilityForFullscreenExit);
    window.addEventListener('pageshow', handleVisibilityForFullscreenExit);
    document.addEventListener('visibilitychange', handleVisibilityForFullscreenExit);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', markGameBackgrounded);
      window.removeEventListener('focus', handleVisibilityForFullscreenExit);
      window.removeEventListener('pageshow', handleVisibilityForFullscreenExit);
      document.removeEventListener('visibilitychange', handleVisibilityForFullscreenExit);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [isRoomHost, page, pendingConfirmation, room]);

  const backFromRoom = () => {
    if (room) {
      requestLeaveRoom();
      return;
    }

    setPage(pages.home);
  };

  const immersivePages = new Set(Object.values(pages));

  return (
    <Layout
      darkMode={settings.darkMode}
      gameMode={page === pages.game}
      immersiveMode={immersivePages.has(page)}
    >
      {page === pages.home ? (
        <HomePage
          playersCount={players.length}
          customCount={customCards.length}
          onStart={goToStartFlow}
          onPlayers={() => setPage(pages.players)}
          onCustomCards={() => setPage(pages.custom)}
          onRoom={() => setPage(pages.room)}
          onSettings={() => setPage(pages.settings)}
          canInstall={Boolean(installPrompt)}
          onInstall={installApp}
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
          timerState={timerState}
          canControlGame={canControlRoomGame}
          canControlTimer={canControlRoomGame}
          isHost={isRoomHost}
          canFinishGame={isRoomHost}
          onNext={advanceGame}
          onToggleTimer={toggleTimer}
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
          onClearData={() => setPendingConfirmation('clear-data')}
          onBack={() => setPage(pages.home)}
        />
      ) : null}

      {pendingConfirmation === 'finish-room' ? (
        <ConfirmDialog
          title="Befejezed a szobát?"
          description="Ez lezárja a játékot, bezárja a szobát, és minden csatlakozott játékost visszaküld a kezdőlapra."
          confirmLabel="Befejezés"
          onCancel={cancelPendingConfirmation}
          onConfirm={finishRoomNow}
        />
      ) : null}

      {pendingConfirmation === 'leave-room' ? (
        <ConfirmDialog
          title="Kilépsz a szobából?"
          description="Ezzel elhagyod a szobát, és visszakerülsz a kezdőlapra. A többiek játéka ettől még folytatódhat."
          confirmLabel="Kilépés"
          onCancel={cancelPendingConfirmation}
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
          onCancel={cancelPendingConfirmation}
          onConfirm={exitGameToHomeNow}
        />
      ) : null}

      {pendingConfirmation === 'clear-data' ? (
        <ConfirmDialog
          title="Törlöd az összes adatot?"
          description="Ez végleg törli a játékosokat és a saját kártyákat, majd visszaállítja az alapbeállításokat."
          confirmLabel="Adatok törlése"
          onCancel={cancelPendingConfirmation}
          onConfirm={clearData}
        />
      ) : null}
    </Layout>
  );
}
