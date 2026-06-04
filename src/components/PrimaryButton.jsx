const variants = {
  primary:
    'bg-gradient-to-r from-yellow-300 via-orange-500 to-rose-500 text-slate-950 shadow-glow hover:brightness-110 active:scale-[0.98]',
  success:
    'bg-gradient-to-r from-lime-300 via-yellow-300 to-orange-400 text-slate-950 shadow-glow hover:brightness-110 active:scale-[0.98]',
  warning:
    'bg-gradient-to-r from-fuchsia-400 via-rose-500 to-red-500 text-white shadow-glow hover:brightness-110 active:scale-[0.98]',
  secondary:
    'bg-rose-950/26 text-white ring-1 ring-rose-100/18 hover:bg-rose-900/34 active:scale-[0.98]',
  danger:
    'bg-red-500/22 text-rose-50 ring-1 ring-red-200/34 hover:bg-red-500/32 active:scale-[0.98]',
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
