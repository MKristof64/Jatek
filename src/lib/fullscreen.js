const fallbackClass = 'app-fullscreen-fallback';
const gameFullscreenIntentKey = 'enmegsosem.gameFullscreenIntent';

function writeStoredIntent(storage, enabled) {
  try {
    if (enabled) {
      storage.setItem(gameFullscreenIntentKey, '1');
      return;
    }

    storage.removeItem(gameFullscreenIntentKey);
  } catch {
    // Storage can be unavailable in private or restricted browser modes.
  }
}

export function getGameFullscreenIntent() {
  try {
    return (
      sessionStorage.getItem(gameFullscreenIntentKey) === '1' ||
      localStorage.getItem(gameFullscreenIntentKey) === '1'
    );
  } catch {
    return false;
  }
}

export function setGameFullscreenIntent(enabled) {
  writeStoredIntent(sessionStorage, enabled);
  writeStoredIntent(localStorage, enabled);
}

export function getFullscreenElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement ||
    null
  );
}

export function getFallbackFullscreen() {
  return document.documentElement.classList.contains(fallbackClass);
}

export function setFallbackFullscreen(enabled) {
  document.documentElement.classList.toggle(fallbackClass, enabled);
}

export function refreshFullscreenViewport() {
  const viewport = window.visualViewport;
  const width = Math.round(
    viewport?.width || window.innerWidth || document.documentElement.clientWidth || 0,
  );
  const height = Math.round(
    viewport?.height || window.innerHeight || document.documentElement.clientHeight || 0,
  );
  const offsetLeft = Math.max(0, Math.round(viewport?.offsetLeft || 0));
  const offsetTop = Math.max(0, Math.round(viewport?.offsetTop || 0));
  const bottomInset = Math.max(
    0,
    Math.round((window.innerHeight || height) - height - offsetTop),
  );

  if (width > 0) {
    document.documentElement.style.setProperty('--app-game-width', `${width}px`);
    document.documentElement.style.setProperty('--app-viewport-width', `${width}px`);
  }

  if (height > 0) {
    document.documentElement.style.setProperty('--app-game-height', `${height}px`);
    document.documentElement.style.setProperty('--app-viewport-height', `${height}px`);
  }

  document.documentElement.style.setProperty('--app-viewport-left', `${offsetLeft}px`);
  document.documentElement.style.setProperty('--app-viewport-top', `${offsetTop}px`);
  document.documentElement.style.setProperty('--app-visual-bottom-inset', `${bottomInset}px`);
}

export function clearFullscreenViewport() {
  document.documentElement.style.removeProperty('--app-game-width');
  document.documentElement.style.removeProperty('--app-game-height');
  document.documentElement.style.removeProperty('--app-viewport-width');
  document.documentElement.style.removeProperty('--app-viewport-height');
  document.documentElement.style.removeProperty('--app-viewport-left');
  document.documentElement.style.removeProperty('--app-viewport-top');
  document.documentElement.style.removeProperty('--app-visual-bottom-inset');
}

async function enterNativeFullscreen() {
  const element = document.documentElement;

  if (element.requestFullscreen) {
    await element.requestFullscreen({ navigationUI: 'hide' });
    return;
  }

  if (element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen();
    return;
  }

  if (element.msRequestFullscreen) {
    element.msRequestFullscreen();
    return;
  }

  window.scrollTo({ top: 1, behavior: 'smooth' });
}

async function exitNativeFullscreen() {
  if (document.exitFullscreen) {
    await document.exitFullscreen();
    return;
  }

  if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
    return;
  }

  if (document.msExitFullscreen) {
    document.msExitFullscreen();
  }
}

export async function enterAppFullscreen({ persistGame = false } = {}) {
  if (persistGame) {
    setGameFullscreenIntent(true);
  }

  setFallbackFullscreen(true);
  refreshFullscreenViewport();

  try {
    await enterNativeFullscreen();
  } catch {
    setFallbackFullscreen(true);
  }
}

export async function lockGameFullscreen() {
  await enterAppFullscreen({ persistGame: true });
}

export async function exitAppFullscreen({ clearGameIntent = false } = {}) {
  if (clearGameIntent) {
    setGameFullscreenIntent(false);
  }

  try {
    if (getFullscreenElement()) {
      await exitNativeFullscreen();
    }
  } catch {
    // Some mobile browsers report fullscreen exits inconsistently.
  }

  setFallbackFullscreen(false);
  clearFullscreenViewport();
}

export async function unlockGameFullscreen() {
  await exitAppFullscreen({ clearGameIntent: true });
}
