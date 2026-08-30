export const latestReleaseApiUrl =
  'https://api.github.com/repos/MKristof64/Jatek/releases/latest';

export const releaseApkName = 'Az-ivos-jatek.apk';

const releaseDownloadPath =
  /^\/MKristof64\/Jatek\/releases\/download\/[^/]+\/Az-ivos-jatek\.apk$/;
const sha256Pattern = /^(?:sha256:)?([a-f0-9]{64})$/i;

function parseVersion(version) {
  const match = String(version ?? '')
    .trim()
    .match(/^v?(\d+)\.(\d+)\.(\d+)$/i);

  if (!match) return null;
  return match.slice(1).map(Number);
}

export function compareAppVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);

  if (!leftParts || !rightParts) {
    throw new Error('Érvénytelen alkalmazásverzió.');
  }

  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }

  return 0;
}

function validateDownloadUrl(value) {
  const url = new URL(value);

  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'github.com' ||
    !releaseDownloadPath.test(url.pathname)
  ) {
    throw new Error('A kiadás letöltési címe nem megbízható.');
  }

  return url.href;
}

export function parseLatestAppRelease(payload, currentVersion) {
  if (!payload || payload.draft || payload.prerelease) return null;

  const version = String(payload.tag_name ?? '').replace(/^v/i, '');
  if (compareAppVersions(version, currentVersion) <= 0) return null;

  const asset = Array.isArray(payload.assets)
    ? payload.assets.find((item) => item?.name === releaseApkName)
    : null;
  const digestMatch = String(asset?.digest ?? '').match(sha256Pattern);

  if (!asset || !digestMatch) {
    throw new Error('A kiadáshoz nem található ellenőrizhető Android-telepítő.');
  }

  return {
    version,
    url: validateDownloadUrl(asset.browser_download_url),
    sha256: digestMatch[1].toLowerCase(),
    size: Number.isFinite(asset.size) ? asset.size : 0,
    releaseUrl: String(payload.html_url ?? ''),
  };
}

export async function fetchLatestAppRelease(currentVersion, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl(latestReleaseApiUrl, {
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    throw new Error(`A frissítési adatok nem érhetők el (${response.status}).`);
  }

  return parseLatestAppRelease(await response.json(), currentVersion);
}
