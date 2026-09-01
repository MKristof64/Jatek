import { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { fetchLatestAppRelease } from './appRelease.js';

const NativeAppUpdater = registerPlugin('AppUpdater');

const initialState = {
  status: 'idle',
  release: null,
  progress: 0,
  message: '',
};

const errorMessages = {
  DOWNLOAD_FAILED: 'A letöltés megszakadt. Ellenőrizd az internetkapcsolatot, majd próbáld újra.',
  HASH_MISMATCH:
    'A letöltött fájl ellenőrzése sikertelen volt. A telepítés biztonsági okból leállt.',
  INVALID_APK: 'A letöltött telepítő érvénytelen.',
  PACKAGE_MISMATCH: 'A telepítő nem ehhez az alkalmazáshoz tartozik.',
  VERSION_MISMATCH: 'A letöltött telepítő verziója nem egyezik a kiadással.',
  SIGNATURE_MISMATCH: 'A telepítő kiadói aláírása nem egyezik az alkalmazáséval.',
  VERSION_NOT_NEWER: 'A letöltött kiadás nem újabb a telepített változatnál.',
  EXPORT_FAILED: 'A frissítés nem menthető a rendszer Letöltések mappájába.',
  DOWNLOADS_UNAVAILABLE: 'Az Android Letöltések felülete nem nyitható meg ezen a készüléken.',
  UPDATE_IN_PROGRESS: 'A frissítés letöltése már folyamatban van.',
};

function getErrorMessage(error) {
  return errorMessages[error?.code] || error?.message || 'A frissítés nem indult el. Próbáld újra.';
}

export default function useNativeAppUpdater() {
  const isNative = Capacitor.isNativePlatform();
  const [state, setState] = useState(initialState);
  const stateRef = useRef(initialState);
  const installInProgressRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const installUpdate = useCallback(async () => {
    const release = stateRef.current.release;
    if (!isNative || !release || installInProgressRef.current) return;

    installInProgressRef.current = true;
    setState((current) => ({
      ...current,
      status: 'preparing',
      progress: 0,
      message: 'A biztonságos frissítés előkészítése…',
    }));

    try {
      const result = await NativeAppUpdater.downloadAndPrepare({
        url: release.url,
        sha256: release.sha256,
        version: release.version,
      });

      setState((current) => ({
        ...current,
        status: result?.status === 'downloadsOpened' ? 'downloads-opened' : 'ready',
        progress: 100,
        message: 'A frissítés ellenőrizve. A Letöltésekben koppints az APK-ra a telepítéshez.',
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        status: 'error',
        message: getErrorMessage(error),
      }));
    } finally {
      installInProgressRef.current = false;
    }
  }, [isNative]);

  useEffect(() => {
    if (!isNative) return undefined;

    let disposed = false;
    let progressHandle;
    let appStateHandle;
    let resumeTimer = 0;
    let checkTimer = 0;

    const checkForUpdate = async () => {
      setState((current) => ({ ...current, status: 'checking', message: '' }));

      try {
        const appInfo = await CapacitorApp.getInfo();
        const release = await fetchLatestAppRelease(appInfo.version);
        if (disposed) return;

        setState(
          release
            ? {
                status: 'available',
                release,
                progress: 0,
                message: `Elérhető az ${release.version} verzió.`,
              }
            : initialState,
        );
      } catch {
        if (!disposed) setState(initialState);
      }
    };

    void NativeAppUpdater.addListener('downloadProgress', (progress) => {
      if (disposed) return;
      const percent = Number.isFinite(progress?.percent)
        ? Math.max(0, Math.min(100, Math.round(progress.percent)))
        : 0;
      setState((current) => ({
        ...current,
        status: 'downloading',
        progress: percent,
        message: percent > 0 ? `Frissítés letöltése: ${percent}%` : 'Frissítés letöltése…',
      }));
    }).then((handle) => {
      if (disposed) void handle.remove();
      else progressHandle = handle;
    });

    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive || disposed) return;

      if (stateRef.current.status === 'downloads-opened') {
        window.clearTimeout(resumeTimer);
        resumeTimer = window.setTimeout(() => void checkForUpdate(), 500);
      }
    }).then((handle) => {
      if (disposed) void handle.remove();
      else appStateHandle = handle;
    });

    checkTimer = window.setTimeout(() => void checkForUpdate(), 700);

    return () => {
      disposed = true;
      window.clearTimeout(checkTimer);
      window.clearTimeout(resumeTimer);
      void progressHandle?.remove();
      void appStateHandle?.remove();
    };
  }, [installUpdate, isNative]);

  return {
    appUpdate: state.release ? state : null,
    installUpdate,
  };
}
