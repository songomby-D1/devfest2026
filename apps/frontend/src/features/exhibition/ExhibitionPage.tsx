import { useCallback, useEffect, useMemo, useState } from 'react';
import { NotFoundPage } from '../../components/not-found/NotFoundPage';
import { Logo } from '../../components/logo/Logo';
import type { Generation } from '../../lib/api';
import { useReducedMotion } from '../../lib/motion/reduced-motion';
import { Link } from '../../lib/router/Link';
import { useSession } from '../../lib/session/session';
import { detectDevice } from '../gallery-3d/device';
import { DepthScene, useSceneProgress } from './DepthScene';
import { depthLabel } from './depth';
import { ExaminePanel } from './ExaminePanel';
import {
  type Chapter,
  type Exhibition,
  findExhibition,
  GENERATED_CREDIT,
} from './exhibition-content';
import styles from './ExhibitionPage.module.css';
import { GeneratePanel } from './GeneratePanel';
import { GuestBook, useGuestBook } from './GuestBook';
import { useDepthNavigation } from './use-depth-navigation';
import { useGenerations } from './use-generations';
import { speechAvailable, useNarrator } from './use-narrator';

type Panel = 'none' | 'examine' | 'generate' | 'guestbook';

const CHAPTER_PARAM = 'chapitre';

/** A finished generation becomes a chapter at the end of the corridor. */
export function generationChapter(generation: Generation): Chapter | null {
  if (generation.status !== 'ready' || generation.modelUrl === null)
    return null;
  return {
    id: `generation-${generation.id}`,
    label: generation.title,
    eyebrow: 'Vos créations · Image → 3D',
    title: generation.title,
    material: 'Modèle généré à partir de votre photo',
    narrative: `${generation.title} rejoint la traversée. Reconstituée en volume à partir d’une simple photo, l’œuvre prolonge l’exposition : le patrimoine continue de s’écrire.`,
    model: generation.modelUrl,
    poster: generation.posterUrl,
    height: 1.3,
    credit: GENERATED_CREDIT,
    generated: true,
  };
}

function initialChapter(): number {
  const raw = new URLSearchParams(window.location.search).get(CHAPTER_PARAM);
  const value = raw === null ? 1 : Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value - 1 : 0;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function ExhibitionPage({ id }: { readonly id: string }) {
  const exhibition = findExhibition(id);
  if (exhibition === undefined) return <NotFoundPage />;
  return <ExhibitionView exhibition={exhibition} />;
}

function ExhibitionView({ exhibition }: { readonly exhibition: Exhibition }) {
  const reducedMotion = useReducedMotion();
  const [device] = useState(detectDevice);
  const [webgl, setWebgl] = useState(device.renderer === 'webgl');
  const session = useSession();
  const generations = useGenerations();
  const book = useGuestBook(exhibition.id);
  // `?creer=1` (the "Créer en 3D" links of the app) opens the generation panel directly.
  const [panel, setPanel] = useState<Panel>(() =>
    new URLSearchParams(window.location.search).has('creer')
      ? 'generate'
      : 'none',
  );
  const [playing, setPlaying] = useState(false);
  const [voice, setVoice] = useState(speechAvailable);
  const [moved, setMoved] = useState(false);
  const loading = useSceneProgress();

  const chapters = useMemo(() => {
    const created = [...generations.items]
      .reverse()
      .map(generationChapter)
      .filter((chapter): chapter is Chapter => chapter !== null);
    return [...exhibition.chapters, ...created];
  }, [exhibition, generations.items]);

  const [startAt] = useState(initialChapter);
  const navigation = useDepthNavigation(
    chapters.length,
    startAt,
    panel === 'none',
  );
  const { index, goTo, step } = navigation;
  const chapter = chapters[index] ?? chapters[0];

  useEffect(() => {
    if (index !== startAt) setMoved(true);
  }, [index, startAt]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set(CHAPTER_PARAM, String(index + 1));
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }, [index]);

  const onFinished = useCallback(() => {
    if (index < chapters.length - 1) step(1);
    else setPlaying(false);
  }, [index, chapters.length, step]);

  const narrator = useNarrator({
    text: chapter?.narrative ?? '',
    playing,
    voice,
    reducedMotion,
    onFinished,
  });

  const closePanel = useCallback(() => {
    setPanel('none');
  }, []);

  const running = generations.items.find(
    (item) => item.status !== 'ready' && item.status !== 'failed',
  );

  if (chapter === undefined) return <NotFoundPage />;

  const total = chapters.length;
  const typed = chapter.narrative.slice(0, narrator.shown);
  const typing = narrator.shown < chapter.narrative.length;

  return (
    <div className={styles.page} data-playing={playing}>
      <div className={styles.stage}>
        {webgl ? (
          <DepthScene
            chapters={chapters}
            depth={navigation.depth}
            reducedMotion={reducedMotion}
            lowPower={device.lowPower}
            onFailure={() => {
              setWebgl(false);
            }}
          />
        ) : (
          <div className={styles.flatStage}>
            {chapter.poster !== null ? (
              <img
                key={chapter.id}
                src={chapter.poster}
                alt={`${chapter.title}, ${chapter.material}`}
              />
            ) : null}
          </div>
        )}
      </div>
      <div className={styles.vignette} aria-hidden="true" />

      <header className={styles.top}>
        <Link to="/" className={styles.logo} aria-label="LOVA, accueil">
          <Logo />
        </Link>
        <div className={styles.masthead}>
          <span className={styles.mastheadNumber}>
            Exposition {exhibition.number}
          </span>
          <h1 className={styles.mastheadTitle}>{exhibition.title}</h1>
          <span className={styles.mastheadCurator}>{exhibition.curator}</span>
        </div>
        <div className={styles.actions}>
          <Link
            to={`/expositions/${exhibition.id}/billetterie`}
            className={styles.ghost}
            aria-label="Billets pour l’exposition sur place"
          >
            <TicketIcon />
            <span className={styles.actionLabel}>Billets</span>
          </Link>
          <button
            type="button"
            className={styles.ghost}
            aria-label={`Livre d’or${book.notes.length > 0 ? `, ${String(book.notes.length)} mots` : ''}`}
            onClick={() => {
              setPanel('guestbook');
            }}
          >
            <BookIcon />
            <span className={styles.actionLabel}>Livre d’or</span>
            {book.notes.length > 0 ? (
              <span className={styles.count}>{book.notes.length}</span>
            ) : null}
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              setPanel('generate');
            }}
          >
            {running !== undefined ? (
              <>
                <span className={styles.pulse} aria-hidden="true" />
                Génération {running.progress} %
              </>
            ) : (
              <>
                <span aria-hidden="true">＋</span> Créer en 3D
              </>
            )}
          </button>
        </div>
      </header>

      <main className={styles.story} aria-labelledby="chapter-title">
        <div key={chapter.id} className={styles.storyInner}>
          <p className={styles.counter}>
            <span className={styles.numeral}>{pad(index + 1)}</span>
            <span className={styles.total}>/ {pad(total)}</span>
            <span className={styles.depth}>{depthLabel(index)}</span>
          </p>
          <p className={styles.eyebrow}>{chapter.eyebrow}</p>
          <h2 id="chapter-title" className={styles.title}>
            {chapter.title}
          </h2>
          <p className={styles.material}>{chapter.material}</p>
          <p className={styles.narrative} aria-hidden="true">
            {typed}
            {playing && typing ? <span className={styles.caret} /> : null}
          </p>
          <p className="visually-hidden">{chapter.narrative}</p>
        </div>

        <div className={styles.controls}>
          <button
            type="button"
            className={styles.play}
            aria-pressed={playing}
            onClick={() => {
              setPlaying((value) => !value);
            }}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
            <span>
              {playing
                ? 'Pause'
                : index === 0
                  ? 'Lancer la visite'
                  : 'Reprendre la visite'}
            </span>
          </button>
          <button
            type="button"
            className={styles.icon}
            aria-label="Revenir au début"
            onClick={() => {
              setPlaying(false);
              goTo(0);
            }}
          >
            <RestartIcon />
          </button>
          {speechAvailable() ? (
            <button
              type="button"
              className={styles.icon}
              aria-pressed={voice}
              aria-label={
                voice
                  ? 'Couper la voix du narrateur'
                  : 'Activer la voix du narrateur'
              }
              data-speaking={narrator.speaking}
              onClick={() => {
                setVoice((value) => !value);
              }}
            >
              {voice ? <VoiceIcon /> : <MuteIcon />}
            </button>
          ) : null}
          <button
            type="button"
            className={styles.examineButton}
            onClick={() => {
              setPlaying(false);
              setPanel('examine');
            }}
          >
            Examiner en 3D <span aria-hidden="true">→</span>
          </button>
        </div>
        {index === exhibition.chapters.length - 1 ? (
          <Link
            to={`/expositions/${exhibition.id}/billetterie`}
            className={styles.realVisit}
          >
            <span className={styles.realVisitKicker}>
              {exhibition.visit.venue} · {exhibition.visit.city}
            </span>
            <span className={styles.realVisitText}>
              Voir l’exposition en vrai <span aria-hidden="true">→</span>
            </span>
          </Link>
        ) : null}
        <p className={styles.credit}>{chapter.credit}</p>
      </main>

      <nav
        className={styles.rail}
        aria-label="Chapitres, du plus proche au plus profond"
      >
        <button
          type="button"
          className={styles.railStep}
          aria-label="Reculer d’un chapitre"
          disabled={index === 0}
          onClick={() => {
            step(-1);
          }}
        >
          <ArrowIcon up />
        </button>
        <ol className={styles.railList}>
          {chapters.map((item, position) => (
            <li key={item.id}>
              <button
                type="button"
                className={styles.railItem}
                aria-current={position === index ? 'step' : undefined}
                data-generated={item.generated}
                onClick={() => {
                  goTo(position);
                }}
              >
                <span className={styles.railDepth}>{depthLabel(position)}</span>
                <span className={styles.railLabel}>{item.label}</span>
                <span className={styles.railTick} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className={styles.railStep}
          aria-label="Avancer d’un chapitre"
          disabled={index === total - 1}
          onClick={() => {
            step(1);
          }}
        >
          <ArrowIcon />
        </button>
      </nav>

      <p
        className={styles.hint}
        data-hidden={moved || playing}
        aria-hidden="true"
      >
        <span className={styles.hintLine} />
        Faites défiler pour avancer en profondeur
      </p>

      {webgl && loading.active ? (
        <div className={styles.veil} role="status">
          <span className={styles.veilTitle}>{exhibition.title}</span>
          <span className={styles.veilBar}>
            <span
              style={{ transform: `scaleX(${String(loading.progress / 100)})` }}
            />
          </span>
          <span className={styles.veilText}>
            Préparation de la traversée · {Math.round(loading.progress)} %
          </span>
        </div>
      ) : null}

      {panel === 'examine' ? (
        <ExaminePanel
          chapter={chapter}
          reducedMotion={reducedMotion}
          onClose={closePanel}
        />
      ) : null}
      {panel === 'generate' ? (
        <GeneratePanel
          generations={generations}
          returnPath={`/expositions/${exhibition.id}`}
          onVisit={(generation) => {
            const target = chapters.findIndex(
              (item) => item.id === `generation-${generation.id}`,
            );
            setPanel('none');
            if (target >= 0) goTo(target);
          }}
          onClose={closePanel}
        />
      ) : null}
      {panel === 'guestbook' ? (
        <GuestBook
          book={book}
          chapterTitle={chapter.title}
          defaultAuthor={
            session.status === 'signed-in' ? (session.me.displayName ?? '') : ''
          }
          onClose={closePanel}
        />
      ) : null}
    </div>
  );
}

function TicketIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M2 4.5h12v2a1.5 1.5 0 0 0 0 3v2H2v-2a1.5 1.5 0 0 0 0-3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M10 5v1.2M10 7.4v1.2M10 9.8V11"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 4c-1.6-1-3.6-1.3-5.5-1v9.5c1.9-.3 3.9 0 5.5 1 1.6-1 3.6-1.3 5.5-1V3C11.6 2.7 9.6 3 8 4zM8 4v9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3 1.8v10.4L12 7z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3 2h2.6v10H3zM8.4 2H11v10H8.4z" fill="currentColor" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3 8a5 5 0 1 0 1.6-3.7M3 2v3h3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VoiceIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 6h2.5L8 3v10L4.5 10H2z" fill="currentColor" />
      <path
        d="M10.5 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6.3 6.3 0 0 1 0 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 6h2.5L8 3v10L4.5 10H2z" fill="currentColor" />
      <path
        d="M10.5 6l4 4M14.5 6l-4 4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowIcon({ up = false }: { readonly up?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden="true"
      style={up ? { transform: 'rotate(180deg)' } : undefined}
    >
      <path
        d="M7 2v10M3 8l4 4 4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
