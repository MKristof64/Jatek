import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../cloudflare/feedback-worker/src/index.js';

test('az ismeretlen eredetű CORS előkérés elutasításra kerül', async () => {
  const response = await worker.fetch(
    new Request('https://jatek.example/api/cards', {
      method: 'OPTIONS',
      headers: { Origin: 'https://attacker.example' },
    }),
    {},
  );

  assert.equal(response.status, 403);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
});

test('a GitHub Pages eredete hozzáférhet a publikus API-hoz', async () => {
  const response = await worker.fetch(
    new Request('https://jatek.example/api/cards', {
      method: 'OPTIONS',
      headers: { Origin: 'https://mkristof64.github.io' },
    }),
    {},
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://mkristof64.github.io');
});

test('hiányzó admin token esetén az admin API zárva marad', async () => {
  const response = await worker.fetch(
    new Request('https://jatek.example/api/stats?mode=bold', {
      headers: { Accept: 'application/json' },
    }),
    {},
  );

  assert.equal(response.status, 401);
});

test('az admin token URL-paraméterként nem használható', async () => {
  const response = await worker.fetch(
    new Request('https://jatek.example/api/stats?mode=bold&token=secret', {
      headers: { Accept: 'application/json' },
    }),
    { ADMIN_TOKEN: 'secret' },
  );

  assert.equal(response.status, 401);
});

test('az ismeretlen API útvonal szabályos 404 választ ad', async () => {
  const response = await worker.fetch(
    new Request('https://jatek.example/api/does-not-exist'),
    {},
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'not-found' });
});

test('a megszüntetett szavazási végpont nem fogad adatot', async () => {
  const response = await worker.fetch(
    new Request('https://jatek.example/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId: 'card-1', voteType: 'like' }),
    }),
    {},
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'not-found' });
});

test('a vezérlőközpont biztonsági fejléceket küld', async () => {
  const response = await worker.fetch(new Request('https://jatek.example/'), {});

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
  assert.match(response.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  assert.equal(response.headers.get('Cross-Origin-Opener-Policy'), 'same-origin');
});
