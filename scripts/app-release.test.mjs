import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareAppVersions,
  parseLatestAppRelease,
  releaseApkName,
} from '../src/lib/appRelease.js';

const validDigest = `sha256:${'a'.repeat(64)}`;

function releasePayload(overrides = {}) {
  return {
    tag_name: 'v1.2.0',
    draft: false,
    prerelease: false,
    html_url: 'https://github.com/MKristof64/Jatek/releases/tag/v1.2.0',
    assets: [
      {
        name: releaseApkName,
        size: 4_000_000,
        digest: validDigest,
        browser_download_url:
          'https://github.com/MKristof64/Jatek/releases/download/v1.2.0/Az-ivos-jatek.apk',
      },
    ],
    ...overrides,
  };
}

test('semantic app versions compare numerically', () => {
  assert.equal(compareAppVersions('1.1.2', '1.1.1'), 1);
  assert.equal(compareAppVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareAppVersions('v2.0.0', '2.0.0'), 0);
  assert.equal(compareAppVersions('1.0.9', '1.1.0'), -1);
  assert.throws(() => compareAppVersions('latest', '1.0.0'));
});

test('latest release parser returns only a newer verified GitHub APK', () => {
  assert.deepEqual(parseLatestAppRelease(releasePayload(), '1.1.2'), {
    version: '1.2.0',
    url: 'https://github.com/MKristof64/Jatek/releases/download/v1.2.0/Az-ivos-jatek.apk',
    sha256: 'a'.repeat(64),
    size: 4_000_000,
    releaseUrl: 'https://github.com/MKristof64/Jatek/releases/tag/v1.2.0',
  });
  assert.equal(parseLatestAppRelease(releasePayload(), '1.2.0'), null);
  assert.equal(parseLatestAppRelease(releasePayload({ draft: true }), '1.1.2'), null);
});

test('latest release parser rejects an unverified or foreign APK', () => {
  assert.throws(() =>
    parseLatestAppRelease(
      releasePayload({
        assets: [
          {
            name: releaseApkName,
            digest: validDigest,
            browser_download_url: 'https://example.com/Az-ivos-jatek.apk',
          },
        ],
      }),
      '1.1.2',
    ),
  );

  assert.throws(() =>
    parseLatestAppRelease(
      releasePayload({
        assets: [
          {
            name: releaseApkName,
            digest: null,
            browser_download_url:
              'https://github.com/MKristof64/Jatek/releases/download/v1.2.0/Az-ivos-jatek.apk',
          },
        ],
      }),
      '1.1.2',
    ),
  );

  assert.throws(() =>
    parseLatestAppRelease(
      releasePayload({ html_url: 'https://example.com/releases/tag/v1.2.0' }),
      '1.1.2',
    ),
  );

  assert.throws(() =>
    parseLatestAppRelease(
      releasePayload({
        html_url: 'https://github.com/MKristof64/Jatek/releases/tag/v1.2.0?unsafe=1',
      }),
      '1.1.2',
    ),
  );
});
