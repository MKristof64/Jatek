import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  landscapeRatios,
  normalizeLandscapeRatio,
  toggleLandscapeRatio,
} from '../src/data/displayRatios.js';

const readProjectFile = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('landscape presets expose the requested ratios and valid CSS dimensions', () => {
  assert.deepEqual(
    landscapeRatios.map((ratio) => ratio.id),
    ['16:9', '4:3', '3:2', '16:10'],
  );

  landscapeRatios.forEach((ratio) => {
    assert.ok(ratio.numericRatio > 1);
    assert.match(ratio.cssRatio, /^\d+ \/ \d+$/);
    assert.ok(ratio.label.length > 0);
    assert.ok(ratio.description.length > 0);
  });
});

test('selecting the active ratio returns to portrait while another ratio switches directly', () => {
  assert.equal(toggleLandscapeRatio(null, '16:9'), '16:9');
  assert.equal(toggleLandscapeRatio('16:9', '16:9'), null);
  assert.equal(toggleLandscapeRatio('16:9', '4:3'), '4:3');
  assert.equal(toggleLandscapeRatio('invalid', '3:2'), '3:2');
  assert.equal(toggleLandscapeRatio('3:2', 'invalid'), '3:2');
  assert.equal(normalizeLandscapeRatio('16:10'), '16:10');
  assert.equal(normalizeLandscapeRatio('1:1'), null);
});

test('settings and fullscreen sources wire persisted dynamic orientation', async () => {
  const [appSource, settingsSource, fullscreenSource] = await Promise.all([
    readProjectFile('src/App.jsx'),
    readProjectFile('src/pages/SettingsPage.jsx'),
    readProjectFile('src/lib/fullscreen.js'),
  ]);

  assert.match(appSource, /landscapeRatio: normalizeLandscapeRatio/);
  assert.match(appSource, /onLandscapeRatioChange=\{changeLandscapeRatio\}/);
  assert.match(appSource, /lockLandscapeOrientation/);
  assert.match(settingsSource, /<LandscapeRatioPicker/);
  assert.match(fullscreenSource, /orientation: 'landscape-primary'/);
  assert.match(fullscreenSource, /orientation\.lock\('landscape-primary'\)/);
});

test('landscape mode selection stays single-column with a compact start action', async () => {
  const styles = await readProjectFile('src/index.css');

  assert.match(
    styles,
    /\.mode-list \{\s*display: grid !important;\s*grid-template-columns: minmax\(0, 1fr\);\s*grid-auto-rows: max-content;/,
  );
  assert.match(styles, /\.mode-list \.mode-card-dynamic \{\s*min-height: max-content;/);
  assert.match(
    styles,
    /\.mode-start-button \{\s*width: clamp\(11rem, 30vw, 15rem\);\s*min-height: 3\.25rem;\s*height: 3\.25rem;/,
  );
  assert.doesNotMatch(
    styles,
    /\.mode-list \{\s*display: grid !important;\s*grid-template-columns: repeat\(2,/,
  );
});
