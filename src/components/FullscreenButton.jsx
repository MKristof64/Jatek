import { Maximize2, Minimize2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const fallbackClass = 'app-fullscreen-fallback';

function getFullscreenElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement ||
    null
  );
}

function getFallbackFullscreen() {
  return document.documentElement.classList.contains(fallbackClass);
}

function setFallbackFullscreen(enabled) {
  document.documentElement.classList.toggle(fallbackClass, enabled);
}

async function enterFullscreen() {
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

async function exitFullscreen() {
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

export default function FullscreenButton({ className = '' }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(Boolean(getFullscreenElement()) || getFallbackFullscreen());
    };

    syncFullscreenState();
    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('webkitfullscreenchange', syncFullscreenState);
    document.addEventListener('MSFullscreenChange', syncFullscreenState);

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState);
      document.removeEventListener('MSFullscreenChange', syncFullscreenState);
    };
  }, []);

  const toggleFullscreen = async () => {
    if (getFullscreenElement() || getFallbackFullscreen()) {
      try {
        await exitFullscreen();
      } catch {
        // Some mobile browsers report fullscreen exits inconsistently.
      }

      setFallbackFullscreen(false);
      setIsFullscreen(Boolean(getFullscreenElement()));
      return;
    }

    try {
      await enterFullscreen();
      if (!getFullscreenElement()) {
        setFallbackFullscreen(true);
      }
      setIsFullscreen(Boolean(getFullscreenElement()) || getFallbackFullscreen());
    } catch {
      setFallbackFullscreen(true);
      setIsFullscreen(true);
    }
  };

  const Icon = isFullscreen ? Minimize2 : Maximize2;
  const label = isFullscreen ? 'Kilépés teljes képernyőből' : 'Teljes képernyő';

  return (
    <button
      type="button"
      className={[
        'fullscreen-button icon-button-dynamic grid h-12 w-12 shrink-0 touch-manipulation place-items-center rounded-[1.35rem] bg-white/12 text-white ring-1 ring-white/15 transition hover:bg-white/18 active:scale-[0.98]',
        className,
      ].join(' ')}
      onClick={toggleFullscreen}
      aria-label={label}
      title={label}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
