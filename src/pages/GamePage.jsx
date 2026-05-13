import { Home, LogOut, Shuffle, SkipForward } from 'lucide-react';
import GameCard from '../components/GameCard.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';

export default function GamePage({
  currentPlayer,
  participants,
  mode,
  card,
  cardText,
  currentTeam,
  onNext,
  onSkip,
  onExit,
  onHome,
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="mobile-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pb-1 pr-1">
        <div className="game-topic-bar flex items-center justify-between gap-3 rounded-[1.5rem] border border-white/10 bg-slate-950/60 px-4 py-3 shadow-card backdrop-blur">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-amber-100/70">
              Téma
            </p>
            <h1 className="mt-1 truncate text-xl font-black text-white">
              {mode.name} - {mode.type}
            </h1>
          </div>
          <span className="shrink-0 rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950">
            {mode.level}
          </span>
        </div>

        <GameCard
          key={card?.id ?? cardText}
          playerName={currentPlayer}
          participants={participants}
          mode={mode}
          card={card}
          text={cardText}
          currentTeam={currentTeam}
        />
      </div>

      <div className="game-action-panel shrink-0 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <PrimaryButton variant="secondary" icon={SkipForward} onClick={onSkip}>
            Kihagyás
          </PrimaryButton>
          <PrimaryButton
            variant="warning"
            icon={Shuffle}
            className="next-pulse"
            onClick={onNext}
          >
            Következő
          </PrimaryButton>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <PrimaryButton variant="danger" icon={LogOut} onClick={onExit}>
            Kilépés
          </PrimaryButton>
          <PrimaryButton variant="ghost" icon={Home} onClick={onHome}>
            Főoldal
          </PrimaryButton>
        </div>
      </div>
    </section>
  );
}
