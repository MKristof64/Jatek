import { Trash2, UsersRound } from 'lucide-react';
import { useState } from 'react';
import Header from '../components/Header.jsx';
import PlayerInput from '../components/PlayerInput.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';

export default function PlayersPage({ players, onAdd, onRemove, onNext, onBack }) {
  const [name, setName] = useState('');
  const hasEnoughPlayers = players.length >= 2;

  const handleAdd = (trimmedName) => {
    onAdd(trimmedName);
    setName('');
  };

  return (
    <>
      <Header title="Játékosok" onBack={onBack} compact />
      <section className="flex flex-1 flex-col gap-5">
        <PlayerInput value={name} onChange={setName} onAdd={handleAdd} />

        <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
          <div className="mb-3 flex items-center gap-3 text-white">
            <UsersRound className="h-5 w-5 text-amber-200" />
            <p className="font-black">Legalább 2 játékos kell</p>
          </div>
          <p className="text-sm leading-6 text-white/62">
            Most {players.length} játékos van felvéve. A sorrend alapján haladnak
            majd a körök.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
          {players.length === 0 ? (
            <p className="rounded-3xl bg-white/8 p-5 text-center text-sm text-white/58">
              Adj hozzá játékosokat a kezdéshez.
            </p>
          ) : (
            players.map((player, index) => (
              <div
                key={player.id}
                className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/10 p-3"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-pink-500 text-lg font-black text-slate-950">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-lg font-black text-white">
                  {player.name}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(player.id)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-400/14 text-rose-100 ring-1 ring-rose-200/20"
                  aria-label={`${player.name} törlése`}
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))
          )}
        </div>

        <PrimaryButton disabled={!hasEnoughPlayers} onClick={onNext}>
          Tovább a módokhoz
        </PrimaryButton>
      </section>
    </>
  );
}
