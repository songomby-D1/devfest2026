import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import styles from './ExhibitionPage.module.css';

interface SheetProps {
  readonly label: string;
  /** `right` slides in from the edge; `center` is a modal stage. */
  readonly side: 'right' | 'center';
  readonly onClose: () => void;
  readonly children: ReactNode;
}

/** A modal panel on the native <dialog>: focus trap, Escape and backdrop for free. */
export function Sheet({ label, side, onClose, children }: SheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) return undefined;
    if (!element.open) element.showModal();
    const onCancel = (event: Event): void => {
      event.preventDefault();
      onClose();
    };
    // A click on the backdrop lands on the dialog element itself; Escape is the keyboard path.
    const onBackdrop = (event: MouseEvent): void => {
      if (event.target === element) onClose();
    };
    element.addEventListener('cancel', onCancel);
    element.addEventListener('click', onBackdrop);
    return () => {
      element.removeEventListener('cancel', onCancel);
      element.removeEventListener('click', onBackdrop);
      if (element.open) element.close();
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialog}
      className={styles.sheet}
      data-side={side}
      aria-label={label}
    >
      <div className={styles.sheetBody}>
        <button
          type="button"
          className={styles.sheetClose}
          onClick={onClose}
          aria-label="Fermer"
        >
          <CloseIcon />
        </button>
        {children}
      </div>
    </dialog>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M3 3l12 12M15 3L3 15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
