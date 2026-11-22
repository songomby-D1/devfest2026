import { useId } from 'react';
import type { ReactNode } from 'react';
import styles from './FormField.module.css';

export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string | undefined;
  'aria-invalid'?: true | undefined;
  'aria-required'?: true | undefined;
  className: string | undefined;
}

export interface FormFieldProps {
  label: string;
  required?: boolean | undefined;
  hint?: ReactNode;
  /** Shown next to the field and announced with it. */
  error?: string | undefined;
  children: (control: FieldControlProps) => ReactNode;
}

/** A labelled form control with its hint and its error, linked for assistive technology. */
export function FormField({
  label,
  required = false,
  hint,
  error,
  children,
}: FormFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint === undefined ? null : hintId, error === undefined ? null : errorId]
      .filter((value) => value !== null)
      .join(' ') || undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required ? (
          <span className={styles.required}> (obligatoire)</span>
        ) : (
          <span className={styles.optional}> (facultatif)</span>
        )}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error === undefined ? undefined : true,
        'aria-required': required ? true : undefined,
        className: styles.control,
      })}
      {hint !== undefined && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
