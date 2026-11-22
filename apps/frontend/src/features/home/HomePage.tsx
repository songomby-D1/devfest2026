import { useEffect, useRef, useState } from 'react';
import { AccountMenu } from '../../components/account-menu/AccountMenu';
import { ButtonLink } from '../../components/button-link/ButtonLink';
import { GridGuides } from '../../components/grid-guides/GridGuides';
import { Logo } from '../../components/logo/Logo';
import { NavLink } from '../../components/nav-link/NavLink';
import { SoundToggle } from '../../components/sound-toggle/SoundToggle';
import { ambience } from '../../lib/audio/ambience';
import { useAmbienceOnFirstGesture } from '../../lib/audio/first-gesture';
import { audioTracks } from '../../lib/media/media';
import type { SplitText } from '../../lib/motion/gsap';
import { useMotionPrefs } from '../../lib/motion/motion-prefs';
import { useReducedMotion } from '../../lib/motion/reduced-motion';
import { Link } from '../../lib/router/Link';
import { Exhibit } from './Exhibit';
import type { HomeExhibit, HomeExhibitId } from './home-content';
import styles from './HomePage.module.css';
import { ArtFrieze } from './sections/ArtFrieze';
import type { FriezePiece } from './sections/ArtFrieze';
import { CraftLoop } from './sections/CraftLoop';
import { Closing, Experiences } from './sections/Experiences';
import { useHomeExit } from './useHomeExit';
import { useHomeIntro } from './useHomeIntro';
import { useHomeParallax } from './useHomeParallax';

/** Home navigation labels, as in the Figma frame. */
const NAV_ITEMS = [
  { slug: 'peinture', label: 'Peintures' },
  { slug: 'sculpture', label: 'Sculptures' },
  { slug: 'savoir-faire', label: 'Artisanat' },
  { slug: 'musique', label: 'Musique' },
] as const;

const POSITION_CLASS: Record<HomeExhibitId, string | undefined> = {
  'women-in-lamba': styles.womenInLamba,
  'highlands-landscape': styles.avenueOfBaobabs,
  'vilany-tany': styles.vilanyTany,
  sinibe: styles.sinibe,
};

function navPath(slug: string): string {
  return `/musee/${slug}`;
}

const MUSEUM_ENTRY = '/musee';

export interface HomePageProps {
  /** The hanging, from the published collection. */
  exhibits: readonly HomeExhibit[];
  /** Every published work, for the immersive frieze below the fold. */
  pieces?: readonly FriezePiece[] | undefined;
}

export function HomePage({ exhibits, pieces = [] }: HomePageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const splitRef = useRef<SplitText | null>(null);
  const reducedMotion = useReducedMotion();
  const { intro, transition } = useMotionPrefs();
  const [introDone, setIntroDone] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    ambience.setTrack(audioTracks.valiha);
  }, []);
  useAmbienceOnFirstGesture();

  useHomeIntro(rootRef, {
    variant: intro,
    reducedMotion,
    splitRef,
    onComplete: () => {
      setIntroDone(true);
    },
  });
  useHomeParallax(rootRef, introDone && !reducedMotion && !exiting);
  const playExit = useHomeExit(rootRef, {
    variant: transition,
    reducedMotion,
    splitRef,
  });

  const enterMuseum = async (): Promise<void> => {
    setExiting(true);
    await playExit();
  };

  return (
    <div
      ref={rootRef}
      className={styles.home}
      data-motion="pending"
      data-intro={intro}
    >
      <header className={styles.nav} data-anim="nav" data-reveal="">
        <Link to="/" className={styles.logo} aria-label="LOVA, accueil">
          <Logo />
        </Link>
        <div className={styles.navRight}>
          <nav aria-label="Salles du musée">
            <ul className={styles.rooms}>
              {NAV_ITEMS.map((item) => (
                <li key={item.slug}>
                  <NavLink to={navPath(item.slug)} beforeNavigate={enterMuseum}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
              <li>
                <NavLink to="/expositions/1">Exposition 3D</NavLink>
              </li>
            </ul>
          </nav>
          <AccountMenu theme="light" />
          <SoundToggle theme="light" />
        </div>
      </header>

      <main>
        <div className={styles.screen}>
          <GridGuides />

          <div className={styles.stage}>
            {exhibits.map((exhibit) => (
              <Exhibit
                key={exhibit.id}
                exhibit={exhibit}
                className={POSITION_CLASS[exhibit.id]}
                beforeNavigate={enterMuseum}
              />
            ))}

            <section className={styles.hero} aria-labelledby="home-title">
              <h1
                id="home-title"
                className={styles.headline}
                data-anim="headline"
                data-reveal=""
              >
                L’art malagasy, <br />à portée <br />
                <span className={styles.accent}>de regard.</span>
              </h1>
              <p
                className={styles.description}
                data-anim="description"
                data-reveal=""
              >
                Peintures, sculptures, savoir-faire et musiques de Madagascar, à
                parcourir comme un véritable musée.
              </p>
              <div className={styles.ctas} data-anim="ctas" data-reveal="">
                <ButtonLink
                  to={MUSEUM_ENTRY}
                  variant="primary"
                  withArrow
                  beforeNavigate={enterMuseum}
                >
                  Entrer dans le musée
                </ButtonLink>
                <ButtonLink to="/contribuer" variant="secondary">
                  Déposer une œuvre
                </ButtonLink>
              </div>
            </section>
          </div>

          <footer className={styles.hud} data-anim="nav" data-reveal="">
            <span>Patrimoine malagasy</span>
            <span>Relu par des humains</span>
            <span className={styles.scrollHint}>Défiler ↓</span>
          </footer>
        </div>

        {pieces.length > 0 && (
          <ArtFrieze pieces={pieces} scrollerRef={rootRef} />
        )}
        <CraftLoop
          scrollerRef={rootRef}
          work={pieces.find((piece) => piece.image.src !== '') ?? null}
        />
        <Experiences beforeNavigate={enterMuseum} />
        <Closing beforeNavigate={enterMuseum} pieces={pieces} />
      </main>

      <div className={styles.dim} data-anim="dim" aria-hidden="true" />
      <div
        className={styles.blackout}
        data-anim="blackout"
        aria-hidden="true"
      />
    </div>
  );
}
