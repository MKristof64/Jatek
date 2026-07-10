import {
  Beer,
  Bolt,
  Flame,
  Layers3,
  Sparkles,
  UsersRound,
  Zap,
} from 'lucide-react';

const icons = {
  Beer,
  Bolt,
  Flame,
  Layers3,
  Sparkles,
  UsersRound,
  Zap,
};

export default function ModeCard({ mode, selected, disabled, onClick }) {
  const Icon = icons[mode.icon] ?? Sparkles;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={[
        'mode-card-dynamic group w-full touch-manipulation rounded-3xl border p-3 text-left shadow-card transition min-[390px]:p-4',
        selected
          ? 'border-amber-200/80 bg-white/20'
          : 'border-white/10 bg-white/10 hover:bg-white/15',
        disabled ? 'opacity-45' : 'active:scale-[0.99]',
      ].join(' ')}
    >
      <span className="flex items-center gap-4">
        <span
          className={[
            'mode-card-icon grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-slate-950 shadow-lg min-[390px]:h-14 min-[390px]:w-14',
            mode.accent,
          ].join(' ')}
        >
          <Icon className="h-7 w-7" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="mode-card-title text-base font-black text-white min-[390px]:text-lg">{mode.name}</span>
            <span className="mode-card-level rounded-full bg-slate-950/34 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-amber-100">
              {mode.level}
            </span>
          </span>
          <span className="mode-card-type mt-1 block text-sm font-bold text-white/72">
            {mode.type}
          </span>
        </span>
      </span>
      <span className="mode-card-description mt-3 block text-sm leading-5 text-white/68">
        {mode.description}
      </span>
      <span className="mode-card-style mt-3 block rounded-2xl bg-slate-950/28 px-3 py-2 text-xs font-bold leading-5 text-lime-50/78 ring-1 ring-white/10">
        {mode.playStyle}
      </span>
    </button>
  );
}
