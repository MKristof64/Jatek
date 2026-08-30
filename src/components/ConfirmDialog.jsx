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
  headerAction = null,
  children = null,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const onCancelRef = useRef(onCancel);
  const hasDetails = Boolean(children);

  onCancelRef.current = onCancel;

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancelRef.current?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = Array.from(
        dialogRef.current?.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? [],
      ).filter((element) => !element.hidden);
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, []);

  return (
    <div
      className={`confirm-dialog fixed inset-0 z-50 grid place-items-center bg-slate-950/72 p-4 backdrop-blur-md${
        hasDetails ? ' confirm-dialog--expanded' : ''
      }`}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="confirm-dialog-surface w-full max-w-sm overflow-y-auto overscroll-contain rounded-[1.75rem] border border-white/12 bg-slate-950/92 p-5 text-white shadow-card"
      >
        <div
          className={`confirm-dialog-header relative mb-4 flex items-start gap-3${
            headerAction ? ' confirm-dialog-header--with-action pr-12' : ''
          }`}
        >
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-300 text-slate-950">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="text-2xl font-black leading-tight">{title}</h2>
            <p id={descriptionId} className="mt-2 text-sm font-bold leading-6 text-white/64">
              {description}
            </p>
          </div>
          {headerAction ? (
            <div className="confirm-dialog-header-action">{headerAction}</div>
          ) : null}
        </div>
        {hasDetails ? (
          <div className="confirm-dialog-details mb-4">{children}</div>
        ) : null}
        <div className="confirm-dialog-actions grid grid-cols-2 gap-2">
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
