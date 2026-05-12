import { ChevronLeft, Settings } from 'lucide-react';

export default function Header({
  title,
  eyebrow,
  onBack,
  onSettings,
  compact = false,
}) {
  return (
    <header className="mb-5 flex items-center gap-3 pt-1">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/12 text-white ring-1 ring-white/15 transition hover:bg-white/18"
          aria-label="Vissza"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-100/75">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={[
            'truncate font-black tracking-normal text-white',
            compact ? 'text-2xl' : 'text-3xl',
          ].join(' ')}
        >
          {title}
        </h1>
      </div>
      {onSettings ? (
        <button
          type="button"
          onClick={onSettings}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/12 text-white ring-1 ring-white/15 transition hover:bg-white/18"
          aria-label="Beállítások"
        >
          <Settings className="h-5 w-5" />
        </button>
      ) : null}
    </header>
  );
}
