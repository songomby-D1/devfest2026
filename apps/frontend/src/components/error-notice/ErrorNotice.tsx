import { describeError } from '../../lib/api';
import { cx } from '../../lib/cx';
import styles from './ErrorNotice.module.css';

export interface ErrorNoticeProps {
  error: unknown;
  /** Shows a retry button when given. */
  onRetry?: (() => void) | undefined;
  title?: string | undefined;
  className?: string | undefined;
}

/** A public error: its safe message, a retry action and the request ID for support. */
export function ErrorNotice({
  error,
  onRetry,
  title,
  className,
}: ErrorNoticeProps) {
  const { message, requestId } = describeError(error);
  return (
    <div className={cx(styles.notice, className)} role="alert">
      {title !== undefined && <p className={styles.title}>{title}</p>}
      <p className={styles.message}>{message}</p>
      {requestId !== '' && (
        <p className={styles.reference}>
          Référence pour le support : <code>{requestId}</code>
        </p>
      )}
      {onRetry !== undefined && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  );
}
