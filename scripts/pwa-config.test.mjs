import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { lockPortraitOrientation } from '../src/lib/fullscreen.js';

test('the installed app is fixed to primary portrait orientation', async () => {
  const manifestUrl = new URL('../public/manifest.webmanifest', import.meta.url);
  const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));

  assert.equal(manifest.orientation, 'portrait-primary');
});

test('the installed app reinforces the portrait lock at runtime', async () => {
  const originalWindow = globalThis.window;
  const requestedOrientations = [];

  globalThis.window = {
    screen: {
      orientation: {
        lock: async (orientation) => requestedOrientations.push(orientation),
      },
    },
  };

  try {
    assert.equal(await lockPortraitOrientation(), true);
    assert.deepEqual(requestedOrientations, ['portrait-primary']);
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});
