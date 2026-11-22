import { useEffect, useId, useState } from 'react';
import type { DragEvent } from 'react';
import type { Generation } from '../../lib/api';
import { Link } from '../../lib/router/Link';
import { signInPath } from '../../lib/session/session';
import styles from './ExhibitionPage.module.css';
import { checkSourceImage } from './image-data-uri';
import { Sheet } from './Sheet';
import type { Generations } from './use-generations';

interface GeneratePanelProps {
  readonly generations: Generations;
  readonly returnPath: string;
  /** Travels to a finished generation in the storyline. */
  readonly onVisit: (generation: Generation) => void;
  readonly onClose: () => void;
}

const STAGES: readonly {
  readonly status: Generation['status'];
  readonly label: string;
}[] = [
  { status: 'queued', label: 'Photo reçue' },
  { status: 'modeling', label: 'Modélisation du volume et des matières' },
  { status: 'storing', label: 'Mise en réserve dans la collection' },
  { status: 'ready', label: 'Prête à exposer' },
];

const ERRORS: Readonly<Record<string, string>> = {
  GENERATION_REJECTED:
    'Le service a refusé cette photo. Essayez un objet seul, bien éclairé, sur fond uni.',
  GENERATION_FAILED:
    'La modélisation a échoué. Réessayez avec une autre photo.',
  GENERATION_EXPIRED: 'Cette génération a expiré. Relancez-la.',
};

function stageIndex(status: Generation['status']): number {
  return STAGES.findIndex((stage) => stage.status === status);
}

function titleFromFile(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  return base === '' ? '' : base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Image-to-3D: the visitor photographs an object, Meshy models it, and the
 * result joins the storyline as a new chapter at the end of the corridor.
 */
export function GeneratePanel({
  generations,
  returnPath,
  onVisit,
  onClose,
}: GeneratePanelProps) {
  const inputId = useId();
  const titleId = useId();
  const promptId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [texturePrompt, setTexturePrompt] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [followedId, setFollowedId] = useState<string | null>(null);

  useEffect(() => {
    if (file === null) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const followed =
    generations.items.find((item) => item.id === followedId) ??
    generations.items.find(
      (item) => item.status !== 'ready' && item.status !== 'failed',
    ) ??
    null;

  function choose(next: File | undefined): void {
    generations.clearError();
    if (next === undefined) return;
    const issue = checkSourceImage(next);
    setProblem(issue);
    if (issue !== null) return;
    setFile(next);
    if (title === '') setTitle(titleFromFile(next.name));
  }

  function onDrop(event: DragEvent<HTMLLabelElement>): void {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0]);
  }

  async function submit(): Promise<void> {
    if (file === null) return;
    const created = await generations.start({ file, title, texturePrompt });
    if (created !== null) {
      setFollowedId(created.id);
      setFile(null);
      setTitle('');
      setTexturePrompt('');
    }
  }

  const finished = generations.items.filter((item) => item.status === 'ready');

  return (
    <Sheet label="Créer une œuvre en 3D" side="right" onClose={onClose}>
      <div className={styles.generate}>
        <header className={styles.sheetHeader}>
          <p className={styles.eyebrow}>Atelier · Image → 3D</p>
          <h2 className={styles.sheetTitle}>
            Votre objet, <em>en volume</em>
          </h2>
          <p className={styles.sheetLead}>
            Photographiez un objet : l’IA en reconstitue le volume et les
            matières, puis il rejoint la traversée, au bout du couloir.
          </p>
        </header>

        {!generations.signedIn ? (
          <div className={styles.callout}>
            <p>
              {generations.sessionKnown
                ? 'La génération 3D est réservée aux visiteurs connectés.'
                : 'Vérification de votre session…'}
            </p>
            {generations.sessionKnown ? (
              <Link to={signInPath(returnPath)} className={styles.primary}>
                Se connecter
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            {followed !== null && followed.status !== 'ready' ? (
              <Progress generation={followed} />
            ) : null}

            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <label
                htmlFor={inputId}
                className={styles.dropzone}
                data-dragging={dragging}
                data-filled={preview !== null}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => {
                  setDragging(false);
                }}
                onDrop={onDrop}
              >
                {preview !== null ? (
                  <img src={preview} alt="Objet choisi pour la génération" />
                ) : (
                  <span className={styles.dropzoneText}>
                    <strong>Déposez une photo</strong>
                    <span>ou touchez pour en choisir une</span>
                  </span>
                )}
              </label>
              <input
                id={inputId}
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  choose(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
              <ul className={styles.tips}>
                <li>Un seul objet, entier dans le cadre</li>
                <li>Lumière douce, fond uni</li>
                <li>Vue de trois-quarts, de préférence</li>
              </ul>

              <div className={styles.field}>
                <label htmlFor={titleId}>Titre de l’œuvre</label>
                <input
                  id={titleId}
                  value={title}
                  maxLength={120}
                  placeholder="Ex. Panier tressé de ma grand-mère"
                  onChange={(event) => {
                    setTitle(event.target.value);
                  }}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor={promptId}>
                  Matières <span>(facultatif)</span>
                </label>
                <textarea
                  id={promptId}
                  value={texturePrompt}
                  maxLength={600}
                  rows={2}
                  placeholder="Ex. raphia naturel, motifs teints en rouge"
                  onChange={(event) => {
                    setTexturePrompt(event.target.value);
                  }}
                />
              </div>

              {problem !== null || generations.error !== null ? (
                <p className={styles.error} role="alert">
                  {problem ?? generations.error}
                </p>
              ) : null}

              <button
                type="submit"
                className={styles.primary}
                disabled={file === null || generations.submitting}
              >
                {generations.submitting
                  ? 'Envoi de la photo…'
                  : 'Générer en 3D'}
              </button>
              <p className={styles.sheetHint}>
                Comptez une à trois minutes. Vous pouvez fermer ce panneau et
                continuer la visite : l’œuvre apparaîtra dans le couloir.
              </p>
            </form>

            {finished.length > 0 ? (
              <section className={styles.creations} aria-label="Vos créations">
                <h3 className={styles.eyebrow}>Vos créations</h3>
                <ul>
                  {finished.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onVisit(item);
                        }}
                      >
                        {item.posterUrl !== null ? (
                          <img src={item.posterUrl} alt="" />
                        ) : (
                          <span aria-hidden="true" />
                        )}
                        <span>{item.title}</span>
                        <span className={styles.creationAction}>
                          Voir dans l’exposition
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </Sheet>
  );
}

function Progress({ generation }: { readonly generation: Generation }) {
  const current = stageIndex(generation.status);
  if (generation.status === 'failed') {
    return (
      <div className={styles.callout} role="alert">
        <p>
          <strong>{generation.title}</strong> —{' '}
          {ERRORS[generation.errorCode ?? 'GENERATION_FAILED'] ??
            ERRORS.GENERATION_FAILED}
        </p>
      </div>
    );
  }
  return (
    <section className={styles.progress} aria-label="Génération en cours">
      <div className={styles.progressHead}>
        <span>{generation.title}</span>
        <span className={styles.progressValue}>
          {String(generation.progress)} %
        </span>
      </div>
      <div
        className={styles.progressBar}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={generation.progress}
        aria-label={`Génération de ${generation.title}`}
      >
        <span
          style={{ transform: `scaleX(${String(generation.progress / 100)})` }}
        />
      </div>
      <ol className={styles.stages}>
        {STAGES.map((stage, index) => (
          <li
            key={stage.status}
            data-state={
              index < current ? 'done' : index === current ? 'current' : 'next'
            }
          >
            {stage.label}
          </li>
        ))}
      </ol>
    </section>
  );
}
