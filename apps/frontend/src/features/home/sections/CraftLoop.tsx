import type { RefObject } from 'react';
import { useCallback, useRef, useState } from 'react';
import { MediaImage } from '../../../components/media-image/MediaImage';
import { cx } from '../../../lib/cx';
import type { ImageSource } from '../../../lib/media/media';
import { useReducedMotion } from '../../../lib/motion/reduced-motion';
import styles from './CraftLoop.module.css';
import { useScrollScene, wideViewport } from './useScrollScene';

const STEPS = [
  {
    label: '01 Récolter',
    text: 'L’artisan récolte la matière : écorce d’havoa, soie, raphia, bois.',
    caption: 'La matière',
  },
  {
    label: '02 Préparer',
    text: 'Il la travaille jusqu’à en faire un support : un fil, une feuille, une planche.',
    caption: 'Le support',
  },
  {
    label: '03 Créer',
    text: 'L’artiste transforme ce support en œuvre.',
    caption: 'L’œuvre',
  },
  {
    label: '04 Rendre',
    text: 'En retour, l’artiste commande, partage ses motifs et fait connaître l’atelier. LOVA crédite les deux.',
    caption: 'Les deux crédités',
  },
] as const;

const MATERIALS = [
  { name: 'Soie landy', swatch: 'var(--brand-sand)' },
  { name: 'Raphia', swatch: '#cdb67a' },
  { name: 'Palissandre', swatch: 'var(--brand-wood)' },
  { name: 'Écorce d’havoa', swatch: 'var(--brand-ochre)' },
  { name: 'Corne de zébu', swatch: '#2a2622' },
  { name: 'Bambou', swatch: 'var(--brand-green)' },
  { name: 'Terre cuite', swatch: 'var(--brand-terracotta)' },
] as const;

export interface CraftLoopProps {
  scrollerRef: RefObject<HTMLElement | null>;
  /** A published work for step 03, when the collection has one. */
  work: { image: ImageSource; alt: string; title: string } | null;
}

/**
 * "Des artisans aux artistes, et retour", the landing's craft loop: the page
 * scrolls through four steps while the porthole turns matter into a support,
 * a work, then the LOVA mark. The matter and the support are drawn in CSS;
 * the work is one from the collection. Static list on small screens and with
 * reduced motion.
 */
export function CraftLoop({ scrollerRef, work }: CraftLoopProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const lastStep = useRef(-1);
  const reducedMotion = useReducedMotion();
  const [pinned] = useState(() => wideViewport());
  const enabled = pinned && !reducedMotion;

  const onFrame = useCallback(({ progress }: { progress: number }) => {
    const stage = stageRef.current;
    const section = sectionRef.current;
    if (stage === null || section === null) return;
    section.style.setProperty('--p', progress.toFixed(4));
    const step = Math.min(
      STEPS.length - 1,
      Math.floor(progress * STEPS.length),
    );
    if (step !== lastStep.current) {
      lastStep.current = step;
      stage.dataset['step'] = String(step);
    }
  }, []);

  useScrollScene(scrollerRef, sectionRef, { onFrame, enabled });

  return (
    <section
      ref={sectionRef}
      className={styles.flow}
      data-pinned={enabled ? 'true' : 'false'}
      aria-labelledby="flow-title"
    >
      <div ref={stageRef} className={styles.stage} data-step="0">
        <div className={styles.weave} aria-hidden="true" />
        <div className={styles.head}>
          <span className={styles.tag}>Matière ↔ Œuvre</span>
          <h2 id="flow-title" className={styles.title}>
            Des artisans
            <br />
            aux artistes,
            <br />
            et retour
          </h2>
        </div>

        {/* Pinned, the window shows the current step and the next; the list rises as the page scrolls. */}
        <div className={styles.stepsWindow}>
          <ol className={styles.steps}>
            {STEPS.map((step, index) => (
              <li key={step.label} className={styles.step} data-index={index}>
                <span>{step.label}</span>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className={styles.map} aria-hidden="true">
          <svg className={styles.arcs} viewBox="0 0 1200 760">
            <path
              className={styles.arcTop}
              d="M240 380 C330 70 870 70 960 380"
              pathLength={1}
            />
            <path
              className={styles.arcBottom}
              d="M960 380 C870 690 330 690 240 380"
              pathLength={1}
            />
          </svg>
          <div className={cx(styles.node, styles.nodeA)}>
            <span className={styles.dot} />
            <b>Artisans</b>
            <small>récoltent · filent · préparent</small>
          </div>
          <div className={cx(styles.node, styles.nodeB)}>
            <span className={styles.dot} />
            <b>Artistes</b>
            <small>sculptent · tissent · peignent</small>
          </div>

          <div className={styles.core}>
            <div className={styles.porthole}>
              <span className={styles.matter} data-for="0" />
              <span className={styles.sheet} data-for="1" />
              <span className={styles.work} data-for="2">
                {work !== null && (
                  <MediaImage
                    className={styles.workImage}
                    image={work.image}
                    alt=""
                    sizes="220px"
                  />
                )}
              </span>
              <span className={styles.brand} data-for="3">
                <svg viewBox="36 78 356 304" focusable="false">
                  <use href="/brand/lova.svg#lova" />
                </svg>
              </span>
            </div>
            <p className={styles.caption}>
              {STEPS.map((step, index) => (
                <span key={step.caption} data-for={index}>
                  {index === 2 && work !== null ? work.title : step.caption}
                </span>
              ))}
            </p>
          </div>

          <ul className={styles.chips}>
            {MATERIALS.map((material, index) => (
              <li
                key={material.name}
                style={{
                  ['--sw' as string]: material.swatch,
                  ['--i' as string]: index,
                }}
              >
                <i />
                {material.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
