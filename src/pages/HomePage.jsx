import { Play, Sparkles, UserPlus, Wand2 } from 'lucide-react';
import Header from '../components/Header.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';

export default function HomePage({
  playersCount,
  customCount,
  onStart,
  onPlayers,
  onCustomCards,
  onSettings,
}) {
  return (
    <>
      <Header title="Én még sosem..." onSettings={onSettings} />
      <section className="home-screen flex min-h-0 flex-1 flex-col justify-between gap-4">
        <div className="home-hero-card overflow-hidden rounded-[1.75rem] border border-white/12 bg-white/[0.13] shadow-card backdrop-blur">
          <div className="home-hero-content bg-gradient-to-br from-pink-500/35 via-orange-400/24 to-lime-300/18 p-4 min-[390px]:p-5">
            <div className="home-logo-tile mb-5 grid h-16 w-16 place-items-center rounded-[1.35rem] bg-gradient-to-br from-amber-300 via-orange-400 to-pink-500 text-slate-950 shadow-glow animate-floaty min-[390px]:mb-7 min-[390px]:h-20 min-[390px]:w-20 min-[390px]:rounded-[1.75rem]">
              <Sparkles className="h-8 w-8 min-[390px]:h-10 min-[390px]:w-10" />
            </div>
            <div className="home-hero-copy">
              <p className="home-hero-kicker text-sm font-black uppercase tracking-[0.22em] text-amber-100/78">
                Módalapú party pakli
              </p>
              <h2 className="home-hero-title mt-2 text-4xl font-black leading-none tracking-normal text-white min-[390px]:text-5xl">
                Húzz, nevess, válts módot.
              </h2>
              <p className="home-hero-description mt-3 text-base leading-6 text-white/70 min-[390px]:mt-4 min-[390px]:leading-7">
                Gyors körök, saját pakli, céljátékosok és csapatmód egy telefonra
                szabott kártyás felületen.
              </p>
            </div>
          </div>

          <div className="home-stat-grid grid grid-cols-2 gap-3 p-4 min-[390px]:p-5">
            <div className="home-stat-card rounded-3xl bg-slate-950/38 p-3 ring-1 ring-white/10 min-[390px]:p-4">
              <p className="home-stat-number text-3xl font-black text-amber-200">{playersCount}</p>
              <p className="home-stat-label text-sm font-bold text-white/55">játékos</p>
            </div>
            <div className="home-stat-card rounded-3xl bg-slate-950/38 p-3 ring-1 ring-white/10 min-[390px]:p-4">
              <p className="home-stat-number text-3xl font-black text-lime-200">{customCount}</p>
              <p className="home-stat-label text-sm font-bold text-white/55">saját kártya</p>
            </div>
          </div>
        </div>

        <div className="home-action-panel shrink-0 space-y-3">
          <PrimaryButton icon={Play} onClick={onStart}>
            Játék indítása
          </PrimaryButton>
          <div className="home-secondary-actions grid grid-cols-2 gap-3">
            <PrimaryButton
              variant="secondary"
              icon={UserPlus}
              className="min-h-14 px-2"
              onClick={onPlayers}
            >
              <span className="sr-only">Játékosok</span>
            </PrimaryButton>
            <PrimaryButton
              variant="secondary"
              icon={Wand2}
              className="min-h-14 px-2"
              onClick={onCustomCards}
            >
              <span className="sr-only">Saját kártyák</span>
            </PrimaryButton>
          </div>
        </div>
      </section>
    </>
  );
}
