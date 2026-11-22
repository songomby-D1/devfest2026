import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { ErrorNotice } from '../../components/error-notice/ErrorNotice';
import { FormField } from '../../components/form-field/FormField';
import forms from '../../components/forms/forms.module.css';
import { PageShell } from '../../components/page-shell/PageShell';
import { ApiError } from '../../lib/api';
import { Link } from '../../lib/router/Link';
import { navigate } from '../../lib/router/router';
import { register, safeReturnPath } from '../../lib/session/session';

/** Password length of the Auth contract, counted in characters. */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

interface Errors {
  email?: string;
  password?: string;
  confirmation?: string;
  displayName?: string;
}

export function validateRegistration(values: {
  email: string;
  password: string;
  confirmation: string;
  displayName: string;
}): Errors {
  const errors: Errors = {};
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email.trim())) {
    errors.email = 'Indiquez une adresse e-mail valide.';
  }
  // Counted in code points after NFKC, as Auth counts them.
  let length = 0;
  for (const _character of values.password.normalize('NFKC')) length += 1;
  if (length < PASSWORD_MIN || length > PASSWORD_MAX) {
    errors.password = `Le mot de passe compte de ${String(PASSWORD_MIN)} à ${String(PASSWORD_MAX)} caractères.`;
  }
  if (values.confirmation !== values.password) {
    errors.confirmation = 'Les deux mots de passe ne correspondent pas.';
  }
  if (values.displayName.trim().length > 240) {
    errors.displayName = 'Le nom affiché compte au plus 240 caractères.';
  }
  return errors;
}

export function RegisterPage() {
  const [values, setValues] = useState({
    email: '',
    password: '',
    confirmation: '',
    displayName: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const target = safeReturnPath(
    new URLSearchParams(window.location.search).get('retour'),
  );

  const set = (field: keyof typeof values) => (value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
  };

  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const next = validateRegistration(values);
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSubmitting(true);
    setFailure(null);
    const displayName = values.displayName.trim();
    register({
      email: values.email.trim(),
      password: values.password,
      displayName: displayName === '' ? null : displayName,
    })
      .then(() => {
        navigate(target, { replace: true });
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') {
          const fieldErrors: Errors = {};
          for (const issue of error.details) {
            if (issue.field === 'email')
              fieldErrors.email = 'Adresse e-mail refusée par le serveur.';
            if (issue.field === 'password')
              fieldErrors.password =
                'Mot de passe refusé par le serveur (12 à 128 caractères).';
          }
          setErrors(fieldErrors);
        }
        setFailure(error);
        setSubmitting(false);
      });
  };

  return (
    <PageShell width="narrow">
      <h1 className={forms.title}>Créer un compte</h1>
      <p className={forms.lead}>
        Un compte permet de déposer des œuvres et de suivre leur relecture.
      </p>
      {failure !== null && <ErrorNotice error={failure} />}
      <form className={forms.form} onSubmit={submit} noValidate>
        <FormField label="Adresse e-mail" required error={errors.email}>
          {(control) => (
            <input
              {...control}
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(event) => {
                set('email')(event.target.value);
              }}
            />
          )}
        </FormField>
        <FormField
          label="Nom affiché"
          error={errors.displayName}
          hint="Visible par les relecteurs. Laissez vide pour utiliser votre adresse e-mail."
        >
          {(control) => (
            <input
              {...control}
              type="text"
              autoComplete="nickname"
              value={values.displayName}
              onChange={(event) => {
                set('displayName')(event.target.value);
              }}
            />
          )}
        </FormField>
        <FormField
          label="Mot de passe"
          required
          error={errors.password}
          hint={`De ${String(PASSWORD_MIN)} à ${String(PASSWORD_MAX)} caractères.`}
        >
          {(control) => (
            <input
              {...control}
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={(event) => {
                set('password')(event.target.value);
              }}
            />
          )}
        </FormField>
        <FormField
          label="Confirmer le mot de passe"
          required
          error={errors.confirmation}
        >
          {(control) => (
            <input
              {...control}
              type="password"
              autoComplete="new-password"
              value={values.confirmation}
              onChange={(event) => {
                set('confirmation')(event.target.value);
              }}
            />
          )}
        </FormField>
        <div className={forms.actions}>
          <button type="submit" className={forms.primary} disabled={submitting}>
            {submitting ? 'Création…' : 'Créer mon compte'}
          </button>
          <Link
            to={`/connexion?retour=${encodeURIComponent(target)}`}
            className={forms.textLink}
          >
            Déjà inscrit ? Se connecter
          </Link>
        </div>
      </form>
    </PageShell>
  );
}
