import { boldCards } from './bold-cards.js';

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
};

const kindLabels = {
  never: 'Én még sosem',
  duel: 'Párharc',
  roundtable: 'Körkérdés',
};

function corsHeaders(request) {
  const origin = request.headers.get('Origin') ?? '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonResponse(request, data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...jsonHeaders,
      'Cache-Control': 'no-store',
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

function findCard(cardId) {
  return boldCards.find((card) => card.id === cardId) ?? null;
}

function isAdminRequest(request, env) {
  const token = String(env.ADMIN_TOKEN ?? '');
  if (!token) return true;

  const url = new URL(request.url);
  const providedToken = request.headers.get('X-Admin-Token') ?? url.searchParams.get('token') ?? '';
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
  const card = findCard(cardId);

  if (!card || card.mode !== 'bold') {
    return jsonResponse(request, { error: 'unknown-card' }, { status: 400 });
  }

  if (voteType !== 'like' && voteType !== 'dislike') {
    return jsonResponse(request, { error: 'invalid-vote' }, { status: 400 });
  }

  await env.DB.prepare(
    `INSERT INTO feedback_votes
      (id, card_id, mode, kind, vote_type, app_context, app_version, page_origin)
     VALUES (?, ?, 'bold', ?, ?, ?, ?, ?)`,
  )
    .bind(
      createId(),
      card.id,
      card.kind,
      voteType,
      sanitizeText(payload.appContext ?? payload.app_context ?? 'local', 40) || 'local',
      sanitizeText(payload.appVersion ?? payload.app_version ?? '', 40),
      sanitizeText(request.headers.get('Origin') ?? payload.pageOrigin ?? payload.page_origin ?? '', 160),
    )
    .run();

  return jsonResponse(request, { ok: true });
}

async function getVoteStats(env) {
  const result = await env.DB.prepare(
    `SELECT
      card_id,
      SUM(CASE WHEN vote_type = 'like' THEN 1 ELSE 0 END) AS likes,
      SUM(CASE WHEN vote_type = 'dislike' THEN 1 ELSE 0 END) AS dislikes,
      COUNT(*) AS total_votes
     FROM feedback_votes
     WHERE mode = 'bold'
     GROUP BY card_id`,
  ).all();

  return Object.fromEntries(
    (result.results ?? []).map((row) => {
      const likes = Number(row.likes) || 0;
      const dislikes = Number(row.dislikes) || 0;
      const totalVotes = Number(row.total_votes) || 0;
      const successPercent = totalVotes > 0 ? Math.round((likes / totalVotes) * 10000) / 100 : null;

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
  const firstScore = Number.isFinite(firstCard.successPercent) ? firstCard.successPercent : -1;
  const secondScore = Number.isFinite(secondCard.successPercent) ? secondCard.successPercent : -1;
  if (secondScore !== firstScore) return secondScore - firstScore;
  if (secondCard.totalVotes !== firstCard.totalVotes) {
    return secondCard.totalVotes - firstCard.totalVotes;
  }
  if (secondCard.likes !== firstCard.likes) return secondCard.likes - firstCard.likes;
  if (firstCard.dislikes !== secondCard.dislikes) return firstCard.dislikes - secondCard.dislikes;
  return firstCard.sortOrder - secondCard.sortOrder;
}

async function buildStats(env) {
  const statsByCard = await getVoteStats(env);

  return boldCards
    .map((card) => {
      const stats = statsByCard[card.id] ?? {
        likes: 0,
        dislikes: 0,
        totalVotes: 0,
        successPercent: null,
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
  const mode = url.searchParams.get('mode') ?? 'bold';
  const kind = url.searchParams.get('kind') ?? 'all';

  if (mode !== 'bold') {
    return jsonResponse(request, { error: 'only-bold-is-ready' }, { status: 400 });
  }

  const cards = await buildStats(env);
  const filteredCards = kind === 'all' ? cards : cards.filter((card) => card.kind === kind);
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
    totals.totalVotes > 0 ? Math.round((totals.likes / totals.totalVotes) * 10000) / 100 : null;

  return jsonResponse(request, {
    mode: 'bold',
    category: 'Pikáns',
    cards: filteredCards,
    categories: [
      {
        id: 'bold',
        name: 'Pikáns',
        modeName: 'Merész',
        totalCards: boldCards.length,
        ready: true,
      },
    ],
    kinds: Object.entries(kindLabels).map(([id, label]) => ({
      id,
      label,
      totalCards: boldCards.filter((card) => card.kind === id).length,
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
  const mode = url.searchParams.get('mode') ?? 'bold';

  if (mode !== 'bold') {
    return jsonResponse(request, { error: 'only-bold-is-ready' }, { status: 400 });
  }

  const statsByCard = await getVoteStats(env);
  const stats = Object.fromEntries(
    Object.entries(statsByCard).map(([cardId, stat]) => [
      cardId,
      {
        cardId,
        likes: stat.likes,
        dislikes: stat.dislikes,
        totalVotes: stat.totalVotes,
        successPercent: stat.successPercent,
      },
    ]),
  );

  return jsonResponse(request, {
    mode: 'bold',
    stats,
    updatedAt: new Date().toISOString(),
  });
}

async function refreshDailySnapshot(env) {
  const snapshotDate = new Date().toISOString().slice(0, 10);
  const stats = await buildStats(env);
  const statements = stats.map((card) =>
    env.DB.prepare(
      `INSERT INTO daily_feedback_snapshots
        (snapshot_date, card_id, mode, kind, likes, dislikes, total_votes, success_percent, updated_at)
       VALUES (?, ?, 'bold', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(snapshot_date, card_id) DO UPDATE SET
        likes = excluded.likes,
        dislikes = excluded.dislikes,
        total_votes = excluded.total_votes,
        success_percent = excluded.success_percent,
        updated_at = CURRENT_TIMESTAMP`,
    ).bind(
      snapshotDate,
      card.id,
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

function adminHtml() {
  return `<!doctype html>
<html lang="hu">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Jatek Vezérlőközpont</title>
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
    button, input, select { font: inherit; }
    .shell { width: min(1180px, 100%); margin: 0 auto; padding: 24px; }
    .topbar {
      display: flex; gap: 16px; align-items: center; justify-content: space-between; margin-bottom: 18px;
    }
    .eyebrow {
      margin: 0 0 6px; color: #fde68a; font-size: .78rem; font-weight: 950;
      letter-spacing: .22em; text-transform: uppercase;
    }
    h1 { margin: 0; font-size: clamp(2rem, 6vw, 4rem); line-height: .92; letter-spacing: 0; }
    .muted { color: rgba(255,255,255,.64); }
    .button {
      border: 0; border-radius: 18px; padding: 13px 16px; cursor: pointer; font-weight: 950;
      background: linear-gradient(90deg, #fcd34d, #fb923c, #ec4899); color: #110022;
      box-shadow: 0 14px 32px rgba(236,72,153,.26);
    }
    .button:disabled { cursor: wait; opacity: .7; }
    .button.secondary { background: rgba(255,255,255,.12); color: white; box-shadow: inset 0 0 0 1px rgba(255,255,255,.14); }
    .actions { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
    .status { min-height: 1rem; margin: 0; color: rgba(255,255,255,.58); font-size: .78rem; font-weight: 900; }
    .status.ok { color: #bef264; }
    .status.error { color: #fecdd3; }
    .grid { display: grid; grid-template-columns: 260px 1fr; gap: 16px; align-items: start; }
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
    .category strong { display: block; font-size: 1.2rem; }
    .category span { color: rgba(255,255,255,.58); font-weight: 800; font-size: .86rem; }
    .main { padding: 16px; min-height: 70vh; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 14px; }
    .search {
      flex: 1 1 220px; min-height: 48px; border: 1px solid rgba(255,255,255,.14); border-radius: 16px;
      background: rgba(255,255,255,.08); color: white; padding: 0 14px; outline: none;
    }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip {
      border: 1px solid rgba(255,255,255,.15); border-radius: 999px; padding: 10px 13px; color: white;
      background: rgba(255,255,255,.08); cursor: pointer; font-weight: 900;
    }
    .chip.active { color: #090018; background: #bef264; border-color: transparent; }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; margin-bottom: 14px; }
    .stat { padding: 14px; border-radius: 20px; background: rgba(255,255,255,.08); box-shadow: inset 0 0 0 1px rgba(255,255,255,.1); }
    .stat b { display: block; font-size: 1.6rem; color: #fef3c7; }
    .stat span { color: rgba(255,255,255,.56); font-weight: 800; font-size: .84rem; }
    .list {
      max-height: calc(100vh - 300px); min-height: 420px; overflow: auto; padding-right: 4px;
      display: grid; gap: 10px;
    }
    .card {
      display: grid; grid-template-columns: minmax(0,1fr) 150px; gap: 14px; padding: 14px;
      border-radius: 22px; background: rgba(255,255,255,.08); box-shadow: inset 0 0 0 1px rgba(255,255,255,.1);
    }
    .card-title { margin: 0 0 8px; color: #fde68a; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; font-size: .76rem; }
    .card-text { margin: 0; font-size: 1.06rem; font-weight: 900; line-height: 1.28; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .pill { border-radius: 999px; padding: 7px 10px; background: rgba(255,255,255,.1); color: rgba(255,255,255,.72); font-weight: 900; font-size: .78rem; }
    .score { text-align: right; }
    .score b { display: block; font-size: 2rem; line-height: 1; color: #bef264; }
    .score span { color: rgba(255,255,255,.58); font-weight: 900; font-size: .82rem; }
    .bar { height: 8px; border-radius: 99px; margin-top: 10px; background: rgba(255,255,255,.1); overflow: hidden; }
    .bar i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg,#bef264,#fcd34d,#ec4899); }
    .empty, .error { padding: 22px; border-radius: 22px; background: rgba(244,63,94,.12); color: #ffe4e6; font-weight: 900; }
    .login {
      display: none; position: fixed; inset: 0; place-items: center; background: rgba(9,0,24,.82); padding: 20px;
    }
    .login.show { display: grid; }
    .login-card { width: min(420px, 100%); padding: 20px; }
    @media (max-width: 760px) {
      .shell { padding: 16px; }
      .topbar { align-items: stretch; flex-direction: column; }
      .actions { align-items: stretch; }
      .grid { grid-template-columns: 1fr; }
      .side { position: static; }
      .stats { grid-template-columns: repeat(2, minmax(0,1fr)); }
      .card { grid-template-columns: 1fr; }
      .score { text-align: left; }
      .list { max-height: none; min-height: 0; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">Én még sosem...</p>
        <h1>Jatek</h1>
        <p class="muted">Pikáns kérdések sikerességi rátája Cloudflare D1 adatokból.</p>
      </div>
      <div class="actions">
        <button class="button" id="refreshButton">Frissítés</button>
        <p class="status" id="refreshStatus" aria-live="polite"></p>
      </div>
    </header>
    <div class="grid">
      <aside class="panel side">
        <button class="category active" data-mode="bold"><strong>Pikáns</strong><span>Merész mód · aktív</span></button>
        <button class="category" disabled><strong>Klasszikus</strong><span>Később beköthető</span></button>
        <button class="category" disabled><strong>Őrült</strong><span>Később beköthető</span></button>
        <button class="category" disabled><strong>Hardcore</strong><span>Később beköthető</span></button>
      </aside>
      <main class="panel main">
        <div class="toolbar">
          <input class="search" id="searchInput" placeholder="Keresés kérdésben..." />
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
      <input class="search" id="tokenInput" placeholder="Token" />
      <div style="height:10px"></div>
      <button class="button" id="saveTokenButton">Belépés</button>
    </section>
  </div>
  <script>
    const state = { cards: [], kinds: [], totals: {}, activeKind: 'all', search: '' };
    const tokenKey = 'jatek.adminToken';
    const kindLabels = { all: 'Összes', never: 'Én még sosem', duel: 'Párharc', roundtable: 'Körkérdés' };

    function adminHeaders() {
      const token = localStorage.getItem(tokenKey) || '';
      return token ? { 'X-Admin-Token': token } : {};
    }

    function formatPercent(value) {
      return Number.isFinite(value) ? Math.round(value) + '%' : '-';
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

    function renderStats(cards) {
      const totals = cards.reduce((acc, card) => {
        acc.likes += card.likes;
        acc.dislikes += card.dislikes;
        acc.totalVotes += card.totalVotes;
        return acc;
      }, { likes: 0, dislikes: 0, totalVotes: 0 });
      const success = totals.totalVotes > 0 ? (totals.likes / totals.totalVotes) * 100 : null;
      document.getElementById('statsGrid').innerHTML = [
        ['Kérdés', cards.length],
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

    function filteredCards() {
      const needle = state.search.toLocaleLowerCase('hu-HU');
      return state.cards.filter((card) => {
        const kindMatches = state.activeKind === 'all' || card.kind === state.activeKind;
        const searchMatches = !needle || (card.text + ' ' + card.title).toLocaleLowerCase('hu-HU').includes(needle);
        return kindMatches && searchMatches;
      }).sort(compareDashboardCards);
    }

    function compareDashboardCards(firstCard, secondCard) {
      const firstScore = Number.isFinite(firstCard.successPercent) ? firstCard.successPercent : -1;
      const secondScore = Number.isFinite(secondCard.successPercent) ? secondCard.successPercent : -1;
      if (secondScore !== firstScore) return secondScore - firstScore;
      if (secondCard.totalVotes !== firstCard.totalVotes) return secondCard.totalVotes - firstCard.totalVotes;
      if (secondCard.likes !== firstCard.likes) return secondCard.likes - firstCard.likes;
      if (firstCard.dislikes !== secondCard.dislikes) return firstCard.dislikes - secondCard.dislikes;
      return firstCard.sortOrder - secondCard.sortOrder;
    }

    function renderCards(cards) {
      const list = document.getElementById('cardList');
      if (cards.length === 0) {
        list.innerHTML = '<div class="empty">Nincs találat ebben a szűrésben.</div>';
        return;
      }
      list.innerHTML = cards.map((card) => {
        const percent = Number.isFinite(card.successPercent) ? card.successPercent : 0;
        return '<article class="card">' +
          '<div><p class="card-title">' + escapeHtml(card.title) + '</p><p class="card-text">' + escapeHtml(card.text) + '</p>' +
          '<div class="meta"><span class="pill">' + escapeHtml(card.kindLabel) + '</span><span class="pill">ID: ' + escapeHtml(card.id) + '</span></div></div>' +
          '<div class="score"><b>' + formatPercent(card.successPercent) + '</b><span>' + card.likes + ' like / ' + card.dislikes + ' dislike</span>' +
          '<div class="bar"><i style="width:' + percent + '%"></i></div><span>' + card.totalVotes + ' szavazat</span></div>' +
        '</article>';
      }).join('');
    }

    function render() {
      const cards = filteredCards();
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
        const response = await fetch('/api/stats?mode=bold&_=' + Date.now(), {
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

    document.getElementById('refreshButton').addEventListener('click', () => loadStats());
    document.getElementById('searchInput').addEventListener('input', (event) => {
      state.search = event.target.value;
      render();
    });
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

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request) });
    }

    const url = new URL(request.url);

    if (url.pathname === '/api/vote' && request.method === 'POST') {
      return handleVote(request, env);
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

    return new Response(adminHtml(), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  },

  async scheduled(_controller, env) {
    await refreshDailySnapshot(env);
  },
};
