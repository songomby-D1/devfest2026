import { useState } from 'react';
import type {
  IntroVariant,
  TransitionVariant,
} from '../lib/motion/motion-prefs';
import {
  introVariants,
  setMotionPrefs,
  transitionVariants,
  useMotionPrefs,
} from '../lib/motion/motion-prefs';
import {
  setForcedReducedMotion,
  useReducedMotion,
} from '../lib/motion/reduced-motion';
import { navigate } from '../lib/router/router';
import styles from './MotionLab.module.css';

const INTRO_LABEL: Record<IntroVariant, string> = {
  hanging: 'A · Accrochage',
  light: 'B · Lumière de salle',
  focus: 'C · Mise au point',
};

const TRANSITION_LABEL: Record<TransitionVariant, string> = {
  'gallery-black': 'A · Noir galerie',
  'through-frame': 'B · Traversée du cadre',
  curtain: 'C · Rideau de salle',
};

/**
 * Development-only panel to compare intro and transition variants. It mounts
 * only with `?motion=lab` in a dev build and is removed once a variant is
 * chosen.
 */
export function MotionLab() {
  const prefs = useMotionPrefs();
  const reduced = useReducedMotion();
  const [forced, setForced] = useState(false);

  const replay = (): void => {
    navigate('/', { replace: true });
    window.location.reload();
  };

  return (
    <aside className={styles.lab} aria-label="Motion lab">
      <p className={styles.title}>Motion lab · dev</p>
      <fieldset className={styles.group}>
        <legend>Intro</legend>
        {introVariants.map((variant) => (
          <label key={variant} className={styles.option}>
            <input
              type="radio"
              name="intro"
              checked={prefs.intro === variant}
              onChange={() => {
                setMotionPrefs({ intro: variant });
              }}
            />
            {INTRO_LABEL[variant]}
          </label>
        ))}
      </fieldset>
      <fieldset className={styles.group}>
        <legend>Transition</legend>
        {transitionVariants.map((variant) => (
          <label key={variant} className={styles.option}>
            <input
              type="radio"
              name="transition"
              checked={prefs.transition === variant}
              onChange={() => {
                setMotionPrefs({ transition: variant });
              }}
            />
            {TRANSITION_LABEL[variant]}
          </label>
        ))}
      </fieldset>
      <label className={styles.option}>
        <input
          type="checkbox"
          checked={forced}
          onChange={(event) => {
            setForced(event.target.checked);
            setForcedReducedMotion(event.target.checked ? true : null);
          }}
        />
        Mouvement réduit {reduced ? '(actif)' : ''}
      </label>
      <button type="button" className={styles.replay} onClick={replay}>
        Rejouer l’intro
      </button>
    </aside>
  );
}
