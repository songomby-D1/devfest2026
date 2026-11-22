import { useRef, useState } from 'react';
import type { SubmitEvent } from 'react';
import { ErrorNotice } from '../../components/error-notice/ErrorNotice';
import { FormField } from '../../components/form-field/FormField';
import forms from '../../components/forms/forms.module.css';
import { PageShell } from '../../components/page-shell/PageShell';
import { RequireUser } from '../../components/require-user/RequireUser';
import { api, ApiError } from '../../lib/api';
import { ITEM_KINDS, KIND_LABEL } from '../../lib/content/labels';
import { Link } from '../../lib/router/Link';
import { navigate } from '../../lib/router/router';
import { handleAuthError } from '../../lib/session/session';
import {
  EMPTY_ITEM_FORM,
  ITEM_LIMITS,
  serverFieldErrors,
  toCreateRequest,
  validateItemForm,
} from './item-form';
import type { ItemFormErrors, ItemFormValues } from './item-form';

type TextField = Exclude<keyof ItemFormValues, 'kind' | 'rightsConfirmed'>;

function SubmissionForm() {
  const [values, setValues] = useState<ItemFormValues>(EMPTY_ITEM_FORM);
  const [errors, setErrors] = useState<ItemFormErrors>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const text = (
    field: TextField,
    label: string,
    options: { required?: boolean; multiline?: boolean; hint?: string } = {},
  ) => (
    <FormField
      label={label}
      required={options.required}
      error={errors[field]}
      hint={
        options.hint ?? `${String(ITEM_LIMITS[field])} caractères au maximum.`
      }
    >
      {(control) =>
        options.multiline === true ? (
          <textarea
            {...control}
            name={field}
            value={values[field]}
            maxLength={ITEM_LIMITS[field]}
            onChange={(event) => {
              setValues((previous) => ({
                ...previous,
                [field]: event.target.value,
              }));
            }}
          />
        ) : (
          <input
            {...control}
            type="text"
            name={field}
            value={values[field]}
            maxLength={ITEM_LIMITS[field]}
            onChange={(event) => {
              setValues((previous) => ({
                ...previous,
                [field]: event.target.value,
              }));
            }}
          />
        )
      }
    </FormField>
  );

  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const next = validateItemForm(values);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      // Focus the first invalid field so its error is read out.
      requestAnimationFrame(() => {
        formRef.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus();
      });
      return;
    }
    setSubmitting(true);
    setFailure(null);
    api
      .createItem(toCreateRequest(values))
      .then((item) => {
        navigate(`/contribuer/${encodeURIComponent(item.id)}`);
      })
      .catch((error: unknown) => {
        handleAuthError(error);
        if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') {
          setErrors(serverFieldErrors(error.details));
        }
        setFailure(error);
        setSubmitting(false);
      });
  };

  return (
    <form ref={formRef} className={forms.form} onSubmit={submit} noValidate>
      {failure !== null && (
        <ErrorNotice error={failure} title="Le dépôt n’a pas été enregistré." />
      )}
      <fieldset className={forms.fieldset}>
        <legend className={forms.legend}>L’œuvre</legend>
        {text('title', 'Titre', { required: true })}
        <FormField label="Type d’œuvre" required error={errors.kind}>
          {(control) => (
            <select
              {...control}
              name="kind"
              value={values.kind}
              onChange={(event) => {
                setValues((previous) => ({
                  ...previous,
                  kind: event.target.value as ItemFormValues['kind'],
                }));
              }}
            >
              <option value="">Choisir…</option>
              {ITEM_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABEL[kind]}
                </option>
              ))}
            </select>
          )}
        </FormField>
        {text('description', 'Description', {
          required: true,
          multiline: true,
          hint: 'Ce que l’on voit, son histoire, son usage. Un relecteur vérifiera ce texte séparément de l’objet. 8000 caractères au maximum.',
        })}
      </fieldset>

      <fieldset className={forms.fieldset}>
        <legend className={forms.legend}>Auteur et contexte</legend>
        <div className={forms.columns}>
          {text('creatorName', 'Auteur ou autrice')}
          {text('creatorCommunity', 'Communauté')}
          {text('technique', 'Technique')}
          {text('origin', 'Origine (lieu, région)')}
          {text('period', 'Période ou date')}
        </div>
      </fieldset>

      <fieldset className={forms.fieldset}>
        <legend className={forms.legend}>Droits</legend>
        {text('rightsStatement', 'Déclaration de droits', {
          required: true,
          multiline: true,
          hint: 'Qui détient les droits de l’œuvre et des photos ou vidéos, et sous quelle licence. 2000 caractères au maximum.',
        })}
        <div>
          <label className={forms.checkbox}>
            <input
              type="checkbox"
              name="rightsConfirmed"
              checked={values.rightsConfirmed}
              aria-invalid={
                errors.rightsConfirmed === undefined ? undefined : true
              }
              aria-describedby={
                errors.rightsConfirmed === undefined
                  ? undefined
                  : 'rights-error'
              }
              onChange={(event) => {
                setValues((previous) => ({
                  ...previous,
                  rightsConfirmed: event.target.checked,
                }));
              }}
            />
            <span>
              Je confirme détenir le droit de publier cette œuvre, sa
              description et les médias que j’ajouterai.
            </span>
          </label>
          {errors.rightsConfirmed !== undefined && (
            <p id="rights-error" className={forms.fieldError}>
              {errors.rightsConfirmed}
            </p>
          )}
        </div>
      </fieldset>

      <div className={forms.actions}>
        <button type="submit" className={forms.primary} disabled={submitting}>
          {submitting ? 'Enregistrement…' : 'Enregistrer et ajouter les médias'}
        </button>
        <span className={forms.smallPrint}>
          L’œuvre reste un brouillon invisible du public jusqu’à sa relecture et
          sa publication.
        </span>
      </div>
    </form>
  );
}

/** `/contribuer`: step 1 of a submission, the description of the item. */
export function ContributePage() {
  return (
    <PageShell current="contribute" width="narrow">
      <h1 className={forms.title}>Déposer une œuvre</h1>
      <p className={forms.lead}>
        Décrivez l’œuvre, puis ajoutez ses photos ou vidéos. Un relecteur
        vérifie ensuite séparément l’objet et sa description avant toute
        publication.{' '}
        <Link to="/mes-depots" className={forms.textLink}>
          Voir mes dépôts
        </Link>
      </p>
      <RequireUser action="déposer une œuvre">
        {() => <SubmissionForm />}
      </RequireUser>
    </PageShell>
  );
}
