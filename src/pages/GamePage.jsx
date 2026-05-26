import { Crown, LogOut, Shuffle, ThumbsDown, ThumbsUp } from 'lucide-react';
import FullscreenButton from '../components/FullscreenButton.jsx';
import GameCard from '../components/GameCard.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';

function formatSuccessPercent(value) {
  if (!Number.isFinite(value)) return null;
  return `${Math.round(value)}%`;
}

function FeedbackActionBar({ card, feedbackState, feedbackStats, mode, onFeedback }) {
  const showFeedback = mode?.id === 'bold' && card?.id && typeof onFeedback === 'function';
  if (!showFeedback) return null;

  const status = feedbackState?.cardId === card.id ? feedbackState.status : 'idle';
  const selectedVote = feedbackState?.cardId === card.id ? feedbackState.voteType : null;
  const disabled = status === 'sending' || status === 'sent';
  const successPercent = formatSuccessPercent(feedbackStats?.successPercent);
  const likes = feedbackStats?.likes ?? 0;
  const dislikes = feedbackStats?.dislikes ?? 0;
  const totalVotes = feedbackStats?.totalVotes ?? 0;
  const summary =
    totalVotes > 0
      ? `Sikeresség: ${successPercent} · ${likes}/${dislikes}`
      : 'Még nincs elég visszajelzés.';
  const sentPrefix = status === 'sent' ? `${feedbackState.message} ` : '';

  return (
    <div className="game-feedback-actions rounded-[1.25rem] bg-white/[0.08] p-2 ring-1 ring-white/10">
      <p className="game-feedback-summary mb-2 text-center text-[0.68rem] font-black uppercase tracking-[0.12em] text-white/58">
        {sentPrefix}
        {summary}
      </p>
      <div className="game-feedback-buttons grid grid-cols-2 gap-2">
        <PrimaryButton
          variant="success"
          icon={ThumbsUp}
          disabled={disabled}
          className={[
            'feedback-action-button',
            selectedVote === 'like' && status === 'sent' ? 'feedback-action-button--selected' : '',
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
            selectedVote === 'dislike' && status === 'sent' ? 'feedback-action-button--selected' : '',
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
  feedbackStats,
  canControlGame = true,
  canControlTimer = true,
  isHost = false,
  canFinishGame = isHost,
  onNext,
  onToggleTimer,
  onFeedback,
  onExit,
  onFinishGame,
}) {
  const panelClassName = [
    'game-action-panel shrink-0 space-y-2',
    canControlGame ? 'game-action-panel--controller' : 'game-action-panel--viewer',
    canFinishGame ? 'game-action-panel--finisher' : '',
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
          canControlTimer={canControlTimer}
          onToggleTimer={onToggleTimer}
        />
        <FeedbackActionBar
          card={card}
          feedbackState={feedbackState}
          feedbackStats={feedbackStats}
          mode={mode}
          onFeedback={onFeedback}
        />
      </div>

      <div className={panelClassName}>
        {canControlGame ? (
          <div className="game-action-row grid grid-cols-1 gap-2">
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
        {canFinishGame ? (
          <div className="game-action-row grid grid-cols-1 gap-2">
            <PrimaryButton variant="ghost" icon={Crown} onClick={onFinishGame}>
              Befejezés
            </PrimaryButton>
          </div>
        ) : (
          <div className="game-action-row grid grid-cols-1 gap-2">
            <PrimaryButton variant="danger" icon={LogOut} onClick={onExit}>
              Kilépés
            </PrimaryButton>
          </div>
        )}
      </div>
    </section>
  );
}
