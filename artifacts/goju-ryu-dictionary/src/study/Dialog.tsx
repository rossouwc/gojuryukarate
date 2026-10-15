import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),video[controls],[tabindex]:not([tabindex="-1"])';

/** Modal with focus trap, Escape close, inert background and focus restore to the opener. */
export function ModalShell({
  children,
  className,
  labelledBy,
  onClose,
  testId,
}: {
  children: ReactNode;
  className: string;
  labelledBy: string;
  onClose: () => void;
  testId?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = ref.current;
    (panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel)?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (!panel.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      root?.removeAttribute('inert');
      document.body.style.overflow = previousOverflow;
      if (opener && opener.isConnected) opener.focus();
    };
  }, []);

  return createPortal(
    <>
      <div className="backdrop" onClick={() => closeRef.current()} data-testid="button-close-backdrop" />
      <aside
        ref={ref}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        data-testid={testId}
      >
        {children}
      </aside>
    </>,
    document.body,
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ModalShell className="confirm-dialog" labelledBy="confirm-title" onClose={onCancel} testId="dialog-confirm">
      <h2 id="confirm-title">{title}</h2>
      <p>{body}</p>
      <div className="confirm-actions">
        <button type="button" className="study-btn" data-autofocus onClick={onCancel} data-testid="button-confirm-cancel">
          Keep going
        </button>
        <button type="button" className="study-btn danger" onClick={onConfirm} data-testid="button-confirm-accept">
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}
