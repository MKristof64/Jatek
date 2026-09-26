import {
  Download,
  History,
  Play,
  RefreshCw,
  Settings,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import PrimaryButton from '../components/PrimaryButton.jsx';
import PlayerGroupIcon from '../components/PlayerGroupIcon.jsx';
import { isNativeUpdateBusy } from '../lib/nativeUpdateState.js';

function getUpdateLabel(appUpdate) {
  if (appUpdate.status === 'downloading') {
    return appUpdate.progress > 0 ? `Letöltés ${appUpdate.progress}%` : 'Letöltés…';
  }
  if (appUpdate.status === 'preparing') return 'Előkészítés…';
  if (appUpdate.status === 'permission-required') return 'Engedélyezés…';
  if (appUpdate.status === 'confirming') return 'Jóváhagyás…';
  if (appUpdate.status === 'installing') return 'Telepítés…';
  if (appUpdate.status === 'installed') return 'Frissítve';
  if (appUpdate.status === 'error') return 'Újrapróbálom';
  return `Frissítés ${appUpdate.release.version}`;
}

export default function HomePage({
  playersCount,
  onStart,
  onPlayers,
  onSavedGames,
  onSettings,
  appDownloadUrl,
  appUpdate,
  onInstallUpdate,
  savedGamesCount,
}) {
  const updateBusy = appUpdate
    ? isNativeUpdateBusy(appUpdate.status)
    : false;

  return (
    <>
      <div className="home-top-controls flex shrink-0 items-center justify-end gap-2">
        {appUpdate ? (
          <button
            type="button"
            onClick={onInstallUpdate}
            disabled={updateBusy || appUpdate.status === 'installed'}
            className="app-update-control icon-button-dynamic inline-flex h-11 min-w-0 max-w-[12.5rem] shrink items-center justify-center gap-2 rounded-[1.1rem] bg-amber-300 px-3 font-extrabold text-slate-950 ring-1 ring-amber-100/70 transition hover:bg-amber-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-80"
            aria-label={`${getUpdateLabel(appUpdate)}. ${appUpdate.message}`}
            title={appUpdate.message}
            aria-live="polite"
            style={{ '--app-update-progress': `${appUpdate.progress}%` }}
          >
            <RefreshCw
              className={`relative z-10 h-4 w-4 shrink-0 ${updateBusy ? 'animate-spin' : ''}`}
            />
            <span className="relative z-10 truncate text-sm">{getUpdateLabel(appUpdate)}</span>
          </button>
        ) : null}
        {appDownloadUrl ? (
          <a
            href={appDownloadUrl}
            download="Az-ivos-jatek.apk"
            className="icon-button-dynamic grid h-11 w-11 shrink-0 touch-manipulation place-items-center rounded-[1.1rem] bg-white/12 text-white ring-1 ring-white/15 transition hover:bg-white/18 active:scale-[0.98]"
            aria-label="Android alkalmazás letöltése"
            title="Android alkalmazás letöltése"
          >
            <Download className="h-5 w-5" />
          </a>
        ) : null}
        <button
          type="button"
          onClick={onSettings}
          className="icon-button-dynamic grid h-11 w-11 shrink-0 touch-manipulation place-items-center rounded-[1.1rem] bg-white/12 text-white ring-1 ring-white/15 transition hover:bg-white/18 active:scale-[0.98]"
          aria-label="Beállítások"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
      {appUpdate?.status === 'error' ? (
        <p role="alert" className="app-update-notice shrink-0 rounded-xl bg-rose-950/80 px-3 py-2 text-sm text-white">
          {appUpdate.message}
        </p>
      ) : null}
      <section className="home-screen home-screen--compact-top home-screen--motion flex min-h-0 flex-1 flex-col justify-between gap-4">
        <div className="home-hero-card home-hero-card--motion">
          <div className="home-hero-content">
            <div className="home-logo-tile grid place-items-center bg-gradient-to-br from-yellow-300 via-orange-500 to-rose-500 text-slate-950">
              <Sparkles aria-hidden="true" />
            </div>
            <div className="home-hero-copy">
              <p className="home-hero-kicker">
                Én még sosem...
              </p>
              <h1 className="home-hero-title">Az ivós játék</h1>
              <p className="home-player-summary">
                <PlayerGroupIcon count={playersCount} />
                <span className="home-player-count">
                  <span className="home-stat-number">{playersCount}</span>
                  <span className="home-stat-label">játékos</span>
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="home-action-panel home-action-panel--motion shrink-0 space-y-3">
          <PrimaryButton icon={Play} onClick={onStart}>
            Játék indítása
          </PrimaryButton>
          <div className="home-secondary-actions grid grid-cols-1 gap-3">
            <PrimaryButton
              variant="secondary"
              icon={UserPlus}
              className="min-h-14 px-2"
              onClick={onPlayers}
            >
              Játékosok
            </PrimaryButton>
            <PrimaryButton
              variant="secondary"
              icon={History}
              className="min-h-14 px-2"
              onClick={onSavedGames}
            >
              {savedGamesCount > 0
                ? `Korábbi játékok (${savedGamesCount})`
                : 'Korábbi játékok'}
            </PrimaryButton>
          </div>
        </div>
      </section>
    </>
  );
}
