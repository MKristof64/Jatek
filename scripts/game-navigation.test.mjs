import assert from 'node:assert/strict';
import test from 'node:test';
import { initialGameFromSearch, gameLocation } from '../src/lib/gameNavigation.js';

test('only the explicit Darkroom invitation opens Darkroom at launch', () => {
  assert.equal(initialGameFromSearch('?jatek=darkroom&szoba=123456'), 'darkroom');
  assert.equal(initialGameFromSearch('?jatek=https://evil.test'), 'drinking');
  assert.equal(initialGameFromSearch('?szoba=123456'), 'drinking');
});

test('switching games clears the old room without exposing a credential', () => {
  assert.equal(gameLocation('https://localhost/?jatek=darkroom&szoba=123456', 'drinking'), '/');
  assert.equal(gameLocation('https://mkristof64.github.io/Jatek/?v=1.3.0', 'darkroom'), '/Jatek/?v=1.3.0&jatek=darkroom');
  assert.equal(gameLocation('https://mkristof64.github.io/Jatek/?jatek=darkroom&szoba=123456', 'chooser'), '/Jatek/');
});
