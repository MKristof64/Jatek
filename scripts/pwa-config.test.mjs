import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('the installed app follows the device orientation preference', async () => {
  const manifestUrl = new URL('../public/manifest.webmanifest', import.meta.url);
  const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));

  assert.equal(
    Object.hasOwn(manifest, 'orientation'),
    false,
    'Do not force an orientation in the PWA manifest; Android must honor the user rotation setting.',
  );
});
