import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
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
  assert.doesNotMatch(manifest, /android\.permission\.REQUEST_INSTALL_PACKAGES/);
  assert.doesNotMatch(manifest, /androidx\.core\.content\.FileProvider/);
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
  assert.match(activity, /registerPlugin\(AppUpdaterPlugin\.class\)/);
});

test('Android updater opens only a trusted release page without package-install access', async () => {
  const updater = await readProjectFile(
    'android/app/src/main/java/hu/mkristof64/azivosjatek/AppUpdaterPlugin.java',
  );

  assert.match(updater, /github\.com/);
  assert.match(updater, /RELEASE_PATH/);
  assert.match(updater, /Intent\.ACTION_VIEW/);
  assert.match(updater, /Intent\.CATEGORY_BROWSABLE/);
  assert.match(updater, /"https"\.equalsIgnoreCase/);
  assert.doesNotMatch(updater, /ACTION_INSTALL_PACKAGE/);
  assert.doesNotMatch(updater, /PackageInstaller/);
  assert.doesNotMatch(updater, /FileProvider/);
  assert.doesNotMatch(updater, /FileOutputStream/);
  assert.doesNotMatch(updater, /ACTION_MANAGE_UNKNOWN_APP_SOURCES/);
  await assert.rejects(
    access(new URL('../android/app/src/main/res/xml/file_paths.xml', import.meta.url)),
    { code: 'ENOENT' },
  );
});

test('Android release is minimized and never commits signing secrets', async () => {
  const buildGradle = await readProjectFile('android/app/build.gradle');
  const gradleWrapper = await readProjectFile('android/gradle/wrapper/gradle-wrapper.properties');
  const ignoreRules = await readProjectFile('.gitignore');
  const packageJson = JSON.parse(await readProjectFile('package.json'));

  assert.match(buildGradle, /versionCode 17/);
  assert.match(buildGradle, /versionName "1\.2\.1"/);
  assert.match(buildGradle, /minifyEnabled true/);
  assert.match(buildGradle, /shrinkResources true/);
  assert.match(gradleWrapper, /gradle-8\.14\.5-bin\.zip/);
  assert.match(gradleWrapper, /distributionSha256Sum=[a-f0-9]{64}/);
  assert.match(ignoreRules, /android\/keystore\.properties/);
  assert.match(ignoreRules, /\*\.jks/);
  assert.match(ignoreRules, /\*\.keystore/);
  assert.match(packageJson.scripts['android:release'], /assembleRelease bundleRelease/);
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
