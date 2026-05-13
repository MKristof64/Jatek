import { Play } from 'lucide-react';
import Header from '../components/Header.jsx';
import ModeCard from '../components/ModeCard.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';
import { modes } from '../data/modes.js';

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

  return (
    <>
      <Header title="Játékmód" onBack={onBack} compact />
      <section className="mode-select-screen flex min-h-0 flex-1 flex-col gap-3">
        <div className="mode-list mobile-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pb-1 pr-1">
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

        <div className="mode-start-panel shrink-0">
          <PrimaryButton className="mode-start-button" icon={Play} disabled={!canStart} onClick={onStartGame}>
            Kezdés
          </PrimaryButton>
        </div>
      </section>
    </>
  );
}
