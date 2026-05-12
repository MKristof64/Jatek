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
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const submitPlayer = (event) => {
    event.preventDefault();
    if (!canAdd) {
      inputRef.current?.focus();
      return;
    }
    addName(value);
  };

  const handleAddClick = (event) => {
    if (!canAdd) {
      event.preventDefault();
      inputRef.current?.focus();
      return;
    }
    addName(value);
  };

  return (
    <form
      className="relative z-30 grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-3 min-[390px]:grid-cols-[minmax(0,1fr)_3.75rem]"
      onSubmit={submitPlayer}
    >
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
        autoCorrect="off"
        autoCapitalize="words"
        spellCheck="false"
        inputMode="text"
        enterKeyHint="done"
        className="party-field relative z-30 h-14 w-full min-w-0 rounded-2xl px-4 text-[16px] font-bold outline-none shadow-card transition"
      />
      <button
        type="button"
        onClick={handleAddClick}
        className="relative z-30 grid h-14 w-full touch-manipulation place-items-center rounded-2xl bg-gradient-to-br from-amber-300 via-orange-400 to-pink-500 text-slate-950 shadow-glow transition hover:brightness-110 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
        aria-label="Játékos hozzáadása"
      >
        <Plus className="h-7 w-7" />
      </button>
    </form>
  );
}
