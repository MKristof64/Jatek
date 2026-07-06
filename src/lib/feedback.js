const defaultFeedbackApiUrl = 'https://jatek.kristof-madarasz159.workers.dev';

const feedbackConfig = {
  apiUrl: String(import.meta.env.VITE_FEEDBACK_API_URL ?? defaultFeedbackApiUrl).replace(/\/+$/, ''),
};

const feedbackCardModes = new Set(['bold', 'hardcore', 'university']);
const feedbackPlayModes = new Set(['bold', 'hardcore', 'university']);

function isValidFeedbackUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  } catch {
    return false;
  }
}

export function isFeedbackConfigured() {
  return isValidFeedbackUrl(feedbackConfig.apiUrl);
}

function safeText(value, maxLength) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

function normalizeRemoteCard(row) {
  const kind = ['never', 'duel', 'roundtable'].includes(row?.kind) ? row.kind : 'never';
  const durationSeconds = Number(row?.durationSeconds ?? row?.duration_seconds);

  return {
    id: safeText(row?.id, 120),
    mode: safeText(row?.mode, 40),
    kind,
    title: safeText(row?.title, 80) || 'Én még sosem...',
    text: safeText(row?.text, 420),
    durationSeconds: Number.isFinite(durationSeconds)
      ? Math.max(0, Math.min(300, Math.floor(durationSeconds)))
      : kind === 'never'
        ? 0
        : 30,
    category: safeText(row?.category, 80),
    sortOrder: Number(row?.sortOrder ?? row?.sort_order) || 0,
    safe: row?.safe !== false,
    source: safeText(row?.source, 40) || 'remote',
  };
}

export async function submitCardFeedback({
  appContext,
  appVersion = import.meta.env.VITE_APP_VERSION ?? 'local',
  card,
  mode,
  voteType,
}) {
  const normalizedVote = voteType === 'like' || voteType === 'dislike' ? voteType : null;
  const cardMode = feedbackCardModes.has(card?.mode) ? card.mode : mode?.id;
  if (!normalizedVote || !card?.id || !feedbackPlayModes.has(mode?.id) || !feedbackCardModes.has(cardMode)) {
    return { ok: false, reason: 'invalid-feedback' };
  }

  if (!isFeedbackConfigured()) {
    return { ok: false, reason: 'not-configured' };
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${feedbackConfig.apiUrl}/api/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appContext: safeText(appContext ?? 'local', 40),
        appVersion: safeText(appVersion, 40),
        cardId: safeText(card.id, 120),
        kind: safeText(card.kind ?? 'never', 40),
        mode: cardMode,
        voteType: normalizedVote,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, reason: 'cloudflare-error', status: response.status };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error?.name === 'AbortError' ? 'timeout' : 'network-error',
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function fetchRemoteCards() {
  if (!isFeedbackConfigured()) {
    return { ok: false, reason: 'not-configured', cards: [] };
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${feedbackConfig.apiUrl}/api/cards?mode=all&_=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, reason: 'cloudflare-error', status: response.status, cards: [] };
    }

    const data = await response.json();
    const sourceCards = Array.isArray(data?.cards) ? data.cards : [];
    const cards = sourceCards
      .map(normalizeRemoteCard)
      .filter((card) => card.id && card.mode && card.text);

    return { ok: true, cards, updatedAt: data?.updatedAt ?? data?.updated_at ?? null };
  } catch (error) {
    return {
      ok: false,
      reason: error?.name === 'AbortError' ? 'timeout' : 'network-error',
      cards: [],
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}
