import { Plus } from 'lucide-react';
import { useRef } from 'react';

export default function PlayerInput({ value, onChange, onAdd }) {
  const inputRef = useRef(null);
  const trimmedValue = value.trim();
  const canAdd = trimmedValue.length > 0;

  const addName = (candidate) => {
    const playerName = candidate.trim();
    if (!playerName) return;
    onAdd(playerName);
  };

  const submitPlayer = (event) => {
    event.preventDefault();
    addName(value);
  };

  const handleAddClick = () => {
    if (canAdd) {
      addName(value);
      return;
    }

    inputRef.current?.focus();
    const promptedName = window.prompt('Játékos neve');
    if (promptedName) {
      addName(promptedName);
    }
  };

  return (
    <form className="relative z-20 flex items-center gap-3" onSubmit={submitPlayer}>
      <label className="sr-only" htmlFor="player-name">
        Játékos neve
      </label>
      <input
        ref={inputRef}
        type="text"
        id="player-name"
        name="player-name"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Játékos neve"
        maxLength={24}
        autoComplete="off"
        inputMode="text"
        enterKeyHint="done"
        className="party-field pointer-events-auto h-14 min-w-0 flex-1 rounded-2xl px-4 text-base font-bold outline-none shadow-card transition"
      />
      <button
        type="button"
        onClick={handleAddClick}
        className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 via-orange-400 to-pink-500 text-slate-950 shadow-glow transition hover:brightness-110 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
        aria-label="Játékos hozzáadása"
      >
        <Plus className="h-7 w-7" />
      </button>
    </form>
  );
}
