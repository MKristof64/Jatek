import { Gamepad2, Wine } from 'lucide-react';
import Header from '../components/Header.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';
import { gameOptions } from '../data/games.js';

export default function GameSelectPage({ onOpenGame, onBack }) {
  return (
    <>
      <Header title="Játék választása" onBack={onBack} compact />
      <section className="mobile-scroll min-h-0 flex-1 space-y-4 overflow-y-auto pb-2 pr-1">
        {gameOptions.map((game) => {
          const Icon = game.id === 'drinking' ? Wine : Gamepad2;

          return (
            <article
              key={game.id}
              className="overflow-hidden rounded-3xl border border-white/15 bg-slate-950/35 p-5 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${game.accent} text-slate-950`}>
                  <Icon aria-hidden="true" className="h-7 w-7" />
                </span>
                <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${game.available ? 'border-lime-200/20 bg-lime-300/10 text-lime-100' : 'border-white/15 bg-white/8 text-white/65'}`}>
                  {game.available ? 'Elérhető' : 'Hamarosan'}
                </span>
              </div>
              <h2 className="font-display mt-4 text-2xl font-black text-white">
                {game.name}
              </h2>
              <p className="mt-1 text-sm leading-6 text-white/65">
                {game.description}
              </p>
              <PrimaryButton
                className="mt-5"
                variant={game.available ? 'primary' : 'secondary'}
                disabled={!game.available}
                onClick={() => onOpenGame(game.id)}
                aria-label={game.available ? `${game.name} megnyitása` : `${game.name} még nem elérhető`}
              >
                {game.available ? 'Megnyitás' : 'Még nem elérhető'}
              </PrimaryButton>
            </article>
          );
        })}
      </section>
    </>
  );
}
