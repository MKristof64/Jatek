import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';

const fallbackClass = 'app-fullscreen-fallback';
const gameFullscreenIntentKey = 'enmegsosem.gameFullscreenIntent';
let stableViewport = {
  width: 0,
  height: 0,
  orientation: '',
};

function getOrientationKey(width, height) {
  return window.screen?.orientation?.type || (width >= height ? 'landscape' : 'portrait');
}

function isEditingText() {
  const element = document.activeElement;
  if (!element) return false;

  const tagName = element.tagName?.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    element.isContentEditable
  );
}

function updateStableViewport(width, height) {
  const orientation = getOrientationKey(width, height);
  const orientationChanged = stableViewport.orientation && stableViewport.orientation !== orientation;
  const widthChanged = stableViewport.width && Math.abs(stableViewport.width - width) > 48;

  if (!stableViewport.width || !stableViewport.height || orientationChanged || widthChanged) {
    stableViewport = { width, height, orientation };
    return stableViewport;
  }

  stableViewport = {
    width: Math.max(stableViewport.width, width),
    height: Math.max(stableViewport.height, height),
    orientation,
  };

  return stableViewport;
}

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

export async function lockPortraitOrientation() {
  if (Capacitor.isNativePlatform()) {
    try {
      await ScreenOrientation.lock({ orientation: 'portrait-primary' });
      return true;
    } catch {
      try {
        await ScreenOrientation.lock({ orientation: 'portrait' });
        return true;
      } catch {
        return false;
      }
    }
  }

  const orientation = window.screen?.orientation;
  if (typeof orientation?.lock !== 'function') return false;

  try {
    await orientation.lock('portrait-primary');
    return true;
  } catch {
    try {
      await orientation.lock('portrait');
      return true;
    } catch {
      return false;
    }
  }
}

export async function lockLandscapeOrientation() {
  if (Capacitor.isNativePlatform()) {
    try {
      await ScreenOrientation.lock({ orientation: 'landscape-primary' });
      return true;
    } catch {
      try {
        await ScreenOrientation.lock({ orientation: 'landscape' });
        return true;
      } catch {
        return false;
      }
    }
  }

  const orientation = window.screen?.orientation;
  if (typeof orientation?.lock !== 'function') return false;

  try {
    await orientation.lock('landscape-primary');
    return true;
  } catch {
    try {
      await orientation.lock('landscape');
      return true;
    } catch {
      return false;
    }
  }
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
  const visualWidth = Math.round(viewport?.width || 0);
  const visualHeight = Math.round(viewport?.height || 0);
  const layoutWidth = Math.round(window.innerWidth || document.documentElement.clientWidth || visualWidth || 0);
  const layoutHeight = Math.round(window.innerHeight || document.documentElement.clientHeight || visualHeight || 0);
  const focusedInput = isEditingText();
  const measuredWidth = Math.max(layoutWidth, visualWidth);
  const measuredHeight = focusedInput
    ? Math.max(1, visualHeight || layoutHeight)
    : Math.max(layoutHeight, visualHeight);
  const stable = focusedInput
    ? {
        width: measuredWidth,
        height: measuredHeight,
        orientation: getOrientationKey(measuredWidth, measuredHeight),
      }
    : updateStableViewport(measuredWidth, measuredHeight);
  const offsetLeft = focusedInput ? Math.max(0, Math.round(viewport?.offsetLeft || 0)) : 0;
  const offsetTop = focusedInput ? Math.max(0, Math.round(viewport?.offsetTop || 0)) : 0;
  const bottomInset = focusedInput
    ? Math.max(0, Math.round((layoutHeight || measuredHeight) - measuredHeight - offsetTop))
    : 0;

  if (stable.width > 0) {
    document.documentElement.style.setProperty('--app-game-width', `${stable.width}px`);
    document.documentElement.style.setProperty('--app-viewport-width', `${stable.width}px`);
  }

  if (stable.height > 0) {
    document.documentElement.style.setProperty('--app-game-height', `${stable.height}px`);
    document.documentElement.style.setProperty('--app-viewport-height', `${stable.height}px`);
  }

  document.documentElement.style.setProperty('--app-viewport-left', `${offsetLeft}px`);
  document.documentElement.style.setProperty('--app-viewport-top', `${offsetTop}px`);
  document.documentElement.style.setProperty('--app-visual-bottom-inset', `${bottomInset}px`);
}

export function clearFullscreenViewport() {
  stableViewport = {
    width: 0,
    height: 0,
    orientation: '',
  };
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

export async function enterAppFullscreen({ persistGame = false, requestNative = true } = {}) {
  if (persistGame) {
    setGameFullscreenIntent(true);
  }

  setFallbackFullscreen(true);
  refreshFullscreenViewport();

  if (!requestNative) return;

  try {
    await enterNativeFullscreen();
  } catch {
    setFallbackFullscreen(true);
  }
}

export async function lockGameFullscreen({ requestNative = true } = {}) {
  await enterAppFullscreen({ persistGame: true, requestNative });
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
