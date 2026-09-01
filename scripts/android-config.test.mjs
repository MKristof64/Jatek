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
  assert.doesNotMatch(manifest, /android\.permission\.REQUEST_INSTALL_PACKAGES/);
  assert.doesNotMatch(manifest, /androidx\.core\.content\.FileProvider/);
  assert.doesNotMatch(manifest, /android:resource="@xml\/file_paths"/);
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

test('Android updater verifies releases and hands them to system Downloads without install access', async () => {
  const updater = await readProjectFile(
    'android/app/src/main/java/hu/mkristof64/azivosjatek/AppUpdaterPlugin.java',
  );
  assert.match(updater, /github\.com/);
  assert.match(updater, /APK_DOWNLOAD_PATH/);
  assert.match(updater, /Az-ivos-jatek\\\\\.apk/);
  assert.match(updater, /downloadAndPrepare/);
  assert.match(updater, /MessageDigest\.getInstance\("SHA-256"\)/);
  assert.match(updater, /validateDownloadedApk/);
  assert.match(updater, /getSignerDigests/);
  assert.match(updater, /PackageInfoCompat\.getLongVersionCode/);
  assert.match(updater, /MediaStore\.Downloads\.EXTERNAL_CONTENT_URI/);
  assert.match(updater, /MediaStore\.MediaColumns\.IS_PENDING/);
  assert.match(updater, /addCompletedDownload/);
  assert.match(updater, /DownloadManager\.ACTION_VIEW_DOWNLOADS/);
  assert.match(updater, /release-assets\.githubusercontent\.com/);
  assert.doesNotMatch(updater, /ACTION_INSTALL_PACKAGE/);
  assert.doesNotMatch(updater, /ACTION_MANAGE_UNKNOWN_APP_SOURCES/);
  assert.doesNotMatch(updater, /FileProvider/);
  assert.doesNotMatch(updater, /canRequestPackageInstalls/);
  assert.doesNotMatch(updater, /Intent\.ACTION_VIEW/);
  assert.doesNotMatch(updater, /Intent\.CATEGORY_BROWSABLE/);
});

test('Android release is minimized and never commits signing secrets', async () => {
  const buildGradle = await readProjectFile('android/app/build.gradle');
  const gradleWrapper = await readProjectFile('android/gradle/wrapper/gradle-wrapper.properties');
  const ignoreRules = await readProjectFile('.gitignore');
  const packageJson = JSON.parse(await readProjectFile('package.json'));

  assert.match(buildGradle, /versionCode 21/);
  assert.match(buildGradle, /versionName "1\.2\.5"/);
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
