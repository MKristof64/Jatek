import { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { fetchLatestAppRelease } from './appRelease.js';

const NativeAppUpdater = registerPlugin('AppUpdater');

const initialState = {
  status: 'idle',
  release: null,
  message: '',
};

function getErrorMessage(error) {
  if (error?.code === 'BROWSER_UNAVAILABLE') {
    return 'A frissítési oldal nem nyitható meg ezen a készüléken.';
  }
  return error?.message || 'A frissítési oldal nem nyílt meg. Próbáld újra.';
}

export default function useNativeAppUpdater() {
  const isNative = Capacitor.isNativePlatform();
  const [state, setState] = useState(initialState);
  const stateRef = useRef(initialState);
  const openingRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const openUpdate = useCallback(async () => {
    const release = stateRef.current.release;
    if (!isNative || !release || openingRef.current) return;

    openingRef.current = true;
    setState((current) => ({
      ...current,
      status: 'opening',
      message: 'A hitelesített GitHub-kiadás megnyitása…',
    }));

    try {
      await NativeAppUpdater.openReleasePage({ url: release.releaseUrl });
      setState((current) => ({
        ...current,
        status: 'release-opened',
        message: 'A hivatalos kiadási oldal megnyílt a böngészőben.',
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        status: 'error',
        message: getErrorMessage(error),
      }));
    } finally {
      openingRef.current = false;
    }
  }, [isNative]);

  useEffect(() => {
    if (!isNative) return undefined;

    let disposed = false;
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
                message: `Elérhető az ${release.version} verzió.`,
              }
            : initialState,
        );
      } catch {
        if (!disposed) setState(initialState);
      }
    };

    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive || disposed || stateRef.current.status !== 'release-opened') return;

      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => void checkForUpdate(), 600);
    }).then((handle) => {
      if (disposed) void handle.remove();
      else appStateHandle = handle;
    });

    checkTimer = window.setTimeout(() => void checkForUpdate(), 700);

    return () => {
      disposed = true;
      window.clearTimeout(checkTimer);
      window.clearTimeout(resumeTimer);
      void appStateHandle?.remove();
    };
  }, [isNative]);

  return {
    appUpdate: state.release ? state : null,
    openUpdate,
  };
}
