import type { ReactNode, RefObject } from 'react';
import { useEffect, useRef } from 'react';
import { cx } from '../../lib/cx';
import { gsap, useGSAP } from '../../lib/motion/gsap';
import styles from './GalleryDialog.module.css';

export type GalleryDialogVariant = 'side' | 'sheet' | 'fullscreen';

export interface GalleryDialogProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  variant: GalleryDialogVariant;
  reducedMotion: boolean;
  /** Receives focus back when the dialog closes, for example the wall label. */
  returnFocusRef?: RefObject<HTMLElement | null> | undefined;
  children: (close: () => void) => ReactNode;
}

/**
 * Modal layer built on <dialog>: the browser traps focus, Escape always closes
 * it and a click outside the panel closes it too. Focus returns to the control
 * that opened it. Reduced motion uses short fades.
 */
export function GalleryDialog({
  open,
  onClose,
  labelledBy,
  variant,
  reducedMotion,
  returnFocusRef,
  children,
}: GalleryDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const { contextSafe } = useGSAP({ scope: dialogRef });

  const finishClose = (): void => {
    const dialog = dialogRef.current;
    closingRef.current = false;
    if (dialog?.open === true) {
      dialog.close();
    }
    onCloseRef.current();
    returnFocusRef?.current?.focus();
  };

  const requestClose = contextSafe(() => {
    const panel = panelRef.current;
    if (closingRef.current || panel === null) {
      return;
    }
    closingRef.current = true;
    if (reducedMotion) {
      gsap.to(panel, {
        autoAlpha: 0,
        duration: 0.2,
        ease: 'none',
        onComplete: finishClose,
      });
      return;
    }
    const exitVars =
      variant === 'side'
        ? { xPercent: 100 }
        : variant === 'sheet'
          ? { yPercent: 100 }
          : { autoAlpha: 0 };
    gsap.to(panel, {
      ...exitVars,
      duration: 0.35,
      ease: 'power3.in',
      onComplete: finishClose,
    });
  });

  const playOpen = contextSafe(() => {
    const panel = panelRef.current;
    if (panel === null) {
      return;
    }
    if (reducedMotion) {
      gsap.fromTo(
        panel,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.2, ease: 'none' },
      );
      return;
    }
    const fromVars =
      variant === 'side'
        ? { xPercent: 100, autoAlpha: 1 }
        : variant === 'sheet'
          ? { yPercent: 100, autoAlpha: 1 }
          : { autoAlpha: 0 };
    gsap.fromTo(panel, fromVars, {
      xPercent: 0,
      yPercent: 0,
      autoAlpha: 1,
      duration: 0.5,
      ease: 'power3.out',
    });
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (open && !dialog.open) {
      closingRef.current = false;
      dialog.showModal();
      playOpen();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, playOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    const handleCancel = (event: Event): void => {
      event.preventDefault();
      requestClose();
    };
    const handleClick = (event: MouseEvent): void => {
      if (event.target === dialog) {
        requestClose();
      }
    };
    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('click', handleClick);
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleClick);
    };
  }, [requestClose]);

  return (
    <dialog
      ref={dialogRef}
      className={cx(styles.dialog, styles[variant])}
      aria-labelledby={labelledBy}
    >
      <div ref={panelRef} className={styles.panel}>
        {open && children(requestClose)}
      </div>
    </dialog>
  );
}
