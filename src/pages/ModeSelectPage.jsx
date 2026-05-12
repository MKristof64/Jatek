import { Play } from 'lucide-react';
import Header from '../components/Header.jsx';
import ModeCard from '../components/ModeCard.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';
import { getModeById, modes } from '../data/modes.js';

export default function ModeSelectPage({
  selectedMode,
  playersCount,
  customCount,
  onSelectMode,
  onStartGame,
  onBack,
}) {
  const hasEnoughPlayers = playersCount >= 2;
  const customSelected = selectedMode === 'custom';
  const customReady = !customSelected || customCount > 0;
  const canStart = hasEnoughPlayers && customReady;
  const activeMode = getModeById(selectedMode);

  return (
    <>
      <Header title="Játékmód" onBack={onBack} compact />
      <section className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="shrink-0 rounded-[1.75rem] border border-amber-200/20 bg-slate-950/54 p-3 shadow-card min-[390px]:p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-100/70">
            Aktív mód
          </p>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-black text-white">
                {activeMode.name}
              </h2>
              <p className="mt-1 text-sm font-bold text-lime-100/76">
                {activeMode.level} · {activeMode.rhythm}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white/70">
              {activeMode.type}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-white/68">
            {activeMode.description}
          </p>
        </div>

        <div className="mobile-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pb-1 pr-1">
          {modes.map((mode) => (
            <ModeCard
              key={mode.id}
              mode={mode}
              selected={mode.id === selectedMode}
              onClick={() => onSelectMode(mode.id)}
            />
          ))}

          {!hasEnoughPlayers ? (
            <p className="rounded-3xl bg-amber-300/12 p-4 text-sm leading-6 text-amber-50 ring-1 ring-amber-200/20">
              A kezdéshez legalább 2 játékos szükséges.
            </p>
          ) : null}

          {customSelected && !customReady ? (
            <p className="rounded-3xl bg-amber-300/12 p-4 text-sm leading-6 text-amber-50 ring-1 ring-amber-200/20">
              A saját paklihoz hozz létre legalább egy saját feladatot.
            </p>
          ) : null}
        </div>

        <PrimaryButton className="shrink-0" icon={Play} disabled={!canStart} onClick={onStartGame}>
          Kezdés
        </PrimaryButton>
      </section>
    </>
  );
}
