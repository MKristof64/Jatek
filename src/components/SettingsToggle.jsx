export default function SettingsToggle({
  label,
  description,
  checked,
  onChange,
  icon: Icon,
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${label}: ${checked ? 'bekapcsolva' : 'kikapcsolva'}`}
      onClick={() => onChange(!checked)}
      className={[
        'flex w-full items-center gap-3 rounded-3xl border p-4 text-left shadow-card transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200',
        checked
          ? 'border-amber-200/22 bg-white/12'
          : 'border-white/10 bg-slate-950/44',
      ].join(' ')}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/12 text-amber-100">
        {Icon ? <Icon className="h-5 w-5" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-black text-white">{label}</span>
        <span className="mt-0.5 block text-sm leading-5 text-white/64">
          {description}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={[
            'relative h-8 w-14 rounded-full transition',
            checked ? 'bg-amber-300' : 'bg-white/18',
          ].join(' ')}
        >
          <span
            className={[
              'absolute top-1 h-6 w-6 rounded-full bg-white shadow transition',
              checked ? 'left-7' : 'left-1',
            ].join(' ')}
          />
        </span>
        <span className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-white/48">
          {checked ? 'Be' : 'Ki'}
        </span>
      </span>
    </button>
  );
}
