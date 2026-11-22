import { useState } from 'react';
import type { FormEvent } from 'react';
import { ErrorNotice } from '../../components/error-notice/ErrorNotice';
import { FormField } from '../../components/form-field/FormField';
import forms from '../../components/forms/forms.module.css';
import { PageShell } from '../../components/page-shell/PageShell';
import { Link } from '../../lib/router/Link';
import { navigate } from '../../lib/router/router';
import { safeReturnPath, signIn } from '../../lib/session/session';

function returnPath(): string {
  return safeReturnPath(new URLSearchParams(window.location.search).get('retour'));
}

export function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const target = returnPath();

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const next: typeof errors = {};
    if (email.trim() === '') next.email = 'Indiquez votre adresse e-mail.';
    if (password === '') next.password = 'Indiquez votre mot de passe.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSubmitting(true);
    setFailure(null);
    signIn({ email: email.trim(), password })
      .then(() => {
        navigate(target, { replace: true });
      })
      .catch((error: unknown) => {
        setFailure(error);
        setSubmitting(false);
      });
  };

  return (
    <PageShell width="narrow">
      <h1 className={forms.title}>Connexion</h1>
      <p className={forms.lead}>
        Connectez-vous pour déposer une œuvre, suivre vos dépôts ou relire des
        œuvres. La visite du musée reste libre.
      </p>
      {failure !== null && <ErrorNotice error={failure} />}
      <form className={forms.form} onSubmit={submit} noValidate>
        <FormField label="Adresse e-mail" required error={errors.email}>
          {(control) => (
            <input
              {...control}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
            />
          )}
        </FormField>
        <FormField label="Mot de passe" required error={errors.password}>
          {(control) => (
            <input
              {...control}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
            />
          )}
        </FormField>
        <div className={forms.actions}>
          <button type="submit" className={forms.primary} disabled={submitting}>
            {submitting ? 'Connexion…' : 'Se connecter'}
          </button>
          <Link
            to={`/inscription?retour=${encodeURIComponent(target)}`}
            className={forms.textLink}
          >
            Pas encore de compte ? Créer un compte
          </Link>
        </div>
      </form>
    </PageShell>
  );
}
