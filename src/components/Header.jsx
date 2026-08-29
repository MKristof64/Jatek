import { ChevronLeft, Settings } from 'lucide-react';

export default function Header({
  title,
  eyebrow,
  onBack,
  onSettings,
  compact = false,
}) {
  return (
    <header className="app-header-motion mb-4 flex shrink-0 items-center gap-3 pt-1">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="icon-button-dynamic grid h-12 w-12 shrink-0 touch-manipulation place-items-center rounded-[1.35rem] bg-white/12 text-white ring-1 ring-white/15 transition hover:bg-white/18 active:scale-[0.98]"
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
            'font-display truncate font-black tracking-normal text-white',
            compact ? 'text-2xl' : 'text-2xl min-[390px]:text-3xl',
          ].join(' ')}
        >
          {title}
        </h1>
      </div>
      {onSettings ? (
        <button
          type="button"
          onClick={onSettings}
          className="icon-button-dynamic grid h-12 w-12 shrink-0 touch-manipulation place-items-center rounded-[1.35rem] bg-white/12 text-white ring-1 ring-white/15 transition hover:bg-white/18 active:scale-[0.98]"
          aria-label="Beállítások"
        >
          <Settings className="h-5 w-5" />
        </button>
      ) : null}
    </header>
  );
}
