import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readProjectFile = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('Capacitor production settings keep the native shell private and secure', async () => {
  const config = JSON.parse(await readProjectFile('capacitor.config.json'));

  assert.equal(config.appId, 'hu.mkristof64.azivosjatek');
  assert.equal(config.appName, 'Az ivós játék');
  assert.equal(config.webDir, 'dist');
  assert.equal(config.loggingBehavior, 'none');
  assert.equal(config.zoomEnabled, false);
  assert.equal(config.server.androidScheme, 'https');
  assert.equal(config.android.allowMixedContent, false);
  assert.equal(config.android.webContentsDebuggingEnabled, false);
  assert.equal(config.android.useLegacyBridge, false);
});

test('Android manifest permits controlled rotation and blocks cleartext traffic', async () => {
  const manifest = await readProjectFile('android/app/src/main/AndroidManifest.xml');

  assert.match(manifest, /android:screenOrientation="unspecified"/);
  assert.doesNotMatch(manifest, /android:screenOrientation="portrait"/);
  assert.match(manifest, /android:launchMode="singleTask"/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:dataExtractionRules="@xml\/data_extraction_rules"/);
  assert.match(manifest, /android:fullBackupContent="@xml\/backup_rules"/);
  assert.match(manifest, /android:name="android\.permission\.INTERNET"/);
});

test('Android activity uses edge-to-edge immersive system bars', async () => {
  const activity = await readProjectFile(
    'android/app/src/main/java/hu/mkristof64/azivosjatek/MainActivity.java',
  );

  assert.match(activity, /setDecorFitsSystemWindows\(false\)/);
  assert.match(activity, /BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE/);
  assert.match(activity, /WindowInsets\.Type\.statusBars\(\)/);
  assert.match(activity, /WindowInsets\.Type\.navigationBars\(\)/);
  assert.match(activity, /SYSTEM_UI_FLAG_IMMERSIVE_STICKY/);
});

test('Android release is minimized and never commits signing secrets', async () => {
  const buildGradle = await readProjectFile('android/app/build.gradle');
  const gradleWrapper = await readProjectFile('android/gradle/wrapper/gradle-wrapper.properties');
  const ignoreRules = await readProjectFile('.gitignore');

  assert.match(buildGradle, /versionCode 7/);
  assert.match(buildGradle, /versionName "1\.1\.1"/);
  assert.match(buildGradle, /minifyEnabled true/);
  assert.match(buildGradle, /shrinkResources true/);
  assert.match(gradleWrapper, /gradle-8\.14\.5-bin\.zip/);
  assert.match(gradleWrapper, /distributionSha256Sum=[a-f0-9]{64}/);
  assert.match(ignoreRules, /android\/keystore\.properties/);
  assert.match(ignoreRules, /\*\.jks/);
  assert.match(ignoreRules, /\*\.keystore/);
});

test('native startup uses the Android asset base without web installation hooks', async () => {
  const mainSource = await readProjectFile('src/main.jsx');
  const viteConfig = await readProjectFile('vite.config.js');

  assert.doesNotMatch(mainSource, /serviceWorker\.register/);
  assert.doesNotMatch(mainSource, /beforeinstallprompt/);
  assert.match(mainSource, /window\.self !== window\.top/);
  assert.match(viteConfig, /mode === 'android' \|\| mode === 'android-dev'/);
  assert.match(viteConfig, /mode === 'devpages' \? '\/'/);
  assert.match(viteConfig, /'\/Jatek\/'/);
});
