import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { ErrorNotice } from '../../components/error-notice/ErrorNotice';
import { FormField } from '../../components/form-field/FormField';
import forms from '../../components/forms/forms.module.css';
import { api } from '../../lib/api';
import type { ClaimTarget, ItemDetail, ReviewOutcome } from '../../lib/api';
import {
  CLAIM_STATUS_LABEL,
  CLAIM_TARGET_HINT,
  CLAIM_TARGET_LABEL,
} from '../../lib/content/labels';
import { handleAuthError } from '../../lib/session/session';
import { evidenceList, REVIEW_LIMITS, validateClaimForm } from './review-form';
import type { ClaimFormErrors, ClaimFormValues } from './review-form';

export interface ClaimReviewFormProps {
  item: ItemDetail;
  target: ClaimTarget;
  onReviewed: (item: ItemDetail) => void;
}

const OUTCOMES: readonly ReviewOutcome[] = ['verified', 'uncertain'];

/** Records the outcome of one claim target, independently of the other. */
export function ClaimReviewForm({
  item,
  target,
  onReviewed,
}: ClaimReviewFormProps) {
  const id = useId();
  const [values, setValues] = useState<ClaimFormValues>({
    outcome: '',
    rationale: '',
    evidence: '',
  });
  const [errors, setErrors] = useState<ClaimFormErrors>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const label = CLAIM_TARGET_LABEL[target];

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const next = validateClaimForm(values);
    setErrors(next);
    setSaved(false);
    if (Object.keys(next).length > 0 || values.outcome === '') return;
    setSubmitting(true);
    setFailure(null);
    api
      .reviewItem(item.id, {
        target,
        outcome: values.outcome,
        rationale: values.rationale.trim(),
        evidence: evidenceList(values.evidence),
      })
      .then((updated) => {
        setSaved(true);
        setValues({ outcome: '', rationale: '', evidence: '' });
        onReviewed(updated);
      })
      .catch((error: unknown) => {
        handleAuthError(error);
        setFailure(error);
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
        Affirmations sur : {label.toLowerCase()}
      </h3>
      <p className={forms.smallPrint}>
        Porte sur : {CLAIM_TARGET_HINT[target]}. Statut actuel :{' '}
        <strong>{CLAIM_STATUS_LABEL[item.claims[target]]}</strong>.
      </p>
      <fieldset
        className={forms.radioGroup}
        aria-describedby={
          errors.outcome === undefined ? undefined : `${id}-outcome-error`
        }
      >
        <legend className="visually-hidden">Résultat pour : {label}</legend>
        {OUTCOMES.map((outcome) => (
          <label key={outcome} className={forms.checkbox}>
            <input
              type="radio"
              name={`${id}-outcome`}
              value={outcome}
              checked={values.outcome === outcome}
              onChange={() => {
                setValues((previous) => ({ ...previous, outcome }));
              }}
            />
            <span>{outcome === 'verified' ? 'Vérifié' : 'Incertain'}</span>
          </label>
        ))}
      </fieldset>
      {errors.outcome !== undefined && (
        <p id={`${id}-outcome-error`} className={forms.fieldError}>
          {errors.outcome}
        </p>
      )}
      <FormField
        label="Justification"
        required
        error={errors.rationale}
        hint={`Visible du contributeur et, une fois publiée, du public. ${String(REVIEW_LIMITS.rationale)} caractères au maximum.`}
      >
        {(control) => (
          <textarea
            {...control}
            value={values.rationale}
            maxLength={REVIEW_LIMITS.rationale}
            onChange={(event) => {
              setValues((previous) => ({
                ...previous,
                rationale: event.target.value,
              }));
            }}
          />
        )}
      </FormField>
      <FormField
        label="Sources consultées"
        error={errors.evidence}
        hint={`Une source par ligne (archive, notice, référence) ; ${String(REVIEW_LIMITS.evidenceItems)} au plus.`}
      >
        {(control) => (
          <textarea
            {...control}
            value={values.evidence}
            onChange={(event) => {
              setValues((previous) => ({
                ...previous,
                evidence: event.target.value,
              }));
            }}
          />
        )}
      </FormField>
      {failure !== null && <ErrorNotice error={failure} />}
      {saved && (
        <p className={forms.success} role="status">
          Relecture « {label} » enregistrée.
        </p>
      )}
      <div className={forms.actions}>
        <button type="submit" className={forms.primary} disabled={submitting}>
          {submitting
            ? 'Enregistrement…'
            : `Enregistrer la relecture : ${label.toLowerCase()}`}
        </button>
      </div>
    </form>
  );
}
