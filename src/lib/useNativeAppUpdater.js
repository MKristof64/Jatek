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
  HASH_MISMATCH: 'A letöltött fájl ellenőrzése sikertelen volt. A telepítés biztonsági okból leállt.',
  INVALID_APK: 'A letöltött telepítő érvénytelen.',
  PACKAGE_MISMATCH: 'A telepítő nem ehhez az alkalmazáshoz tartozik.',
  SIGNATURE_MISMATCH:
    'A telepített régi változat más aláírást használ. Egyszer töröld a régi appot, majd telepítsd az újat.',
  VERSION_NOT_NEWER: 'A letöltött kiadás nem újabb a telepített változatnál.',
  INSTALLER_UNAVAILABLE: 'Az Android telepítője nem nyitható meg ezen a készüléken.',
  UPDATE_IN_PROGRESS: 'A frissítés letöltése már folyamatban van.',
};

function getErrorMessage(error) {
  return (
    errorMessages[error?.code] ||
    error?.message ||
    'A frissítés nem indult el. Próbáld újra.'
  );
}

export default function useNativeAppUpdater() {
  const isNative = Capacitor.isNativePlatform();
  const [state, setState] = useState(initialState);
  const stateRef = useRef(initialState);
  const installInProgressRef = useRef(false);
  const permissionReturnPendingRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const installUpdate = useCallback(async () => {
    const release = stateRef.current.release;
    if (!isNative || !release || installInProgressRef.current) return;

    installInProgressRef.current = true;
    permissionReturnPendingRef.current = false;
    setState((current) => ({
      ...current,
      status: 'preparing',
      progress: 0,
      message: 'A biztonságos letöltés előkészítése…',
    }));

    try {
      const result = await NativeAppUpdater.downloadAndInstall({
        url: release.url,
        sha256: release.sha256,
        openPermissionSettings: true,
      });

      if (result?.status === 'permissionRequired') {
        permissionReturnPendingRef.current = true;
        setState((current) => ({
          ...current,
          status: 'permission-required',
          message: 'Engedélyezd az alkalmazástelepítést; visszatéréskor a frissítés folytatódik.',
        }));
        return;
      }

      setState((current) => ({
        ...current,
        status: 'installer-opened',
        progress: 100,
        message: 'A telepítő megnyílt. Hagyd jóvá az Android frissítését.',
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
        message: percent > 0 ? `Letöltés: ${percent}%` : 'Frissítés letöltése…',
      }));
    }).then((handle) => {
      if (disposed) void handle.remove();
      else progressHandle = handle;
    });

    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive || disposed) return;

      if (stateRef.current.status === 'installer-opened') {
        window.clearTimeout(resumeTimer);
        resumeTimer = window.setTimeout(() => void checkForUpdate(), 450);
        return;
      }

      if (!permissionReturnPendingRef.current) return;

      permissionReturnPendingRef.current = false;
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(async () => {
        try {
          const permission = await NativeAppUpdater.canInstallPackages();
          if (permission?.allowed) {
            await installUpdate();
          } else if (!disposed) {
            setState((current) => ({
              ...current,
              status: 'error',
              message: 'A frissítéshez engedélyezned kell az alkalmazástelepítést.',
            }));
          }
        } catch (error) {
          if (!disposed) {
            setState((current) => ({
              ...current,
              status: 'error',
              message: getErrorMessage(error),
            }));
          }
        }
      }, 450);
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
