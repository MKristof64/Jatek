import { Crown, LogOut, Shuffle, SkipForward } from 'lucide-react';
import FullscreenButton from '../components/FullscreenButton.jsx';
import GameCard from '../components/GameCard.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';

export default function GamePage({
  currentPlayer,
  participants,
  mode,
  card,
  cardText,
  currentTeam,
  timerState,
  feedbackState,
  feedbackStats,
  canControlGame = true,
  canControlTimer = true,
  isHost = false,
  onNext,
  onSkip,
  onToggleTimer,
  onFeedback,
  onExit,
  onFinishGame,
}) {
  const panelClassName = [
    'game-action-panel shrink-0 space-y-2',
    canControlGame ? 'game-action-panel--controller' : 'game-action-panel--viewer',
    isHost ? 'game-action-panel--host' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className="game-screen flex min-h-0 flex-1 flex-col gap-3">
      <div className="game-main mobile-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pb-1 pr-1">
        <div className="game-topic-bar flex items-center justify-between gap-3 rounded-[1.5rem] border border-white/10 bg-slate-950/60 px-4 py-3 shadow-card backdrop-blur">
          <FullscreenButton className="game-fullscreen-button" />
          <div className="min-w-0 flex-1">
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
          timerState={timerState}
          feedbackState={feedbackState}
          feedbackStats={feedbackStats}
          canControlTimer={canControlTimer}
          onToggleTimer={onToggleTimer}
          onFeedback={onFeedback}
        />
      </div>

      <div className={panelClassName}>
        {canControlGame ? (
          <div className="game-action-row grid grid-cols-2 gap-2">
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
        ) : null}
        <div className="game-action-row grid grid-cols-1 gap-2">
          <PrimaryButton variant="danger" icon={LogOut} onClick={onExit}>
            Kilépés
          </PrimaryButton>
        </div>
        {isHost ? (
          <div className="game-action-row grid grid-cols-1 gap-2">
            <PrimaryButton variant="ghost" icon={Crown} onClick={onFinishGame}>
              Befejezés
            </PrimaryButton>
          </div>
        ) : null}
      </div>
    </section>
  );
}
