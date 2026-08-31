import {
  ChevronDown,
  Clock3,
  History,
  Play,
  Save,
  Trash2,
  UsersRound,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';
import { getModeById } from '../data/modes.js';

const dateFormatter = new Intl.DateTimeFormat('hu-HU', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatSavedAt(timestamp) {
  try {
    return dateFormatter.format(new Date(timestamp));
  } catch {
    return 'Korábbi mentés';
  }
}

export default function SavedGamesPage({
  savedGames,
  savingEnabled,
  onResume,
  onDelete,
  onBack,
}) {
  return (
    <>
      <Header title="Korábbi játékok" onBack={onBack} compact />
      <section className="flex min-h-0 flex-1 flex-col gap-3">
        {!savingEnabled ? (
          <div className="flex shrink-0 items-start gap-3 rounded-3xl border border-amber-200/18 bg-amber-300/10 p-4 text-amber-50">
            <Save className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
            <div className="min-w-0">
              <p className="font-black">A Játék mentése ki van kapcsolva</p>
              <p className="mt-1 text-sm leading-5 text-amber-50/68">
                A meglévő mentések megnyithatók, de a további haladás csak a
                beállítás bekapcsolása után frissül bennük.
              </p>
            </div>
          </div>
        ) : null}

        <div className="mobile-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pb-2 pr-1">
          {savedGames.length === 0 ? (
            <div className="grid min-h-52 place-items-center rounded-3xl border border-white/10 bg-white/8 p-6 text-center">
              <div>
                <History className="mx-auto h-9 w-9 text-amber-200" />
                <p className="mt-3 text-lg font-black text-white">Még nincs mentett játék</p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/60">
                  Kapcsold be a Játék mentése beállítást, majd indíts el egy helyi
                  játékot. A haladás minden kártyaváltásnál automatikusan frissül.
                </p>
              </div>
            </div>
          ) : (
            savedGames.map((savedGame) => {
              const mode = getModeById(savedGame.modeId);
              const playedCount = savedGame.playedCards.length;

              return (
                <article
                  key={savedGame.id}
                  className="saved-game-card overflow-hidden rounded-3xl border border-white/12 bg-slate-950/38 shadow-card"
                >
                  <div className="p-4 min-[390px]:p-5">
                    <div className="flex items-start gap-3">
                      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${mode.accent} text-slate-950`}>
                        <History className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h2 className="text-xl font-black text-white">{mode.name}</h2>
                          <span className="rounded-full bg-white/10 px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.1em] text-amber-100/80">
                            {playedCount} lap
                          </span>
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-white/55">
                          <Clock3 className="h-4 w-4" />
                          {formatSavedAt(savedGame.updatedAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDelete(savedGame.id)}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-500/14 text-rose-100 ring-1 ring-rose-200/20 transition hover:bg-rose-500/24 active:scale-[0.97]"
                        aria-label={`${mode.name} mentés törlése`}
                        title="Mentés törlése"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="mt-4 flex items-start gap-2 text-white/72">
                      <UsersRound className="mt-0.5 h-4 w-4 shrink-0 text-lime-200" />
                      <p className="min-w-0 text-sm font-bold leading-5">
                        {savedGame.players.map((player) => player.name).join(', ')}
                      </p>
                    </div>

                    <PrimaryButton
                      className="mt-4"
                      icon={Play}
                      onClick={() => onResume(savedGame.id)}
                    >
                      Játék folytatása
                    </PrimaryButton>
                  </div>

                  <details className="saved-game-history border-t border-white/10 bg-white/[0.035]">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-black text-white/74 transition hover:bg-white/5 min-[390px]:px-5">
                      <History className="h-4 w-4 text-amber-200" />
                      <span className="flex-1">Kijátszott kártyák ({playedCount})</span>
                      <ChevronDown className="saved-game-history-chevron h-4 w-4 transition" />
                    </summary>
                    <ol className="max-h-72 space-y-0 overflow-y-auto border-t border-white/8 px-4 py-2 min-[390px]:px-5">
                      {playedCount > 0 ? (
                        savedGame.playedCards.map((card, index) => (
                          <li
                            key={`${card.sequence}-${card.id}-${index}`}
                            className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-white/8 py-3 last:border-b-0"
                          >
                            <span className="grid h-7 min-w-7 place-items-center rounded-xl bg-white/10 px-1.5 text-xs font-black text-amber-100">
                              {card.sequence}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-black text-amber-100/72">{card.title}</p>
                              <p className="mt-0.5 text-sm font-bold leading-5 text-white/78">
                                {card.text}
                              </p>
                            </div>
                          </li>
                        ))
                      ) : (
                        <li className="py-4 text-center text-sm text-white/52">
                          Ehhez a mentéshez még nincs kijátszott kártya.
                        </li>
                      )}
                    </ol>
                  </details>
                </article>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
