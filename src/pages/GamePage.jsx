import { Crown, Shuffle } from 'lucide-react';
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
  canControlGame = true,
  canControlTimer = true,
  isHost = false,
  canFinishGame = isHost,
  onNext,
  onToggleTimer,
  onFinishGame,
}) {
  const hasSideAction = Boolean(canFinishGame);
  const screenClassName = [
    'game-screen flex min-h-0 flex-1 flex-col gap-3',
    hasSideAction ? 'game-screen--has-side-action' : 'game-screen--no-side-action',
  ].join(' ');
  const nextAction = canControlGame ? (
    <PrimaryButton
      variant="warning"
      icon={Shuffle}
      className="next-pulse game-card-next-button"
      onClick={onNext}
    >
      Következő
    </PrimaryButton>
  ) : null;

  return (
    <section className={screenClassName}>
      <div className="game-main mobile-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pb-1 pr-1">
        <GameCard
          key={card?.id ?? cardText}
          playerName={currentPlayer}
          participants={participants}
          mode={mode}
          card={card}
          text={cardText}
          currentTeam={currentTeam}
          timerState={timerState}
          canControlTimer={canControlTimer}
          onToggleTimer={onToggleTimer}
          actionSlot={nextAction}
        />
      </div>

      {canFinishGame ? (
        <div className="game-action-panel game-action-panel--finisher shrink-0 space-y-2">
          <div className="game-action-row game-action-row--single grid grid-cols-1 gap-2">
            <PrimaryButton variant="ghost" icon={Crown} onClick={onFinishGame}>
              Befejezés
            </PrimaryButton>
          </div>
        </div>
      ) : null}
    </section>
  );
}
