import { boldCards } from './bold-cards.js';
import { hardcoreCards } from './hardcore-cards.js';

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
};

const kindLabels = {
  never: 'Én még sosem',
  duel: 'Párharc',
  roundtable: 'Körbemenős',
};

const modeLabels = {
  classic: { id: 'classic', name: 'Klasszikus', category: 'Vicces', ready: true },
  bold: { id: 'bold', name: 'Merész', category: 'Pikáns', ready: true },
  hardcore: { id: 'hardcore', name: 'Hardcore', category: 'Nagyobb kihívás', ready: true },
  university: { id: 'university', name: 'Egyetemista', category: 'Pikáns + Hardcore', ready: true },
};

const combinedModeSources = {
  university: ['bold', 'hardcore', 'university'],
};

const validKinds = new Set(Object.keys(kindLabels));
const validModes = new Set(Object.keys(modeLabels));
const defaultSuccessPercent = 50;
const securityHeaders = {
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};
const allowedOriginPatterns = [
  /^https:\/\/mkristof64\.github\.io$/i,
  /^https:\/\/(?:[a-z0-9-]+\.)?jatek-teszt\.pages\.dev$/i,
  /^https:\/\/jatek(?:-[a-z0-9-]+)?\.kristof-madarasz159\.workers\.dev$/i,
  /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i,
];

function getModeSourceIds(mode) {
  return combinedModeSources[mode] ?? [mode];
}

function countCardsForMode(cards, mode) {
  const sourceIds = getModeSourceIds(mode);
  return cards.filter((card) => sourceIds.includes(card.mode)).length;
}

function isAllowedOrigin(origin) {
  return !origin || allowedOriginPatterns.some((pattern) => pattern.test(origin));
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };

  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

function jsonResponse(request, data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...jsonHeaders,
      'Cache-Control': 'no-store',
      ...securityHeaders,
      ...corsHeaders(request),
      ...(init.headers ?? {}),
    },
  });
}

function sanitizeText(value, maxLength) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

function createId() {
  return crypto.randomUUID();
}

function createCardId(mode, kind) {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 14);
  return `admin-${mode}-${kind}-${suffix}`;
}

function normalizeMode(value, fallback = 'bold') {
  const mode = sanitizeText(value, 40);
  return validModes.has(mode) ? mode : fallback;
}

function normalizeKind(value, fallback = 'never') {
  const kind = sanitizeText(value, 40);
  return validKinds.has(kind) ? kind : fallback;
}

function normalizeDuration(value, kind) {
  const fallback = kind === 'never' ? 0 : 30;
  const duration = Number(value ?? fallback);
  if (!Number.isFinite(duration)) return fallback;
  return Math.max(0, Math.min(300, Math.floor(duration)));
}

function normalizeSortOrder(value, fallback = 0) {
  const sortOrder = Number(value ?? fallback);
  return Number.isFinite(sortOrder) ? Math.max(0, Math.floor(sortOrder)) : fallback;
}

function publicCard(card) {
  return {
    id: card.id,
    mode: normalizeMode(card.mode),
    kind: normalizeKind(card.kind),
    title: sanitizeText(card.title, 80) || kindLabels[normalizeKind(card.kind)],
    text: sanitizeText(card.text, 420),
    durationSeconds: normalizeDuration(card.durationSeconds, normalizeKind(card.kind)),
    category: sanitizeText(card.category, 80) || modeLabels[normalizeMode(card.mode)]?.category || '',
    sortOrder: normalizeSortOrder(card.sortOrder),
    safe: card.safe !== false,
    source: sanitizeText(card.source, 40) || 'base',
  };
}

function rowToCard(row) {
  const kind = normalizeKind(row.kind);
  const mode = normalizeMode(row.mode);

  return publicCard({
    id: sanitizeText(row.id, 120),
    mode,
    kind,
    title: row.title,
    text: row.text,
    durationSeconds: Number(row.duration_seconds),
    category: row.category || modeLabels[mode]?.category || '',
    sortOrder: Number(row.sort_order),
    safe: true,
    source: row.source || 'custom',
    deletedAt: row.deleted_at || null,
  });
}

function baseCards() {
  return [...boldCards, ...hardcoreCards].map((card) =>
    publicCard({
      ...card,
      safe: true,
      source: 'base',
    }),
  );
}

async function getManagedRows(env) {
  try {
    const result = await env.DB.prepare(
      `SELECT id, mode, kind, title, text, duration_seconds, category, sort_order, source, deleted_at
       FROM managed_cards`,
    ).all();
    return result.results ?? [];
  } catch (error) {
    if (String(error?.message ?? '').includes('managed_cards')) {
      return [];
    }
    throw error;
  }
}

async function getManagedCards(env, options = {}) {
  const includeDeleted = Boolean(options.includeDeleted);
  const cardsById = new Map(baseCards().map((card) => [card.id, card]));
  const rows = await getManagedRows(env);

  rows.forEach((row) => {
    const card = rowToCard(row);
    const isDeleted = Boolean(row.deleted_at);

    if (isDeleted && !includeDeleted) {
      cardsById.delete(card.id);
      return;
    }

    cardsById.set(card.id, {
      ...card,
      deletedAt: row.deleted_at || null,
    });
  });

  return [...cardsById.values()]
    .filter((card) => includeDeleted || !card.deletedAt)
    .sort((firstCard, secondCard) => {
      if (firstCard.mode !== secondCard.mode) return firstCard.mode.localeCompare(secondCard.mode);
      return normalizeSortOrder(firstCard.sortOrder) - normalizeSortOrder(secondCard.sortOrder);
    });
}

async function findCard(cardId, env) {
  const safeId = sanitizeText(cardId, 120);
  const cards = await getManagedCards(env);
  return cards.find((card) => card.id === safeId) ?? null;
}

function validateCardPayload(payload, fallback = {}) {
  const mode = normalizeMode(payload?.mode ?? fallback.mode ?? 'bold');
  const kind = normalizeKind(payload?.kind ?? fallback.kind ?? 'never');
  const title = sanitizeText(payload?.title ?? fallback.title ?? kindLabels[kind], 80);
  const text = sanitizeText(payload?.text ?? fallback.text, 420);
  const category = sanitizeText(payload?.category ?? fallback.category ?? modeLabels[mode]?.category, 80);
  const sortOrder = normalizeSortOrder(payload?.sortOrder ?? payload?.sort_order, fallback.sortOrder ?? 0);

  if (!title || !text) {
    return { error: 'missing-required-fields' };
  }

  return {
    card: publicCard({
      id: sanitizeText(fallback.id, 120),
      mode,
      kind,
      title,
      text,
      durationSeconds: normalizeDuration(
        payload?.durationSeconds ?? payload?.duration_seconds ?? fallback.durationSeconds,
        kind,
      ),
      category,
      sortOrder,
      safe: true,
      source: fallback.source || 'custom',
    }),
  };
}

async function saveManagedCard(env, card, source = 'custom', deletedAt = null) {
  await env.DB.prepare(
    `INSERT INTO managed_cards
      (id, mode, kind, title, text, duration_seconds, category, sort_order, source, deleted_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
      mode = excluded.mode,
      kind = excluded.kind,
      title = excluded.title,
      text = excluded.text,
      duration_seconds = excluded.duration_seconds,
      category = excluded.category,
      sort_order = excluded.sort_order,
      source = excluded.source,
      deleted_at = excluded.deleted_at,
      updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(
      card.id,
      card.mode,
      card.kind,
      card.title,
      card.text,
      card.durationSeconds,
      card.category,
      card.sortOrder,
      source,
      deletedAt,
    )
    .run();
}

function isAdminRequest(request, env) {
  const token = String(env.ADMIN_TOKEN ?? '');
  if (!token) return false;

  const providedToken = request.headers.get('X-Admin-Token') ?? '';
  return providedToken === token;
}

function withAdminGuard(request, env) {
  if (isAdminRequest(request, env)) return null;

  if (request.headers.get('Accept')?.includes('text/html')) {
    return new Response(adminHtml(), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        ...securityHeaders,
      },
    });
  }

  return jsonResponse(request, { error: 'unauthorized' }, { status: 401 });
}

async function handleVote(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(request, { error: 'invalid-json' }, { status: 400 });
  }

  const cardId = sanitizeText(payload.cardId ?? payload.card_id, 120);
  const voteType = payload.voteType ?? payload.vote_type;
  const card = await findCard(cardId, env);

  if (!card) {
    return jsonResponse(request, { error: 'unknown-card' }, { status: 400 });
  }

  if (voteType !== 'like' && voteType !== 'dislike') {
    return jsonResponse(request, { error: 'invalid-vote' }, { status: 400 });
  }

  await env.DB.prepare(
    `INSERT INTO feedback_votes
      (id, card_id, mode, kind, vote_type, app_context, app_version, page_origin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      createId(),
      card.id,
      card.mode,
      card.kind,
      voteType,
      sanitizeText(payload.appContext ?? payload.app_context ?? 'local', 40) || 'local',
      sanitizeText(payload.appVersion ?? payload.app_version ?? '', 40),
      sanitizeText(request.headers.get('Origin') ?? payload.pageOrigin ?? payload.page_origin ?? '', 160),
    )
    .run();

  return jsonResponse(request, { ok: true });
}

async function getVoteStats(env, mode = 'bold') {
  const sourceIds = getModeSourceIds(normalizeMode(mode));
  const placeholders = sourceIds.map(() => '?').join(', ');
  const result = await env.DB.prepare(
    `SELECT
      card_id,
      SUM(CASE WHEN vote_type = 'like' THEN 1 ELSE 0 END) AS likes,
      SUM(CASE WHEN vote_type = 'dislike' THEN 1 ELSE 0 END) AS dislikes,
      COUNT(*) AS total_votes
     FROM feedback_votes
     WHERE mode IN (${placeholders})
     GROUP BY card_id`,
  ).bind(...sourceIds).all();

  return Object.fromEntries(
    (result.results ?? []).map((row) => {
      const likes = Number(row.likes) || 0;
      const dislikes = Number(row.dislikes) || 0;
      const totalVotes = Number(row.total_votes) || 0;
      const successPercent =
        totalVotes > 0 ? Math.round((likes / totalVotes) * 10000) / 100 : defaultSuccessPercent;

      return [
        row.card_id,
        {
          likes,
          dislikes,
          totalVotes,
          successPercent,
        },
      ];
    }),
  );
}

function compareCardsBySuccess(firstCard, secondCard) {
  const firstScore = Number.isFinite(firstCard.successPercent)
    ? firstCard.successPercent
    : defaultSuccessPercent;
  const secondScore = Number.isFinite(secondCard.successPercent)
    ? secondCard.successPercent
    : defaultSuccessPercent;
  if (secondScore !== firstScore) return secondScore - firstScore;
  if (secondCard.totalVotes !== firstCard.totalVotes) {
    return secondCard.totalVotes - firstCard.totalVotes;
  }
  if (secondCard.likes !== firstCard.likes) return secondCard.likes - firstCard.likes;
  if (firstCard.dislikes !== secondCard.dislikes) return firstCard.dislikes - secondCard.dislikes;
  return firstCard.sortOrder - secondCard.sortOrder;
}

async function buildStats(env, mode = 'bold') {
  const statsByCard = await getVoteStats(env, mode);
  const sourceIds = getModeSourceIds(normalizeMode(mode));
  const managedCards = (await getManagedCards(env)).filter((card) => sourceIds.includes(card.mode));

  return managedCards
    .map((card) => {
      const stats = statsByCard[card.id] ?? {
        likes: 0,
        dislikes: 0,
        totalVotes: 0,
        successPercent: defaultSuccessPercent,
      };

      return {
        ...card,
        kindLabel: kindLabels[card.kind] ?? card.kind,
        likes: stats.likes,
        dislikes: stats.dislikes,
        totalVotes: stats.totalVotes,
        successPercent: stats.successPercent,
      };
    })
    .sort(compareCardsBySuccess);
}

async function handleStats(request, env) {
  const url = new URL(request.url);
  const mode = normalizeMode(url.searchParams.get('mode') ?? 'bold');
  const kind = url.searchParams.get('kind') ?? 'all';

  const cards = await buildStats(env, mode);
  const filteredCards = kind === 'all' ? cards : cards.filter((card) => card.kind === kind);
  const allCards = await getManagedCards(env);
  const totals = cards.reduce(
    (accumulator, card) => {
      accumulator.likes += card.likes;
      accumulator.dislikes += card.dislikes;
      accumulator.totalVotes += card.totalVotes;
      return accumulator;
    },
    { likes: 0, dislikes: 0, totalVotes: 0 },
  );
  const successPercent =
    totals.totalVotes > 0
      ? Math.round((totals.likes / totals.totalVotes) * 10000) / 100
      : defaultSuccessPercent;

  return jsonResponse(request, {
    mode,
    category: modeLabels[mode]?.category ?? 'Pikáns',
    cards: filteredCards,
    categories: Object.values(modeLabels).map((modeItem) => ({
      id: modeItem.id,
      name: modeItem.category,
      modeName: modeItem.name,
      totalCards: countCardsForMode(allCards, modeItem.id),
      ready: modeItem.ready,
    })),
    kinds: Object.entries(kindLabels).map(([id, label]) => ({
      id,
      label,
      totalCards: cards.filter((card) => card.kind === id).length,
    })),
    totals: {
      ...totals,
      successPercent,
    },
    updatedAt: new Date().toISOString(),
  });
}

async function handlePublicStats(request, env) {
  const url = new URL(request.url);
  const mode = normalizeMode(url.searchParams.get('mode') ?? 'bold');

  const cards = await buildStats(env, mode);
  const stats = Object.fromEntries(
    cards.map((card) => [
      card.id,
      {
        cardId: card.id,
        likes: card.likes,
        dislikes: card.dislikes,
        totalVotes: card.totalVotes,
        successPercent: card.successPercent,
      },
    ]),
  );

  return jsonResponse(request, {
    mode,
    stats,
    updatedAt: new Date().toISOString(),
  });
}

async function handleCards(request, env) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') ?? 'all';
  const cards = await getManagedCards(env);
  const sourceIds = mode === 'all' ? [] : getModeSourceIds(normalizeMode(mode));
  const filteredCards =
    mode === 'all' ? cards : cards.filter((card) => sourceIds.includes(card.mode));

  return jsonResponse(request, {
    cards: filteredCards,
    categories: Object.values(modeLabels).map((modeItem) => ({
      ...modeItem,
      totalCards: countCardsForMode(cards, modeItem.id),
    })),
    kinds: Object.entries(kindLabels).map(([id, label]) => ({ id, label })),
    updatedAt: new Date().toISOString(),
  });
}

async function handleCreateCard(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(request, { error: 'invalid-json' }, { status: 400 });
  }

  const mode = normalizeMode(payload?.mode ?? 'bold');
  const kind = normalizeKind(payload?.kind ?? 'never');
  const validation = validateCardPayload(payload, {
    id: createCardId(mode, kind),
    mode,
    kind,
    category: modeLabels[mode]?.category,
    sortOrder: Date.now(),
    source: 'custom',
  });

  if (validation.error) {
    return jsonResponse(request, { error: validation.error }, { status: 400 });
  }

  await saveManagedCard(env, validation.card, 'custom', null);
  return jsonResponse(request, { ok: true, card: validation.card }, { status: 201 });
}

async function handleUpdateCard(request, env, cardId) {
  const existing = await findCard(cardId, env);
  if (!existing) {
    return jsonResponse(request, { error: 'unknown-card' }, { status: 404 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(request, { error: 'invalid-json' }, { status: 400 });
  }

  const validation = validateCardPayload(payload, existing);
  if (validation.error) {
    return jsonResponse(request, { error: validation.error }, { status: 400 });
  }

  const card = {
    ...validation.card,
    id: existing.id,
    source: existing.source === 'base' ? 'override' : existing.source,
  };

  await saveManagedCard(env, card, card.source, null);
  return jsonResponse(request, { ok: true, card });
}

async function handleDeleteCard(request, env, cardId) {
  const existing = await findCard(cardId, env);
  if (!existing) {
    return jsonResponse(request, { error: 'unknown-card' }, { status: 404 });
  }

  const source = existing.source === 'base' ? 'override' : existing.source;
  await saveManagedCard(env, existing, source, new Date().toISOString());
  return jsonResponse(request, { ok: true, deletedId: existing.id });
}

async function refreshDailySnapshot(env) {
  const snapshotDate = new Date().toISOString().slice(0, 10);
  const snapshotModes = ['bold', 'hardcore', 'university'];
  const cardsById = new Map();

  for (const mode of snapshotModes) {
    const stats = await buildStats(env, mode);
    stats.forEach((card) => cardsById.set(card.id, card));
  }

  const statements = [...cardsById.values()].map((card) =>
    env.DB.prepare(
      `INSERT INTO daily_feedback_snapshots
        (snapshot_date, card_id, mode, kind, likes, dislikes, total_votes, success_percent, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(snapshot_date, card_id) DO UPDATE SET
        mode = excluded.mode,
        likes = excluded.likes,
        dislikes = excluded.dislikes,
        total_votes = excluded.total_votes,
        success_percent = excluded.success_percent,
        updated_at = CURRENT_TIMESTAMP`,
    ).bind(
      snapshotDate,
      card.id,
      card.mode,
      card.kind,
      card.likes,
      card.dislikes,
      card.totalVotes,
      card.successPercent,
    ),
  );

  if (statements.length > 0) {
    await env.DB.batch(statements);
  }
}

function cardAdminHtml() {
  return `<!doctype html>
<html lang="hu">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Az ivós játék</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #090018;
      color: white;
    }
    * { box-sizing: border-box; }
    body {
      min-height: 100vh;
      margin: 0;
      background:
        linear-gradient(115deg, rgba(37,0,77,.92), rgba(90,0,56,.86)),
        radial-gradient(circle at 12% 12%, rgba(251,191,36,.22), transparent 30%),
        radial-gradient(circle at 90% 20%, rgba(236,72,153,.2), transparent 34%),
        #090018;
    }
    button, input, select, textarea { font: inherit; }
    button { -webkit-tap-highlight-color: transparent; }
    .shell { width: min(1200px, 100%); margin: 0 auto; padding: 24px; }
    .topbar { display: flex; gap: 16px; align-items: center; justify-content: space-between; margin-bottom: 18px; }
    .eyebrow {
      margin: 0 0 6px; color: #fde68a; font-size: .78rem; font-weight: 950;
      letter-spacing: .22em; text-transform: uppercase;
    }
    h1 { margin: 0; font-size: clamp(2.3rem, 7vw, 4.8rem); line-height: .9; letter-spacing: 0; }
    h2 { margin: 0; font-size: clamp(1.4rem, 5vw, 2rem); }
    .muted { color: rgba(255,255,255,.66); }
    .button {
      border: 0; border-radius: 18px; padding: 13px 16px; cursor: pointer; font-weight: 950;
      background: linear-gradient(90deg, #fcd34d, #fb923c, #ec4899); color: #110022;
      box-shadow: 0 14px 32px rgba(236,72,153,.26);
    }
    .button:disabled { cursor: wait; opacity: .65; }
    .button.secondary { background: rgba(255,255,255,.11); color: white; box-shadow: inset 0 0 0 1px rgba(255,255,255,.16); }
    .button.danger { background: rgba(244,63,94,.16); color: #ffe4e6; box-shadow: inset 0 0 0 1px rgba(244,63,94,.42); }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: flex-end; }
    .status { flex-basis: 100%; min-height: 1rem; margin: 0; color: rgba(255,255,255,.58); font-size: .78rem; font-weight: 900; text-align: right; }
    .status.ok { color: #bef264; }
    .status.error { color: #fecdd3; }
    .grid { display: grid; grid-template-columns: 280px 1fr; gap: 16px; align-items: start; }
    .panel {
      border: 1px solid rgba(255,255,255,.13); border-radius: 26px; background: rgba(10,0,32,.58);
      box-shadow: 0 20px 60px rgba(0,0,0,.22); backdrop-filter: blur(16px);
    }
    .side { padding: 14px; position: sticky; top: 18px; }
    .category {
      width: 100%; border: 0; border-radius: 20px; margin-bottom: 10px; padding: 16px;
      text-align: left; color: white; background: rgba(255,255,255,.09); cursor: pointer;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.12);
    }
    .category.active { background: linear-gradient(135deg, rgba(252,211,77,.28), rgba(236,72,153,.26)); box-shadow: inset 0 0 0 1px rgba(252,211,77,.55); }
    .category strong { display: block; font-size: 1.22rem; }
    .category span { color: rgba(255,255,255,.62); font-weight: 800; font-size: .86rem; }
    .main { padding: 16px; min-height: 70vh; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 14px; }
    .field {
      width: 100%; min-height: 48px; border: 1px solid rgba(255,255,255,.14); border-radius: 16px;
      background: rgba(255,255,255,.08); color: white; padding: 0 14px; outline: none;
    }
    textarea.field { min-height: 148px; resize: vertical; padding: 14px; line-height: 1.42; }
    .search { flex: 1 1 220px; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip {
      border: 1px solid rgba(255,255,255,.15); border-radius: 999px; padding: 10px 13px; color: white;
      background: rgba(255,255,255,.08); cursor: pointer; font-weight: 900;
    }
    .chip.active { color: #090018; background: #bef264; border-color: transparent; }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; margin-bottom: 14px; }
    .stat { padding: 14px; border-radius: 20px; background: rgba(255,255,255,.08); box-shadow: inset 0 0 0 1px rgba(255,255,255,.1); }
    .stat b { display: block; font-size: 1.6rem; color: #fef3c7; }
    .stat span { color: rgba(255,255,255,.58); font-weight: 800; font-size: .84rem; }
    .list { max-height: calc(100vh - 300px); min-height: 420px; overflow: auto; padding-right: 4px; display: grid; gap: 10px; }
    .card {
      display: grid; grid-template-columns: minmax(0,1fr) 160px; gap: 14px; padding: 14px;
      border-radius: 22px; background: rgba(255,255,255,.08); box-shadow: inset 0 0 0 1px rgba(255,255,255,.1);
    }
    .card-title-row { display: flex; gap: 10px; align-items: flex-start; justify-content: space-between; }
    .card-title { margin: 0 0 8px; color: #fde68a; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; font-size: .76rem; }
    .card-text { margin: 0; font-size: 1.06rem; font-weight: 900; line-height: 1.28; }
    .edit-button {
      width: 42px; height: 42px; flex: 0 0 42px; border: 0; border-radius: 14px; cursor: pointer;
      background: rgba(255,255,255,.12); color: white; font-weight: 950; box-shadow: inset 0 0 0 1px rgba(255,255,255,.16);
    }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .pill { border-radius: 999px; padding: 7px 10px; background: rgba(255,255,255,.1); color: rgba(255,255,255,.74); font-weight: 900; font-size: .78rem; }
    .score { text-align: right; }
    .score b { display: block; font-size: 2rem; line-height: 1; color: #bef264; }
    .score span { color: rgba(255,255,255,.58); font-weight: 900; font-size: .82rem; }
    .vote-breakdown { display: grid; gap: 6px; margin-top: 10px; }
    .vote { display: flex; justify-content: space-between; gap: 10px; border-radius: 12px; padding: 7px 9px; background: rgba(255,255,255,.08); color: rgba(255,255,255,.78); font-weight: 950; font-size: .82rem; }
    .vote em { font-style: normal; }
    .vote.like strong { color: #bef264; }
    .vote.dislike strong { color: #fecdd3; }
    .bar { height: 8px; border-radius: 99px; margin-top: 10px; background: rgba(255,255,255,.1); overflow: hidden; }
    .bar i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg,#bef264,#fcd34d,#ec4899); }
    .empty, .error { padding: 22px; border-radius: 22px; background: rgba(244,63,94,.12); color: #ffe4e6; font-weight: 900; }
    .login, .modal { display: none; position: fixed; inset: 0; place-items: center; background: rgba(9,0,24,.82); padding: 20px; z-index: 20; }
    .login.show, .modal.show { display: grid; }
    .login-card, .modal-card { width: min(520px, 100%); padding: 20px; max-height: min(860px, 92vh); overflow: auto; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
    .form-grid .full { grid-column: 1 / -1; }
    label { display: grid; gap: 7px; color: rgba(255,255,255,.76); font-size: .8rem; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; }
    .modal-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; margin-top: 14px; }
    @media (max-width: 760px) {
      .shell { padding: 16px; }
      .topbar { align-items: stretch; flex-direction: column; }
      .actions { justify-content: stretch; }
      .actions .button { flex: 1 1 150px; }
      .status { text-align: left; }
      .grid { grid-template-columns: 1fr; }
      .side { position: static; display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }
      .category { margin: 0; }
      .stats { grid-template-columns: repeat(2, minmax(0,1fr)); }
      .card { grid-template-columns: 1fr; }
      .score { text-align: left; }
      .list { max-height: none; min-height: 0; }
      .form-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">Én még sosem...</p>
        <h1>Az ivós játék</h1>
        <p class="muted">Kártyák szerkesztése és sikerességi rátája Cloudflare D1 adatokból.</p>
      </div>
      <div class="actions">
        <button class="button" id="addCardButton">Kártya hozzáadása</button>
        <button class="button secondary" id="refreshButton">Frissítés</button>
        <p class="status" id="refreshStatus" aria-live="polite"></p>
      </div>
    </header>
    <div class="grid">
      <aside class="panel side" id="modeList"></aside>
      <main class="panel main">
        <div class="toolbar">
          <input class="field search" id="searchInput" placeholder="Keresés kérdésben..." />
          <div class="chips" id="kindChips"></div>
        </div>
        <section class="stats" id="statsGrid"></section>
        <section class="list" id="cardList"></section>
      </main>
    </div>
  </div>
  <div class="login" id="loginDialog">
    <section class="panel login-card">
      <p class="eyebrow">Privát nézet</p>
      <h2>Admin token</h2>
      <p class="muted">Add meg a Cloudflare Workerhez beállított admin tokent.</p>
      <input class="field" id="tokenInput" placeholder="Token" />
      <div style="height:10px"></div>
      <button class="button" id="saveTokenButton">Belépés</button>
    </section>
  </div>
  <div class="modal" id="cardDialog">
    <section class="panel modal-card">
      <p class="eyebrow" id="editorEyebrow">Kártya</p>
      <h2 id="editorTitle">Kártya hozzáadása</h2>
      <div class="form-grid">
        <label>Mód
          <select class="field" id="cardModeInput"></select>
        </label>
        <label>Típus
          <select class="field" id="cardKindInput"></select>
        </label>
        <label class="full">Fejléc
          <input class="field" id="cardTitleInput" maxlength="80" />
        </label>
        <label class="full">Kártyaszöveg
          <textarea class="field" id="cardTextInput" maxlength="420"></textarea>
        </label>
        <label>Időzítő mp
          <input class="field" id="cardDurationInput" type="number" min="0" max="300" step="1" />
        </label>
      </div>
      <div class="modal-actions">
        <button class="button danger" id="deleteCardButton">Törlés</button>
        <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end">
          <button class="button secondary" id="cancelEditButton">Mégse</button>
          <button class="button" id="saveCardButton">Mentés</button>
        </div>
      </div>
    </section>
  </div>
  <script>
    const state = {
      cards: [],
      kinds: [],
      categories: [],
      totals: {},
      activeMode: 'bold',
      activeKind: 'all',
      search: '',
      editingCard: null,
    };
    const tokenKey = 'jatek.adminToken';
    const kindLabels = { all: 'Összes', never: 'Én még sosem', duel: 'Párharc', roundtable: 'Körbemenős' };
    const fallbackModes = [
      { id: 'classic', name: 'Vicces', modeName: 'Klasszikus', totalCards: 0, ready: true },
      { id: 'bold', name: 'Pikáns', modeName: 'Merész', totalCards: 0, ready: true },
      { id: 'hardcore', name: 'Nagyobb kihívás', modeName: 'Hardcore', totalCards: 0, ready: true },
      { id: 'university', name: 'Pikáns + Hardcore', modeName: 'Egyetemista', totalCards: 0, ready: true },
    ];

    function adminHeaders(extra) {
      const token = localStorage.getItem(tokenKey) || '';
      return Object.assign({}, extra || {}, token ? { 'X-Admin-Token': token } : {});
    }

    function successValue(value) {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? numericValue : 50;
    }

    function formatPercent(value) {
      return Math.round(successValue(value)) + '%';
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]);
    }

    function currentModeList() {
      const categories = state.categories.length > 0 ? state.categories : fallbackModes;
      const byId = new Map(fallbackModes.map((mode) => [mode.id, mode]));
      categories.forEach((mode) => byId.set(mode.id, { ...byId.get(mode.id), ...mode }));
      return [...byId.values()];
    }

    function renderModes() {
      document.getElementById('modeList').innerHTML = currentModeList().map((mode) =>
        '<button class="category ' + (state.activeMode === mode.id ? 'active' : '') + '" data-mode="' + mode.id + '">' +
        '<strong>' + escapeHtml(mode.name) + '</strong><span>' + escapeHtml(mode.modeName) + ' · ' + Number(mode.totalCards || 0) + ' kártya</span></button>'
      ).join('');
      document.querySelectorAll('[data-mode]').forEach((button) => {
        button.addEventListener('click', () => {
          state.activeMode = button.dataset.mode;
          state.activeKind = 'all';
          loadStats();
        });
      });
    }

    function renderStats(cards) {
      const totals = cards.reduce((acc, card) => {
        acc.likes += Number(card.likes) || 0;
        acc.dislikes += Number(card.dislikes) || 0;
        acc.totalVotes += Number(card.totalVotes) || 0;
        return acc;
      }, { likes: 0, dislikes: 0, totalVotes: 0 });
      const success = totals.totalVotes > 0 ? (totals.likes / totals.totalVotes) * 100 : 50;
      document.getElementById('statsGrid').innerHTML = [
        ['Kártya', cards.length],
        ['Like', totals.likes],
        ['Dislike', totals.dislikes],
        ['Sikeresség', formatPercent(success)],
      ].map(([label, value]) => '<article class="stat"><b>' + value + '</b><span>' + label + '</span></article>').join('');
    }

    function renderKinds() {
      const chips = [{ id: 'all', label: 'Összes', totalCards: state.cards.length }, ...state.kinds];
      document.getElementById('kindChips').innerHTML = chips.map((kind) =>
        '<button class="chip ' + (state.activeKind === kind.id ? 'active' : '') + '" data-kind="' + kind.id + '">' +
        escapeHtml(kindLabels[kind.id] || kind.label) + ' · ' + Number(kind.totalCards || 0) + '</button>'
      ).join('');
      document.querySelectorAll('[data-kind]').forEach((button) => {
        button.addEventListener('click', () => {
          state.activeKind = button.dataset.kind;
          render();
        });
      });
    }

    function compareDashboardCards(firstCard, secondCard) {
      const firstScore = successValue(firstCard.successPercent);
      const secondScore = successValue(secondCard.successPercent);
      if (secondScore !== firstScore) return secondScore - firstScore;
      if (secondCard.totalVotes !== firstCard.totalVotes) return secondCard.totalVotes - firstCard.totalVotes;
      if (secondCard.likes !== firstCard.likes) return secondCard.likes - firstCard.likes;
      if (firstCard.dislikes !== secondCard.dislikes) return firstCard.dislikes - secondCard.dislikes;
      return (Number(firstCard.sortOrder) || 0) - (Number(secondCard.sortOrder) || 0);
    }

    function filteredCards() {
      const needle = state.search.toLocaleLowerCase('hu-HU');
      return state.cards.filter((card) => {
        const kindMatches = state.activeKind === 'all' || card.kind === state.activeKind;
        const searchMatches = !needle || (card.text + ' ' + card.title + ' ' + card.id).toLocaleLowerCase('hu-HU').includes(needle);
        return kindMatches && searchMatches;
      }).sort(compareDashboardCards);
    }

    function sourceLabel(card) {
      if (card.source === 'custom') return 'Saját';
      if (card.source === 'override') return 'Szerkesztett';
      return 'Alap';
    }

    function renderCards(cards) {
      const list = document.getElementById('cardList');
      if (cards.length === 0) {
        list.innerHTML = '<div class="empty">Nincs találat ebben a szűrésben.</div>';
        return;
      }
      list.innerHTML = cards.map((card) => {
        const percent = Math.max(0, Math.min(100, successValue(card.successPercent)));
        return '<article class="card">' +
          '<div><div class="card-title-row"><div><p class="card-title">' + escapeHtml(card.title) + '</p></div>' +
          '<button class="edit-button" data-edit-card="' + escapeHtml(card.id) + '" title="Szerkesztés">✎</button></div>' +
          '<p class="card-text">' + escapeHtml(card.text) + '</p>' +
          '<div class="meta"><span class="pill">' + escapeHtml(card.kindLabel || kindLabels[card.kind]) + '</span><span class="pill">' + escapeHtml(sourceLabel(card)) + '</span><span class="pill">ID: ' + escapeHtml(card.id) + '</span></div></div>' +
          '<div class="score"><b>' + formatPercent(card.successPercent) + '</b>' +
          '<div class="vote-breakdown"><span class="vote like"><em>Like</em><strong>' + Number(card.likes || 0) + '</strong></span>' +
          '<span class="vote dislike"><em>Dislike</em><strong>' + Number(card.dislikes || 0) + '</strong></span></div>' +
          '<div class="bar"><i style="width:' + percent + '%"></i></div><span>' + Number(card.totalVotes || 0) + ' szavazat</span></div>' +
        '</article>';
      }).join('');
      document.querySelectorAll('[data-edit-card]').forEach((button) => {
        button.addEventListener('click', () => {
          const card = state.cards.find((item) => item.id === button.dataset.editCard);
          if (card) openEditor(card);
        });
      });
    }

    function render() {
      const cards = filteredCards();
      renderModes();
      renderKinds();
      renderStats(cards);
      renderCards(cards);
    }

    function setRefreshStatus(message, tone = '') {
      const status = document.getElementById('refreshStatus');
      status.textContent = message;
      status.className = ['status', tone].filter(Boolean).join(' ');
    }

    function setRefreshLoading(isLoading) {
      const button = document.getElementById('refreshButton');
      button.disabled = isLoading;
      button.textContent = isLoading ? 'Frissítés...' : 'Frissítés';
    }

    async function loadStats() {
      const list = document.getElementById('cardList');
      setRefreshLoading(true);
      setRefreshStatus('Frissítés folyamatban...');
      list.innerHTML = '<div class="empty">Adatok betöltése...</div>';

      try {
        const response = await fetch('/api/stats?mode=' + encodeURIComponent(state.activeMode) + '&_=' + Date.now(), {
          cache: 'no-store',
          headers: adminHeaders(),
        });

        if (response.status === 401) {
          document.getElementById('loginDialog').classList.add('show');
          list.innerHTML = '<div class="error">Admin token szükséges.</div>';
          setRefreshStatus('Admin token szükséges.', 'error');
          return;
        }

        if (!response.ok) {
          list.innerHTML = '<div class="error">Nem sikerült betölteni az adatokat.</div>';
          setRefreshStatus('Nem sikerült frissíteni.', 'error');
          return;
        }

        const data = await response.json();
        state.cards = data.cards || [];
        state.kinds = data.kinds || [];
        state.categories = data.categories || [];
        state.totals = data.totals || {};
        render();
        setRefreshStatus('Frissítve: ' + new Date().toLocaleTimeString('hu-HU'), 'ok');
      } catch {
        list.innerHTML = '<div class="error">Nem sikerült betölteni az adatokat.</div>';
        setRefreshStatus('Hálózati hiba frissítés közben.', 'error');
      } finally {
        setRefreshLoading(false);
      }
    }

    function populateEditorOptions() {
      const modeInput = document.getElementById('cardModeInput');
      modeInput.innerHTML = currentModeList().map((mode) =>
        '<option value="' + escapeHtml(mode.id) + '">' + escapeHtml(mode.modeName + ' - ' + mode.name) + '</option>'
      ).join('');
      document.getElementById('cardKindInput').innerHTML = ['never', 'duel', 'roundtable'].map((kind) =>
        '<option value="' + kind + '">' + escapeHtml(kindLabels[kind]) + '</option>'
      ).join('');
    }

    function openEditor(card) {
      populateEditorOptions();
      state.editingCard = card || null;
      document.getElementById('editorEyebrow').textContent = card ? 'Szerkesztés' : 'Új kártya';
      document.getElementById('editorTitle').textContent = card ? 'Kártya szerkesztése' : 'Kártya hozzáadása';
      document.getElementById('cardModeInput').value = card?.mode || state.activeMode;
      document.getElementById('cardKindInput').value = card?.kind || 'never';
      document.getElementById('cardTitleInput').value = card?.title || kindLabels.never;
      document.getElementById('cardTextInput').value = card?.text || '';
      document.getElementById('cardDurationInput').value = Number(card?.durationSeconds ?? 0);
      document.getElementById('deleteCardButton').style.display = card ? 'inline-flex' : 'none';
      document.getElementById('cardDialog').classList.add('show');
      document.getElementById('cardTextInput').focus();
    }

    function closeEditor() {
      state.editingCard = null;
      document.getElementById('cardDialog').classList.remove('show');
    }

    function editorPayload() {
      return {
        mode: document.getElementById('cardModeInput').value,
        kind: document.getElementById('cardKindInput').value,
        title: document.getElementById('cardTitleInput').value.trim(),
        text: document.getElementById('cardTextInput').value.trim(),
        durationSeconds: Number(document.getElementById('cardDurationInput').value) || 0,
      };
    }

    async function saveEditorCard() {
      const payload = editorPayload();
      if (!payload.title || !payload.text) {
        window.alert('A fejléc és a kártyaszöveg nem lehet üres.');
        return;
      }

      const isEdit = Boolean(state.editingCard);
      const confirmText = isEdit
        ? 'Biztosan mented a kártya módosításait? Ez a játékban is meg fog jelenni.'
        : 'Biztosan hozzáadod ezt a kártyát? Ez a játékban is meg fog jelenni.';
      if (!window.confirm(confirmText)) return;

      const url = isEdit ? '/api/cards/' + encodeURIComponent(state.editingCard.id) : '/api/cards';
      const method = isEdit ? 'PUT' : 'POST';

      try {
        const response = await fetch(url, {
          method,
          headers: adminHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload),
        });

        if (response.status === 401) {
          document.getElementById('loginDialog').classList.add('show');
          return;
        }

        if (!response.ok) {
          window.alert('Nem sikerült menteni a kártyát.');
          return;
        }

        state.activeMode = payload.mode;
        closeEditor();
        await loadStats();
      } catch {
        window.alert('Hálózati hiba történt mentés közben.');
      }
    }

    async function deleteEditorCard() {
      if (!state.editingCard) return;
      if (!window.confirm('Biztosan törlöd ezt a kártyát? A játékból is eltűnik.')) return;

      try {
        const response = await fetch('/api/cards/' + encodeURIComponent(state.editingCard.id), {
          method: 'DELETE',
          headers: adminHeaders(),
        });

        if (response.status === 401) {
          document.getElementById('loginDialog').classList.add('show');
          return;
        }

        if (!response.ok) {
          window.alert('Nem sikerült törölni a kártyát.');
          return;
        }

        closeEditor();
        await loadStats();
      } catch {
        window.alert('Hálózati hiba történt törlés közben.');
      }
    }

    document.getElementById('refreshButton').addEventListener('click', () => loadStats());
    document.getElementById('addCardButton').addEventListener('click', () => openEditor(null));
    document.getElementById('searchInput').addEventListener('input', (event) => {
      state.search = event.target.value;
      render();
    });
    document.getElementById('cardKindInput').addEventListener('change', (event) => {
      if (!state.editingCard && !document.getElementById('cardTitleInput').value.trim()) {
        document.getElementById('cardTitleInput').value = kindLabels[event.target.value] || '';
      }
      if (event.target.value !== 'never' && Number(document.getElementById('cardDurationInput').value) === 0) {
        document.getElementById('cardDurationInput').value = 30;
      }
    });
    document.getElementById('cancelEditButton').addEventListener('click', closeEditor);
    document.getElementById('saveCardButton').addEventListener('click', saveEditorCard);
    document.getElementById('deleteCardButton').addEventListener('click', deleteEditorCard);
    document.getElementById('saveTokenButton').addEventListener('click', () => {
      const token = document.getElementById('tokenInput').value.trim();
      if (token) localStorage.setItem(tokenKey, token);
      document.getElementById('loginDialog').classList.remove('show');
      loadStats();
    });
    loadStats();
  </script>
</body>
</html>`;
}

function adminHtml() {
  return cardAdminHtml();
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      const origin = request.headers.get('Origin');
      if (origin && !isAllowedOrigin(origin)) {
        return new Response(null, { status: 403, headers: securityHeaders });
      }

      return new Response(null, {
        status: 204,
        headers: {
          ...securityHeaders,
          ...corsHeaders(request),
        },
      });
    }

    const url = new URL(request.url);
    const cardRouteMatch = url.pathname.match(/^\/api\/cards\/([^/]+)$/);

    if (url.pathname === '/api/vote' && request.method === 'POST') {
      return handleVote(request, env);
    }

    if (url.pathname === '/api/cards' && request.method === 'GET') {
      return handleCards(request, env);
    }

    if (url.pathname === '/api/cards' && request.method === 'POST') {
      const unauthorized = withAdminGuard(request, env);
      if (unauthorized) return unauthorized;
      return handleCreateCard(request, env);
    }

    if (cardRouteMatch && request.method === 'PUT') {
      const unauthorized = withAdminGuard(request, env);
      if (unauthorized) return unauthorized;
      return handleUpdateCard(request, env, decodeURIComponent(cardRouteMatch[1]));
    }

    if (cardRouteMatch && request.method === 'DELETE') {
      const unauthorized = withAdminGuard(request, env);
      if (unauthorized) return unauthorized;
      return handleDeleteCard(request, env, decodeURIComponent(cardRouteMatch[1]));
    }

    if (url.pathname === '/api/stats' && request.method === 'GET') {
      const unauthorized = withAdminGuard(request, env);
      if (unauthorized) return unauthorized;
      return handleStats(request, env);
    }

    if (url.pathname === '/api/public-stats' && request.method === 'GET') {
      return handlePublicStats(request, env);
    }

    if (url.pathname === '/api/refresh-snapshot' && request.method === 'POST') {
      const unauthorized = withAdminGuard(request, env);
      if (unauthorized) return unauthorized;
      await refreshDailySnapshot(env);
      return jsonResponse(request, { ok: true });
    }

    if (url.pathname.startsWith('/api/')) {
      return jsonResponse(request, { error: 'not-found' }, { status: 404 });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: {
          Allow: 'GET, HEAD',
          ...securityHeaders,
        },
      });
    }

    return new Response(adminHtml(), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        ...securityHeaders,
      },
    });
  },

  async scheduled(_controller, env) {
    await refreshDailySnapshot(env);
  },
};
