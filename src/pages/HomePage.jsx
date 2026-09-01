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

function getUpdateLabel(appUpdate) {
  if (appUpdate.status === 'downloading') {
    return appUpdate.progress > 0 ? `Letöltés ${appUpdate.progress}%` : 'Letöltés…';
  }
  if (appUpdate.status === 'preparing') return 'Előkészítés…';
  if (appUpdate.status === 'downloads-opened') return 'Letöltve';
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
    ? ['preparing', 'downloading'].includes(appUpdate.status)
    : false;

  return (
    <>
      <div className="home-top-controls flex shrink-0 items-center justify-end gap-2">
        {appUpdate ? (
          <button
            type="button"
            onClick={onInstallUpdate}
            disabled={updateBusy}
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
      <section className="home-screen home-screen--compact-top home-screen--motion flex min-h-0 flex-1 flex-col justify-between gap-4">
        <div className="home-hero-card home-hero-card--motion overflow-hidden rounded-[1.75rem] border border-rose-100/14 bg-rose-950/[0.18] shadow-card backdrop-blur">
          <div className="home-hero-content bg-gradient-to-br from-rose-500/42 via-orange-500/28 to-cyan-300/14 p-4 min-[390px]:p-5">
            <div className="home-logo-tile mb-5 grid h-16 w-16 place-items-center rounded-[1.35rem] bg-gradient-to-br from-yellow-300 via-orange-500 to-rose-500 text-slate-950 shadow-glow animate-floaty min-[390px]:mb-7 min-[390px]:h-20 min-[390px]:w-20 min-[390px]:rounded-[1.75rem]">
              <Sparkles className="h-8 w-8 min-[390px]:h-10 min-[390px]:w-10" />
            </div>
            <div className="home-hero-copy">
              <p className="home-hero-kicker text-[1.75rem] font-black tracking-normal text-amber-100/85">
                Én még sosem...
              </p>
              <h2 className="home-hero-title mt-2 text-4xl font-black leading-none tracking-normal text-white min-[390px]:text-5xl">
                Az ivós játék.
              </h2>
            </div>
          </div>

          <div className="home-stat-grid grid grid-cols-1 gap-3 p-4 min-[390px]:p-5">
            <div className="home-stat-card rounded-3xl bg-slate-950/38 p-3 ring-1 ring-white/10 min-[390px]:p-4">
              <p className="home-stat-number text-3xl font-black text-amber-200">{playersCount}</p>
              <p className="home-stat-label text-sm font-bold text-white/55">játékos</p>
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
