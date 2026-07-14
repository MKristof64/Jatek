const legacyCachePrefix = 'az-ivos-jatek-';

export async function removeLegacyPwaArtifacts({
  serviceWorker = globalThis.navigator?.serviceWorker,
  cacheStorage = globalThis.caches,
  scopeUrl = globalThis.location?.href,
} = {}) {
  let unregistered = false;
  let deletedCaches = 0;

  try {
    const registration =
      scopeUrl && typeof serviceWorker?.getRegistration === 'function'
        ? await serviceWorker.getRegistration(scopeUrl)
        : undefined;

    if (registration) {
      unregistered = await registration.unregister();
    }
  } catch {
    // Cleanup is best-effort and must never block the web app.
  }

  try {
    if (typeof cacheStorage?.keys === 'function' && typeof cacheStorage?.delete === 'function') {
      const cacheNames = await cacheStorage.keys();
      const legacyCaches = cacheNames.filter((name) => name.startsWith(legacyCachePrefix));
      const results = await Promise.all(legacyCaches.map((name) => cacheStorage.delete(name)));
      deletedCaches = results.filter(Boolean).length;
    }
  } catch {
    // A browser may restrict cache access; the page remains fully usable.
  }

  return { unregistered, deletedCaches };
}
