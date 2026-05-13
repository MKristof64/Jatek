const variants = {
  primary:
    'bg-gradient-to-r from-amber-300 via-orange-400 to-pink-500 text-slate-950 shadow-glow hover:brightness-110 active:scale-[0.98]',
  success:
    'bg-gradient-to-r from-lime-300 via-emerald-300 to-cyan-300 text-slate-950 shadow-glow hover:brightness-110 active:scale-[0.98]',
  warning:
    'bg-gradient-to-r from-fuchsia-400 via-pink-500 to-rose-500 text-white shadow-glow hover:brightness-110 active:scale-[0.98]',
  secondary:
    'bg-white/12 text-white ring-1 ring-white/15 hover:bg-white/18 active:scale-[0.98]',
  danger:
    'bg-rose-500/18 text-rose-50 ring-1 ring-rose-300/30 hover:bg-rose-500/28 active:scale-[0.98]',
  ghost:
    'bg-transparent text-white/80 hover:bg-white/10 active:scale-[0.98]',
};

export default function PrimaryButton({
  children,
  variant = 'primary',
  icon: Icon,
  className = '',
  disabled = false,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={[
        'party-button inline-flex min-h-[3.35rem] w-full touch-manipulation select-none items-center justify-center gap-2.5 rounded-[1.35rem] px-4 py-3 text-center text-[1rem] font-extrabold leading-tight tracking-normal transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:pointer-events-none disabled:opacity-45',
        variants[variant],
        className,
      ].join(' ')}
      {...props}
    >
      {Icon ? (
        <Icon aria-hidden="true" className="relative z-10 h-5 w-5 shrink-0" />
      ) : null}
      <span className="relative z-10 min-w-0 max-w-full break-words">
        {children}
      </span>
    </button>
  );
}
