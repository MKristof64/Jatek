import { Pause, Play, Sparkles, ThumbsDown, ThumbsUp, UserRound, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';

function formatTimer(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function getSyncedRemaining(timerState, durationSeconds) {
  const duration = Number.isFinite(durationSeconds)
    ? Math.max(0, Math.min(120, Math.floor(durationSeconds)))
    : 0;
  const baseRemaining = Number.isFinite(timerState?.remainingSeconds)
    ? Math.max(0, Math.min(duration, Math.ceil(timerState.remainingSeconds)))
    : duration;

  if (!timerState?.running) return baseRemaining;

  const updatedAt = Number.isFinite(timerState.updatedAt) ? timerState.updatedAt : Date.now();
  const elapsedSeconds = Math.max(0, (Date.now() - updatedAt) / 1000);
  return Math.max(0, Math.ceil(baseRemaining - elapsedSeconds));
}

function TimerControl({ durationSeconds, timerState, canControlTimer, onToggleTimer }) {
  const [remaining, setRemaining] = useState(() =>
    getSyncedRemaining(timerState, durationSeconds),
  );

  useEffect(() => {
    setRemaining(getSyncedRemaining(timerState, durationSeconds));
  }, [durationSeconds, timerState]);

  useEffect(() => {
    if (!timerState?.running) return undefined;

    const intervalId = window.setInterval(() => {
      setRemaining(getSyncedRemaining(timerState, durationSeconds));
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [durationSeconds, timerState]);

  const running = Boolean(timerState?.running && remaining > 0);
  const Icon = running ? Pause : Play;
  const disabled = !canControlTimer;

  return (
    <div className="timer-control relative z-10 mt-3 flex items-center justify-between gap-3 rounded-2xl bg-slate-950/54 p-3 ring-1 ring-white/10">
      <div>
        <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-white/52">
          Időzítő
        </p>
        <p className="mt-0.5 text-2xl font-black text-white">
          {formatTimer(remaining)}
        </p>
      </div>
      <button
        type="button"
        onClick={onToggleTimer}
        disabled={disabled}
        title={disabled ? 'Csak a házigazda vagy a mesélő vezérelheti.' : undefined}
        className={[
          'party-mini-button inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 py-2 text-sm font-black text-slate-950 transition active:scale-[0.98]',
          disabled ? 'cursor-not-allowed opacity-50 active:scale-100' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Icon className="h-4 w-4" />
        {running ? 'Pause' : 'Indítás'}
      </button>
    </div>
  );
}

function formatSuccessPercent(value) {
  if (!Number.isFinite(value)) return null;
  return `${Math.round(value)}%`;
}

function FeedbackControls({ card, feedbackState, feedbackStats, mode, onFeedback }) {
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
      ? `Sikeresség: ${successPercent} · ${likes} like / ${dislikes} dislike`
      : 'Még nincs elég visszajelzés.';

  return (
    <div className="card-feedback mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/[0.07] p-2.5 ring-1 ring-white/10">
      <p className="min-w-0 flex-1 text-[0.72rem] font-black uppercase tracking-[0.12em] text-white/54">
        {status === 'sent' ? `${feedbackState.message} ${summary}` : summary}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => onFeedback('like')}
          disabled={disabled}
          className={[
            'feedback-button grid h-10 w-10 place-items-center rounded-xl bg-lime-300/12 text-lime-100 ring-1 ring-lime-200/18 transition active:scale-[0.96]',
            selectedVote === 'like' && status === 'sent' ? 'feedback-button--selected' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-label="Like"
        >
          <ThumbsUp className="h-[1.125rem] w-[1.125rem]" />
        </button>
        <button
          type="button"
          onClick={() => onFeedback('dislike')}
          disabled={disabled}
          className={[
            'feedback-button grid h-10 w-10 place-items-center rounded-xl bg-rose-300/12 text-rose-100 ring-1 ring-rose-200/18 transition active:scale-[0.96]',
            selectedVote === 'dislike' && status === 'sent' ? 'feedback-button--selected' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-label="Dislike"
        >
          <ThumbsDown className="h-[1.125rem] w-[1.125rem]" />
        </button>
      </div>
    </div>
  );
}

function getQuestionSizeClass(value) {
  const length = String(value ?? '').trim().length;

  if (length <= 58) return 'question-copy--short';
  if (length <= 105) return 'question-copy--medium';
  if (length <= 155) return 'question-copy--long';
  return 'question-copy--dense';
}

export default function GameCard({
  playerName,
  participants = [],
  mode,
  card,
  text,
  currentTeam,
  timerState,
  feedbackState,
  feedbackStats,
  canControlTimer = true,
  onToggleTimer,
  onFeedback,
}) {
  const cardKind = card?.kind ?? 'never';
  const cardTitle = card?.title ?? 'Én még sosem...';
  const durationSeconds = card?.durationSeconds ?? 0;
  const hasTimer = durationSeconds > 0;
  const questionSizeClass = getQuestionSizeClass(text);
  const cardClasses = [
    'question-spotlight game-card-dynamic animate-pop',
    hasTimer ? 'game-card-dynamic--timed' : '',
    currentTeam ? 'game-card-dynamic--team' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const participantNames = participants.map((participant) => participant.name);
  const isRoundtable = cardKind === 'roundtable';
  const isDuel = cardKind === 'duel';
  const participantLabel = isRoundtable
    ? 'Közös kör'
    : isDuel
      ? 'Párharc'
      : 'Most ő jön';
  const participantText = isRoundtable
    ? 'Mindenki'
    : isDuel
      ? participantNames.join(' vs ')
      : (participantNames[0] ?? playerName);
  const ParticipantIcon = isRoundtable || isDuel ? UsersRound : UserRound;

  return (
    <section className={cardClasses}>
      <div className="game-card-top relative z-10 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-amber-100/75">
            {participantLabel}
          </p>
          <div className="player-chip mt-2 inline-flex max-w-full items-center gap-2 rounded-full bg-white/10 px-3 py-2 ring-1 ring-white/10">
            <ParticipantIcon className="h-4 w-4 shrink-0 text-lime-200" />
            <h2 className="truncate text-lg font-black text-white min-[390px]:text-xl">
              {participantText}
            </h2>
          </div>
        </div>
        <div className="spark-tile grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 via-orange-400 to-pink-500 text-slate-950 shadow-lg min-[390px]:h-14 min-[390px]:w-14">
          <Sparkles className="h-6 w-6 min-[390px]:h-7 min-[390px]:w-7" />
        </div>
      </div>

      {currentTeam ? (
        <p className="team-ribbon relative z-10 mt-4 rounded-2xl bg-lime-300/10 px-3 py-2 text-sm font-black text-lime-50 ring-1 ring-lime-200/15">
          {currentTeam.name} közös feladata
        </p>
      ) : null}

      {hasTimer ? (
        <TimerControl
          durationSeconds={durationSeconds}
          timerState={timerState}
          canControlTimer={canControlTimer}
          onToggleTimer={onToggleTimer}
        />
      ) : null}

      <div className="question-stage relative z-10 mt-4 min-[390px]:mt-5">
        <div className="question-meta mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-100/70">
            Kérdés
          </p>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white/70 ring-1 ring-white/10">
            {mode.type}
          </span>
        </div>
        <div className={['question-copy game-question-copy', questionSizeClass].join(' ')}>
          <p className="question-prefix">{cardTitle}</p>
          <p className="question-sentence">{text}</p>
        </div>
        <FeedbackControls
          card={card}
          feedbackState={feedbackState}
          feedbackStats={feedbackStats}
          mode={mode}
          onFeedback={onFeedback}
        />
      </div>
    </section>
  );
}
