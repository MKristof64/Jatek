import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { removeLegacyPwaArtifacts } from '../src/lib/legacyPwaCleanup.js';

const projectUrl = (relativePath) => new URL(`../${relativePath}`, import.meta.url);

test('the website is no longer installable as a PWA', async () => {
  const indexHtml = await readFile(projectUrl('index.html'), 'utf8');
  const mainSource = await readFile(projectUrl('src/main.jsx'), 'utf8');
  const homeSource = await readFile(projectUrl('src/pages/HomePage.jsx'), 'utf8');

  assert.doesNotMatch(indexHtml, /rel="manifest"/i);
  assert.doesNotMatch(indexHtml, /mobile-web-app-capable/i);
  assert.doesNotMatch(indexHtml, /apple-mobile-web-app-capable/i);
  assert.doesNotMatch(mainSource, /serviceWorker\.register/);
  assert.doesNotMatch(mainSource, /beforeinstallprompt/);
  assert.doesNotMatch(homeSource, /Alkalmazás telepítése/);
  assert.match(homeSource, /Android alkalmazás letöltése/);

  await assert.rejects(access(projectUrl('public/manifest.webmanifest')), { code: 'ENOENT' });
  await assert.rejects(access(projectUrl('public/sw.js')), { code: 'ENOENT' });
});

test('the web download button selects the signed release or the Dev Pages test APK', async () => {
  const appSource = await readFile(projectUrl('src/App.jsx'), 'utf8');
  const homeSource = await readFile(projectUrl('src/pages/HomePage.jsx'), 'utf8');

  assert.match(
    appSource,
    /https:\/\/github\.com\/MKristof64\/Jatek\/releases\/latest\/download\/Az-ivos-jatek\.apk/,
  );
  assert.match(appSource, /const isNativeAppBuild = import\.meta\.env\.MODE\.startsWith\('android'\)/);
  assert.match(appSource, /const isDevPagesBuild = import\.meta\.env\.MODE === 'devpages'/);
  assert.match(appSource, /Az-ivos-jatek-dev\.apk/);
  assert.match(
    appSource,
    /isNativeAppBuild \|\| Capacitor\.isNativePlatform\(\)/,
  );
  assert.match(homeSource, /download="Az-ivos-jatek\.apk"/);
});

test('the room action is on the players page above mode continuation', async () => {
  const appSource = await readFile(projectUrl('src/App.jsx'), 'utf8');
  const homeSource = await readFile(projectUrl('src/pages/HomePage.jsx'), 'utf8');
  const playersSource = await readFile(projectUrl('src/pages/PlayersPage.jsx'), 'utf8');
  const playersRoute = appSource.slice(
    appSource.indexOf('<PlayersPage'),
    appSource.indexOf('/>', appSource.indexOf('<PlayersPage')) + 2,
  );

  assert.doesNotMatch(homeSource, /\bonRoom\b/);
  assert.doesNotMatch(homeSource, />\s*Szoba\s*</);
  assert.match(playersRoute, /onRoom=\{\(\) => setPage\(pages\.room\)\}/);
  assert.match(playersSource, /icon=\{Crown\}/);
  assert.ok(playersSource.indexOf('Szoba') < playersSource.indexOf('Tovább a módokhoz'));
});

test('native builds check GitHub releases without exposing the web download icon', async () => {
  const updaterSource = await readFile(projectUrl('src/lib/useNativeAppUpdater.js'), 'utf8');
  const releaseSource = await readFile(projectUrl('src/lib/appRelease.js'), 'utf8');
  const viteConfig = await readFile(projectUrl('vite.config.js'), 'utf8');

  assert.match(releaseSource, /api\.github\.com\/repos\/MKristof64\/Jatek\/releases\/latest/);
  assert.match(releaseSource, /sha256/);
  assert.match(updaterSource, /downloadAndPrepare/);
  assert.match(updaterSource, /url: release\.url/);
  assert.match(updaterSource, /sha256: release\.sha256/);
  assert.match(updaterSource, /version: release\.version/);
  assert.match(updaterSource, /downloadProgress/);
  assert.match(updaterSource, /appStateChange/);
  assert.doesNotMatch(updaterSource, /downloadAndInstall/);
  assert.doesNotMatch(updaterSource, /canInstallPackages/);
  assert.doesNotMatch(updaterSource, /permission-required/);
  assert.doesNotMatch(updaterSource, /url: release\.releaseUrl/);
  assert.doesNotMatch(updaterSource, /openUpdateDownload/);
  assert.match(viteConfig, /https:\/\/api\.github\.com/);
});

test('legacy cleanup removes only this game service worker and caches', async () => {
  const calls = [];
  const serviceWorker = {
    async getRegistration(scopeUrl) {
      calls.push(['scope', scopeUrl]);
      return {
        async unregister() {
          calls.push(['unregister']);
          return true;
        },
      };
    },
  };
  const cacheStorage = {
    async keys() {
      return ['az-ivos-jatek-v24', 'other-site-v1', 'az-ivos-jatek-v25'];
    },
    async delete(cacheName) {
      calls.push(['delete', cacheName]);
      return true;
    },
  };

  const result = await removeLegacyPwaArtifacts({
    serviceWorker,
    cacheStorage,
    scopeUrl: 'https://example.test/Jatek/',
  });

  assert.deepEqual(result, { unregistered: true, deletedCaches: 2 });
  assert.deepEqual(calls, [
    ['scope', 'https://example.test/Jatek/'],
    ['unregister'],
    ['delete', 'az-ivos-jatek-v24'],
    ['delete', 'az-ivos-jatek-v25'],
  ]);
});

test('legacy cleanup never blocks startup when browser storage is unavailable', async () => {
  const result = await removeLegacyPwaArtifacts({
    serviceWorker: {
      async getRegistration() {
        throw new Error('blocked');
      },
    },
    cacheStorage: {
      async keys() {
        throw new Error('blocked');
      },
      async delete() {
        return false;
      },
    },
    scopeUrl: 'https://example.test/Jatek/',
  });

  assert.deepEqual(result, { unregistered: false, deletedCaches: 0 });
});
