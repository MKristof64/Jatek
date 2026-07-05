import { Crown, Shuffle, ThumbsDown, ThumbsUp } from 'lucide-react';
import GameCard from '../components/GameCard.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';

const feedbackCardModes = new Set(['bold', 'hardcore', 'university']);
const feedbackPlayModes = new Set(['bold', 'hardcore', 'university']);

function shouldShowFeedback({ card, mode, onFeedback }) {
  return Boolean(
    card?.id &&
      typeof onFeedback === 'function' &&
      feedbackPlayModes.has(mode?.id) &&
      feedbackCardModes.has(card.mode),
  );
}

function FeedbackActionBar({ card, feedbackState, mode, onFeedback }) {
  if (!shouldShowFeedback({ card, mode, onFeedback })) return null;

  const status = feedbackState?.cardId === card.id ? feedbackState.status : 'idle';
  const selectedVote = feedbackState?.cardId === card.id ? feedbackState.voteType : null;
  const disabled = status === 'sending' || status === 'sent';
  const feedbackMessage =
    status === 'sent'
      ? 'Köszi!'
      : status === 'sending'
        ? 'Küldés...'
        : status === 'error'
          ? (feedbackState.message || 'Nem sikerült elküldeni.')
          : '';

  if (status === 'sent') {
    return (
      <div className="game-feedback-actions game-feedback-actions--thanks rounded-[1.25rem] bg-white/[0.08] p-2 ring-1 ring-white/10">
        <p className="game-feedback-thanks text-center text-sm font-black text-lime-100">
          {feedbackMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="game-feedback-actions rounded-[1.25rem] bg-white/[0.08] p-2 ring-1 ring-white/10">
      {feedbackMessage ? (
        <p className="game-feedback-summary mb-2 text-center text-[0.68rem] font-black uppercase tracking-[0.12em] text-white/58">
          {feedbackMessage}
        </p>
      ) : null}
      <div className="game-feedback-buttons grid grid-cols-2 gap-2">
        <PrimaryButton
          variant="success"
          icon={ThumbsUp}
          disabled={disabled}
          className={[
            'feedback-action-button',
            selectedVote === 'like' && status === 'sent'
              ? 'feedback-action-button--selected'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => onFeedback('like')}
        >
          Like
        </PrimaryButton>
        <PrimaryButton
          variant="danger"
          icon={ThumbsDown}
          disabled={disabled}
          className={[
            'feedback-action-button',
            selectedVote === 'dislike' && status === 'sent'
              ? 'feedback-action-button--selected'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => onFeedback('dislike')}
        >
          Dislike
        </PrimaryButton>
      </div>
    </div>
  );
}

export default function GamePage({
  currentPlayer,
  participants,
  mode,
  card,
  cardText,
  currentTeam,
  timerState,
  feedbackState,
  canControlGame = true,
  canControlTimer = true,
  isHost = false,
  canFinishGame = isHost,
  onNext,
  onToggleTimer,
  onFeedback,
  onFinishGame,
}) {
  const hasSideAction = Boolean(canFinishGame);
  const showFeedback = shouldShowFeedback({ card, mode, onFeedback });
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

      {showFeedback ? (
        <div className="game-feedback-dock shrink-0">
          <FeedbackActionBar
            card={card}
            feedbackState={feedbackState}
            mode={mode}
            onFeedback={onFeedback}
          />
        </div>
      ) : null}
    </section>
  );
}
