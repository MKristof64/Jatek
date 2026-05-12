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
      <section className="flex flex-1 flex-col justify-between gap-6">
        <div className="overflow-hidden rounded-[2rem] border border-white/12 bg-white/[0.13] shadow-card backdrop-blur">
          <div className="bg-gradient-to-br from-pink-500/35 via-orange-400/24 to-lime-300/18 p-5">
            <div className="mb-7 grid h-20 w-20 place-items-center rounded-[1.75rem] bg-gradient-to-br from-amber-300 via-orange-400 to-pink-500 text-slate-950 shadow-glow animate-floaty">
              <Sparkles className="h-10 w-10" />
            </div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-amber-100/78">
              Módalapú party pakli
            </p>
            <h2 className="mt-2 text-5xl font-black leading-none tracking-normal text-white">
              Húzz, nevess, válts módot.
            </h2>
            <p className="mt-4 text-base leading-7 text-white/70">
              Gyors körök, saját pakli, céljátékosok és csapatmód egy telefonra
              szabott kártyás felületen.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 p-5">
            <div className="rounded-3xl bg-slate-950/38 p-4 ring-1 ring-white/10">
              <p className="text-3xl font-black text-amber-200">{playersCount}</p>
              <p className="text-sm font-bold text-white/55">játékos</p>
            </div>
            <div className="rounded-3xl bg-slate-950/38 p-4 ring-1 ring-white/10">
              <p className="text-3xl font-black text-lime-200">{customCount}</p>
              <p className="text-sm font-bold text-white/55">saját kártya</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <PrimaryButton icon={Play} onClick={onStart}>
            Játék indítása
          </PrimaryButton>
          <div className="grid grid-cols-2 gap-3">
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
