import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import sceneRedRoom1280 from '../../assets/gallery/scene-red-room-1280.webp';
import sceneRedRoom1920 from '../../assets/gallery/scene-red-room-1920.webp';
import sceneRedRoom2880 from '../../assets/gallery/scene-red-room-2880.webp';
import spotBeam from '../../assets/gallery/spot-beam.svg';
import spotCore from '../../assets/gallery/spot-core.svg';
import backPaper from '../../assets/icons/back-paper.svg';
import nextPaper from '../../assets/icons/next-paper.svg';
import zoomPaper from '../../assets/icons/zoom-paper.svg';
import { Logo } from '../../components/logo/Logo';
import { MediaImage } from '../../components/media-image/MediaImage';
import { NavLink } from '../../components/nav-link/NavLink';
import { SoundToggle } from '../../components/sound-toggle/SoundToggle';
import { ambience } from '../../lib/audio/ambience';
import { cx } from '../../lib/cx';
import { useReducedMotion } from '../../lib/motion/reduced-motion';
import { Link } from '../../lib/router/Link';
import { navigate } from '../../lib/router/router';
import { ArtworkNotice } from './ArtworkNotice';
import { CloseUpViewer } from './CloseUpViewer';
import type { Artwork, Room, RoomMedium } from './data/rooms';
import { artworkPath, roomPath } from './data/rooms';
import { GalleryDialog } from './GalleryDialog';
import styles from './GalleryPage.module.css';
import { useArtworkSwap } from './useArtworkSwap';
import type { SwapDirection } from './useArtworkSwap';
import { useGalleryArrival } from './useGalleryArrival';
import { useImagePreload } from './useImagePreload';
import { useScenePlacement } from './useScenePlacement';
import { useSwipe } from './useSwipe';

export interface GalleryPageProps {
  room: Room;
  /** Every room with its artworks, for the tabs and the room menu. */
  rooms: readonly Room[];
  /** Index of the artwork from the URL. Rooms without artworks pass null. */
  artworkIndex: number | null;
}

type Layer = 'notice' | 'closeUp' | 'wallText' | 'roomMenu' | null;

const PLACEHOLDER_LABEL: Record<Exclude<RoomMedium, 'painting'>, string> = {
  sculpture: 'Visionneuse 3D à venir : faire tourner la sculpture.',
  craft: 'Vidéo par étapes à venir : suivre le geste de l’artisan.',
  music: 'Lecteur à venir : écouter les enregistrements de la salle.',
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  );
}

export function GalleryPage({ room, rooms, artworkIndex }: GalleryPageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const cartelRef = useRef<HTMLButtonElement>(null);
  const closeUpButtonRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const ids = {
    notice: useId(),
    closeUp: useId(),
    wallText: useId(),
    roomMenu: useId(),
  };

  // What hangs on the wall follows the URL once the outgoing animation hides the old content.
  const [shownIndex, setShownIndex] = useState(artworkIndex);
  const [shownRoom, setShownRoom] = useState(room);
  const [layer, setLayer] = useState<Layer>(null);
  const pendingIndexRef = useRef<number | null>(artworkIndex);
  const handledRef = useRef({ slug: room.slug, index: artworkIndex });

  const arrival = useGalleryArrival(rootRef, {
    roomKey: shownRoom.slug,
    reducedMotion,
  });
  const swap = useArtworkSwap(rootRef, {
    reducedMotion,
    onSwap: () => {
      setShownIndex(pendingIndexRef.current);
    },
  });
  const swapRef = useRef(swap);
  swapRef.current = swap;

  useScenePlacement(sceneRef);

  // Room change: fade to black, swap wall, text and track, then light the room again.
  useEffect(() => {
    if (room.slug === shownRoom.slug) {
      return;
    }
    if (handledRef.current.slug === room.slug) {
      return;
    }
    handledRef.current = { slug: room.slug, index: artworkIndex };
    setLayer(null);
    arrival.leaveRoom(() => {
      pendingIndexRef.current = artworkIndex;
      setShownRoom(room);
      setShownIndex(artworkIndex);
      ambience.setTrack(room.ambience.track);
    });
  }, [room, artworkIndex, shownRoom.slug, arrival]);

  // Artwork change within the room: slide in the navigation direction.
  useEffect(() => {
    if (room.slug !== shownRoom.slug || artworkIndex === null) {
      return;
    }
    const handled = handledRef.current;
    if (handled.slug === room.slug && handled.index === artworkIndex) {
      return;
    }
    const previous = handled.index ?? 0;
    handledRef.current = { slug: room.slug, index: artworkIndex };
    const count = room.artworks.length;
    const forward = (artworkIndex - previous + count) % count <= count / 2;
    pendingIndexRef.current = artworkIndex;
    arrival.complete();
    swapRef.current(forward ? 1 : -1);
  }, [room, artworkIndex, shownRoom.slug, arrival]);

  useEffect(() => {
    ambience.setTrack(room.ambience.track);
  }, [room.ambience.track]);

  const artworks = shownRoom.artworks;
  const artwork: Artwork | undefined =
    shownIndex === null ? undefined : artworks[shownIndex];
  const total = artworks.length;

  const go = (direction: SwapDirection): void => {
    if (artworkIndex === null || total < 2 || layer !== null) {
      return;
    }
    const next = (artworkIndex + direction + total) % total;
    const target = room.artworks[next];
    if (target !== undefined) {
      navigate(artworkPath(room, target));
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isEditable(event.target) || layer !== null) {
        return;
      }
      if (event.key === 'ArrowRight') {
        go(1);
      } else if (event.key === 'ArrowLeft') {
        go(-1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  });

  useSwipe(sceneRef, go);

  const neighbours = useMemo(() => {
    if (artworkIndex === null || total < 2) {
      return [];
    }
    const previous = room.artworks[(artworkIndex - 1 + total) % total];
    const next = room.artworks[(artworkIndex + 1) % total];
    return [previous, next]
      .filter((item): item is Artwork => item !== undefined)
      .map((item) => item.image);
  }, [room, artworkIndex, total]);
  useImagePreload(neighbours);

  const roomNumber = rooms.findIndex(
    (candidate) => candidate.slug === shownRoom.slug,
  );
  const wallTitle = shownRoom.titleLines.join(' ');

  return (
    <div
      ref={rootRef}
      className={styles.gallery}
      data-wall={shownRoom.ambience.wallTone}
      data-scene={shownRoom.ambience.usesRedRoomScene ? 'photo' : 'tone'}
      data-motion="pending"
      data-layer={layer ?? undefined}
    >
      <div
        ref={sceneRef}
        className={styles.scene}
        data-g="scene"
        aria-hidden="true"
      >
        {shownRoom.ambience.usesRedRoomScene ? (
          <img
            className={styles.sceneImage}
            src={sceneRedRoom1920}
            srcSet={`${sceneRedRoom1280} 1280w, ${sceneRedRoom1920} 1920w, ${sceneRedRoom2880} 2880w`}
            sizes="130vw"
            width={2880}
            height={1591}
            alt=""
            fetchPriority="high"
            decoding="async"
          />
        ) : (
          <div className={styles.sceneWall} />
        )}
      </div>
      <div className={styles.spot} data-g="spot" aria-hidden="true">
        <img
          className={styles.spotBeam}
          src={spotBeam}
          width={492}
          height={817}
          alt=""
        />
        <img
          className={styles.spotCore}
          src={spotCore}
          width={420}
          height={591}
          alt=""
        />
      </div>
      <div className={styles.topScrim} aria-hidden="true" />

      <header className={styles.topBar} data-g="topbar">
        <Link
          to="/"
          className={styles.logo}
          aria-label="LOVA, retour à l’accueil"
        >
          <Logo />
        </Link>
        <p className={styles.currentRoom}>
          <span>
            Salle {shownRoom.number} sur {pad(rooms.length)} · {shownRoom.name}
          </span>
          <span className={styles.progress} aria-hidden="true">
            {rooms.map((candidate, index) => (
              <span
                key={candidate.slug}
                className={cx(
                  styles.dot,
                  index === roomNumber && styles.dotActive,
                )}
              />
            ))}
          </span>
        </p>
        <div className={styles.topRight}>
          <button
            type="button"
            className={cx(styles.glassButton, styles.menuButton)}
            onClick={() => {
              setLayer('roomMenu');
            }}
            aria-haspopup="dialog"
          >
            Salles
          </button>
          <SoundToggle theme="dark" className={styles.sound} />
        </div>
      </header>

      <main className={styles.room} aria-labelledby="room-title">
        {/*
          Keyed by room: SplitText rewraps the wall text in its own line
          elements, so a room change must replace the whole block (its parent
          is untouched) instead of letting React remove nodes inside it.
        */}
        <section
          key={shownRoom.slug}
          className={styles.wallText}
          aria-label="Texte mural"
        >
          <p className={styles.wallLabel} data-g="wall-label">
            Salle {shownRoom.number} · {shownRoom.name} ·{' '}
            {shownRoom.malagasyLabel}
          </p>
          <h1 id="room-title" className={styles.wallTitle} data-g="wall-title">
            {shownRoom.titleLines.map((line, index) => (
              <Fragment key={line}>
                {index > 0 && (
                  <>
                    {' '}
                    <br />
                  </>
                )}
                {line}
              </Fragment>
            ))}
          </h1>
          <p className={styles.wallSubtitle} data-g="wall-subtitle">
            {shownRoom.subtitle}
          </p>
          <div className={styles.wallBody} data-g="wall-text">
            {shownRoom.wallText.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <button
            type="button"
            className={cx(styles.glassButton, styles.readButton)}
            data-g="wall-read"
            onClick={() => {
              setLayer('wallText');
            }}
            aria-haspopup="dialog"
          >
            Lire
          </button>
        </section>

        {artwork !== undefined ? (
          <figure className={styles.hung} data-g="hung">
            <div className={styles.artwork} data-g="artwork">
              <MediaImage
                className={styles.artworkImage}
                image={artwork.image}
                alt={artwork.alt}
                sizes="(max-width: 767px) 40vw, 18vw"
                objectPosition={artwork.focalPoint}
                priority
              />
            </div>
            <figcaption className="visually-hidden">
              {artwork.title}, {artwork.artist}, {artwork.technique}.
            </figcaption>
          </figure>
        ) : (
          <div
            className={styles.placeholder}
            data-g="placeholder"
            role="status"
          >
            <p className={styles.placeholderTitle}>Salle en préparation</p>
            {shownRoom.medium !== 'painting' && (
              <p className={styles.placeholderHint}>
                {PLACEHOLDER_LABEL[shownRoom.medium]}
              </p>
            )}
            {/* Slot for the room's medium: 3D viewer (sculpture), stepped video (craft), player (music). */}
            <div className={styles.mediumSlot} data-medium={shownRoom.medium} />
          </div>
        )}

        {artwork !== undefined && (
          <button
            ref={cartelRef}
            type="button"
            className={styles.cartel}
            data-g="cartel"
            onClick={() => {
              setLayer('notice');
            }}
            aria-haspopup="dialog"
          >
            <span className={styles.cartelNumber}>
              {artwork.number} / {pad(total)}
            </span>
            <span className={styles.cartelTitle}>{artwork.title}</span>
            <span className={styles.cartelTechnique}>
              {artwork.artist}
              <br />
              {artwork.technique}
            </span>
            <span className={styles.cartelLink}>Lire la notice</span>
          </button>
        )}

        <p className="visually-hidden" aria-live="polite" aria-atomic="true">
          {artwork === undefined
            ? `${wallTitle}. Salle en préparation.`
            : `Œuvre ${artwork.number} sur ${pad(total)} : ${artwork.title}, ${artwork.technique}.`}
        </p>
      </main>

      <footer className={styles.bottomBar} data-g="bottombar">
        <nav className={styles.roomTabs} aria-label="Salles">
          {rooms.map((candidate) => (
            <NavLink
              key={candidate.slug}
              to={roomPath(candidate)}
              theme="dark"
              current={candidate.slug === room.slug}
            >
              {candidate.name}
            </NavLink>
          ))}
        </nav>
        <div className={styles.artworkNav}>
          <button
            type="button"
            className={styles.navArrow}
            onClick={() => {
              go(-1);
            }}
            disabled={total < 2}
            aria-label="Œuvre précédente"
          >
            <img src={backPaper} width={16} height={16} alt="" />
          </button>
          <span className={styles.counter} data-g="counter">
            {artwork === undefined
              ? `Salle ${shownRoom.number}`
              : `Œuvre ${artwork.number} / ${pad(total)}`}
          </span>
          <button
            type="button"
            className={styles.navArrow}
            onClick={() => {
              go(1);
            }}
            disabled={total < 2}
            aria-label="Œuvre suivante"
          >
            <img src={nextPaper} width={16} height={16} alt="" />
          </button>
        </div>
        <div className={styles.actions}>
          <button
            ref={closeUpButtonRef}
            type="button"
            className={cx(styles.glassButton, styles.closeUpButton)}
            onClick={() => {
              setLayer('closeUp');
            }}
            disabled={artwork === undefined}
            aria-haspopup="dialog"
          >
            <img src={zoomPaper} width={18} height={18} alt="" />
            <span>Observer de près</span>
          </button>
        </div>
      </footer>

      <div className={styles.curtain} data-g="curtain" aria-hidden="true" />

      <GalleryDialog
        open={layer === 'notice' && artwork !== undefined}
        onClose={() => {
          setLayer(null);
        }}
        labelledBy={ids.notice}
        variant="side"
        reducedMotion={reducedMotion}
        returnFocusRef={cartelRef}
      >
        {(close) =>
          artwork !== undefined && (
            <ArtworkNotice
              room={shownRoom}
              artwork={artwork}
              titleId={ids.notice}
              onClose={close}
            />
          )
        }
      </GalleryDialog>

      <GalleryDialog
        open={layer === 'closeUp' && artwork !== undefined}
        onClose={() => {
          setLayer(null);
        }}
        labelledBy={ids.closeUp}
        variant="fullscreen"
        reducedMotion={reducedMotion}
        returnFocusRef={closeUpButtonRef}
      >
        {(close) =>
          artwork !== undefined && (
            <CloseUpViewer
              artwork={artwork}
              titleId={ids.closeUp}
              onClose={close}
            />
          )
        }
      </GalleryDialog>

      <GalleryDialog
        open={layer === 'wallText'}
        onClose={() => {
          setLayer(null);
        }}
        labelledBy={ids.wallText}
        variant="sheet"
        reducedMotion={reducedMotion}
      >
        {(close) => (
          <article className={styles.sheet}>
            <p className={styles.wallLabel}>
              Salle {shownRoom.number} · {shownRoom.name}
            </p>
            <h2 id={ids.wallText} className={styles.sheetTitle}>
              {wallTitle}
            </h2>
            <p className={styles.sheetSubtitle}>{shownRoom.subtitle}</p>
            {shownRoom.wallText.map((paragraph) => (
              <p key={paragraph} className={styles.sheetBody}>
                {paragraph}
              </p>
            ))}
            <button type="button" className={styles.sheetClose} onClick={close}>
              Fermer
            </button>
          </article>
        )}
      </GalleryDialog>

      <GalleryDialog
        open={layer === 'roomMenu'}
        onClose={() => {
          setLayer(null);
        }}
        labelledBy={ids.roomMenu}
        variant="sheet"
        reducedMotion={reducedMotion}
      >
        {(close) => (
          <nav className={styles.sheet} aria-labelledby={ids.roomMenu}>
            <h2 id={ids.roomMenu} className={styles.sheetTitle}>
              Salles
            </h2>
            <ul className={styles.roomList}>
              {rooms.map((candidate) => (
                <li key={candidate.slug}>
                  <Link
                    to={roomPath(candidate)}
                    className={styles.roomListLink}
                    aria-current={
                      candidate.slug === room.slug ? 'page' : undefined
                    }
                    onClick={close}
                  >
                    <span className={styles.roomListNumber}>
                      {candidate.number}
                    </span>
                    {candidate.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </GalleryDialog>
    </div>
  );
}
