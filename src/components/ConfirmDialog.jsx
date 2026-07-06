import { AlertTriangle } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import PrimaryButton from './PrimaryButton.jsx';

export default function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Megerősítés',
  cancelLabel = 'Mégse',
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="confirm-dialog fixed inset-0 z-50 grid place-items-center bg-slate-950/72 p-4 backdrop-blur-md">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-sm rounded-[1.75rem] border border-white/12 bg-slate-950/92 p-5 text-white shadow-card"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-300 text-slate-950">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="text-2xl font-black leading-tight">{title}</h2>
            <p id={descriptionId} className="mt-2 text-sm font-bold leading-6 text-white/64">
              {description}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <PrimaryButton ref={cancelButtonRef} variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </PrimaryButton>
          <PrimaryButton variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </PrimaryButton>
        </div>
      </section>
    </div>
  );
}
