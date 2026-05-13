import { Pause, Play, Sparkles, UserRound, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';

function formatTimer(seconds) {
  return `00:${seconds.toString().padStart(2, '0')}`;
}

function TimerControl({ durationSeconds, resetKey }) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setRemaining(durationSeconds);
    setRunning(false);
  }, [durationSeconds, resetKey]);

  useEffect(() => {
    if (!running) return undefined;

    const intervalId = window.setInterval(() => {
      setRemaining((currentRemaining) => {
        if (currentRemaining <= 1) {
          setRunning(false);
          return 0;
        }

        return currentRemaining - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [running]);

  const toggleTimer = () => {
    if (running) {
      setRunning(false);
      return;
    }

    if (remaining === 0) {
      setRemaining(durationSeconds);
    }
    setRunning(true);
  };

  const Icon = running ? Pause : Play;

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
        onClick={toggleTimer}
        className="party-mini-button inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 py-2 text-sm font-black text-slate-950 transition active:scale-[0.98]"
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
  return 'question-copy--dense';
}

export default function GameCard({
  playerName,
  participants = [],
  mode,
  card,
  text,
  currentTeam,
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
        <TimerControl durationSeconds={durationSeconds} resetKey={card?.id} />
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
      </div>
    </section>
  );
}
