import { useId, useState } from 'react';
import type { SubmitEvent } from 'react';
import { ErrorNotice } from '../../components/error-notice/ErrorNotice';
import { FormField } from '../../components/form-field/FormField';
import forms from '../../components/forms/forms.module.css';
import { api } from '../../lib/api';
import type { DecisionKind, ItemDetail } from '../../lib/api';
import { invalidateCollection } from '../../lib/collection/published-items';
import { PUBLICATION_LABEL, SUBMISSION_LABEL } from '../../lib/content/labels';
import { handleAuthError } from '../../lib/session/session';
import { REVIEW_LIMITS, validateDecision } from './review-form';

export interface DecisionFormProps {
  item: ItemDetail;
  onDecided: (item: ItemDetail) => void;
}

const DECISIONS: readonly {
  value: DecisionKind;
  label: string;
  hint: string;
}[] = [
  {
    value: 'publish',
    label: 'Publier',
    hint: 'Possible quand l’objet et la description sont relus et les droits confirmés.',
  },
  {
    value: 'return',
    label: 'Renvoyer pour modification',
    hint: 'Le contributeur corrige puis le dépôt revient en relecture.',
  },
  {
    value: 'reject',
    label: 'Refuser',
    hint: 'Clôt le dépôt définitivement.',
  },
];

/** Publish, return or reject, with a note; the service enforces the D18 rules. */
export function DecisionForm({ item, onDecided }: DecisionFormProps) {
  const id = useId();
  const [decision, setDecision] = useState<DecisionKind | ''>('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [done, setDone] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const problem = validateDecision(decision, note);
    setError(problem);
    setDone(null);
    if (problem !== null || decision === '') return;
    setSubmitting(true);
    setFailure(null);
    api
      .decideItem(item.id, { decision, note: note.trim() })
      .then((updated) => {
        if (updated.publicationStatus === 'published') invalidateCollection();
        setDone(
          `Décision enregistrée. Publication : ${PUBLICATION_LABEL[updated.publicationStatus]} ; dépôt : ${SUBMISSION_LABEL[updated.submissionStatus]}.`,
        );
        setNote('');
        setDecision('');
        onDecided(updated);
      })
      .catch((caught: unknown) => {
        handleAuthError(caught);
        setFailure(caught);
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <form
      className={forms.fieldset}
      onSubmit={submit}
      noValidate
      aria-labelledby={`${id}-title`}
    >
      <h3 id={`${id}-title`} className={forms.legend}>
        Décision sur le dépôt
      </h3>
      <fieldset
        className={forms.radioGroup}
        aria-describedby={error === null ? undefined : `${id}-error`}
      >
        <legend className="visually-hidden">Décision</legend>
        {DECISIONS.map((option) => (
          <label key={option.value} className={forms.checkbox}>
            <input
              type="radio"
              name={`${id}-decision`}
              value={option.value}
              checked={decision === option.value}
              onChange={() => {
                setDecision(option.value);
              }}
            />
            <span>
              {option.label}
              <br />
              <span className={forms.smallPrint}>{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <FormField
        label="Note au contributeur"
        required={decision === 'return' || decision === 'reject'}
        hint={`Obligatoire pour renvoyer ou refuser. ${String(REVIEW_LIMITS.note)} caractères au maximum.`}
      >
        {(control) => (
          <textarea
            {...control}
            value={note}
            maxLength={REVIEW_LIMITS.note}
            onChange={(event) => {
              setNote(event.target.value);
            }}
          />
        )}
      </FormField>
      {error !== null && (
        <p id={`${id}-error`} className={forms.fieldError}>
          {error}
        </p>
      )}
      {failure !== null && <ErrorNotice error={failure} />}
      {done !== null && (
        <p className={forms.success} role="status">
          {done}
        </p>
      )}
      <div className={forms.actions}>
        <button type="submit" className={forms.primary} disabled={submitting}>
          {submitting ? 'Enregistrement…' : 'Enregistrer la décision'}
        </button>
      </div>
    </form>
  );
}
