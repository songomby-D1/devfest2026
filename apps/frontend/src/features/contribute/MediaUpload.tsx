import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ErrorNotice } from '../../components/error-notice/ErrorNotice';
import { FormField } from '../../components/form-field/FormField';
import forms from '../../components/forms/forms.module.css';
import {
  ACCEPTED_MEDIA_TYPES,
  api,
  checkMediaFile,
  formatMegabytes,
  MEDIA_UPLOAD_LIMITS,
} from '../../lib/api';
import type { MediaRef } from '../../lib/api';
import { handleAuthError } from '../../lib/session/session';

export interface MediaUploadProps {
  itemId: string;
  mediaCount: number;
  onUploaded: (media: MediaRef) => void;
}

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; progress: number }
  | { status: 'done'; name: string }
  | { status: 'failed'; error: unknown };

const { image, video } = MEDIA_UPLOAD_LIMITS;

/** Adds one image or video to a draft, with format and size hints, progress and retry. */
export function MediaUpload({ itemId, mediaCount, onUploaded }: MediaUploadProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [state, setState] = useState<UploadState>({ status: 'idle' });
  const full = mediaCount >= MEDIA_UPLOAD_LIMITS.maxPerItem;
  const uploading = state.status === 'uploading';

  const choose = (chosen: File | null): void => {
    setFile(chosen);
    setState({ status: 'idle' });
    if (chosen === null) {
      setFileError(null);
      return;
    }
    const check = checkMediaFile(chosen);
    setFileError(check.ok ? null : check.message);
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (file === null) {
      setFileError('Choisissez un fichier.');
      return;
    }
    const check = checkMediaFile(file);
    if (!check.ok) {
      setFileError(check.message);
      return;
    }
    setState({ status: 'uploading', progress: 0 });
    api
      .uploadMedia(itemId, file, {
        caption,
        onProgress: (progress) => {
          setState({ status: 'uploading', progress });
        },
      })
      .then((media) => {
        setState({ status: 'done', name: file.name });
        setFile(null);
        setCaption('');
        if (inputRef.current !== null) inputRef.current.value = '';
        onUploaded(media);
      })
      .catch((error: unknown) => {
        handleAuthError(error);
        setState({ status: 'failed', error });
      });
  };

  return (
    <form className={forms.form} onSubmit={submit} noValidate aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={forms.legend}>
        Ajouter une photo ou une vidéo
      </h2>
      <p id={`${id}-hint`} className={forms.smallPrint}>
        Images JPEG, PNG ou WebP jusqu’à {formatMegabytes(image.maxBytes)} ;
        vidéos MP4 ou WebM jusqu’à {formatMegabytes(video.maxBytes)} ;{' '}
        {MEDIA_UPLOAD_LIMITS.maxPerItem} fichiers au plus par œuvre ({mediaCount}{' '}
        déjà ajouté{mediaCount > 1 ? 's' : ''}).
      </p>
      {full ? (
        <p className={forms.status}>Le nombre maximal de médias est atteint.</p>
      ) : (
        <>
          <div>
            <label htmlFor={`${id}-file`} className={forms.legend}>
              Fichier
            </label>
            <input
              ref={inputRef}
              id={`${id}-file`}
              type="file"
              accept={ACCEPTED_MEDIA_TYPES.join(',')}
              aria-describedby={fileError === null ? `${id}-hint` : `${id}-hint ${id}-file-error`}
              aria-invalid={fileError === null ? undefined : true}
              disabled={uploading}
              onChange={(event) => {
                choose(event.target.files?.[0] ?? null);
              }}
            />
            {fileError !== null && (
              <p id={`${id}-file-error`} className={forms.fieldError}>
                {fileError}
              </p>
            )}
          </div>
          <FormField
            label="Légende"
            hint={`Décrit l’image pour les personnes qui ne la voient pas. ${String(MEDIA_UPLOAD_LIMITS.captionMax)} caractères au maximum.`}
          >
            {(control) => (
              <input
                {...control}
                type="text"
                value={caption}
                maxLength={MEDIA_UPLOAD_LIMITS.captionMax}
                disabled={uploading}
                onChange={(event) => {
                  setCaption(event.target.value);
                }}
              />
            )}
          </FormField>
          {state.status === 'uploading' && (
            <div role="status">
              <progress
                className={forms.progress}
                max={1}
                value={state.progress}
                aria-label="Progression de l’envoi"
              />
              <p className={forms.smallPrint}>Envoi… {Math.round(state.progress * 100)} %</p>
            </div>
          )}
          {state.status === 'done' && (
            <p className={forms.success} role="status">
              « {state.name} » a été ajouté.
            </p>
          )}
          {state.status === 'failed' && (
            <ErrorNotice
              error={state.error}
              title="L’envoi a échoué. Le brouillon est conservé : vous pouvez réessayer."
            />
          )}
          <div className={forms.actions}>
            <button
              type="submit"
              className={forms.primary}
              disabled={uploading || file === null || fileError !== null}
            >
              {state.status === 'failed' ? 'Réessayer l’envoi' : 'Envoyer le fichier'}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
