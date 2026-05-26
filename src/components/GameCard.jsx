import {
  Bolt,
  Flame,
  Layers3,
  Pause,
  Play,
  Sparkles,
  UserRound,
  UsersRound,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';

const modeIcons = {
  Bolt,
  Flame,
  Layers3,
  Sparkles,
  UsersRound,
  Zap,
};

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

function getQuestionSizeClass(value) {
  const length = String(value ?? '').trim().length;

  if (length <= 58) return 'question-copy--short';
  if (length <= 105) return 'question-copy--medium';
  if (length <= 155) return 'question-copy--long';
  if (length <= 220) return 'question-copy--dense';
  return 'question-copy--compact';
}

export default function GameCard({
  playerName,
  participants = [],
  mode,
  card,
  text,
  currentTeam,
  timerState,
  canControlTimer = true,
  onToggleTimer,
}) {
  const cardKind = card?.kind ?? 'never';
  const cardTitle = card?.title ?? 'Én még sosem...';
  const durationSeconds = card?.durationSeconds ?? 0;
  const hasTimer = durationSeconds > 0;
  const questionSizeClass = getQuestionSizeClass(text);
  const cardClasses = [
    'question-spotlight question-spotlight--open game-card-dynamic animate-pop',
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
  const ModeIcon = modeIcons[mode?.icon] ?? Sparkles;

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
        <div
          className={[
            'spark-tile grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-slate-950 shadow-lg min-[390px]:h-14 min-[390px]:w-14',
            mode?.accent ?? 'from-amber-300 via-orange-400 to-pink-500',
          ].join(' ')}
        >
          <ModeIcon className="h-6 w-6 min-[390px]:h-7 min-[390px]:w-7" />
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

      <div className="question-stage question-stage--open relative z-10 mt-4 min-[390px]:mt-5">
        <div className={['question-copy question-copy--free game-question-copy', questionSizeClass].join(' ')}>
          <p className="question-prefix">{cardTitle}</p>
          <p className="question-sentence">{text}</p>
        </div>
      </div>
    </section>
  );
}
