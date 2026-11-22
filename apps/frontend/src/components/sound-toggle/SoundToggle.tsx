import { useEffect } from 'react';
import soundInk from '../../assets/icons/sound-ink.svg';
import soundOffPaper from '../../assets/icons/sound-off-paper.svg';
import soundOnPaper from '../../assets/icons/sound-on-paper.svg';
import type { AmbienceState } from '../../lib/audio/ambience';
import { ambience, useAmbience } from '../../lib/audio/ambience';
import { cx } from '../../lib/cx';
import styles from './SoundToggle.module.css';

export type SoundToggleTheme = 'light' | 'dark';

export interface SoundToggleProps {
  theme: SoundToggleTheme;
  /** Shows only the icon, keeping the label for assistive technologies. */
  compact?: boolean | undefined;
  className?: string | undefined;
}

export function soundLabel(
  theme: SoundToggleTheme,
  sound: AmbienceState,
): string {
  if (!sound.enabled) {
    return theme === 'light' ? 'Son coupé' : 'Activer le son';
  }
  if (sound.status === 'unavailable') {
    return 'Son indisponible';
  }
  if (theme === 'dark' && sound.track !== null) {
    return `${sound.track.label} · en lecture`;
  }
  return 'Son activé';
}

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/** The M key toggles sound, as the Figma SoundToggle component specifies. */
function useSoundShortcut(): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const plainKey = !event.metaKey && !event.ctrlKey && !event.altKey;
      if (
        event.key.toLowerCase() === 'm' &&
        plainKey &&
        !event.repeat &&
        !isEditable(event.target)
      ) {
        ambience.toggle();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}

/**
 * Figma components SoundToggle (light) and Contrôle son (dark). Sound is off by
 * default and never starts without a click or the M key. aria-pressed reports
 * the state.
 */
export function SoundToggle({
  theme,
  compact = false,
  className,
}: SoundToggleProps) {
  const sound = useAmbience();
  useSoundShortcut();

  const label = soundLabel(theme, sound);
  const icon =
    theme === 'light'
      ? sound.enabled
        ? soundOnPaper
        : soundInk
      : sound.enabled
        ? soundOnPaper
        : soundOffPaper;
  const iconSize = theme === 'light' ? 16 : 18;

  return (
    <button
      type="button"
      className={cx(
        styles.toggle,
        styles[theme],
        compact && styles.compact,
        className,
      )}
      aria-pressed={sound.enabled}
      aria-keyshortcuts="M"
      onClick={() => {
        ambience.toggle();
      }}
    >
      <img
        className={cx(
          styles.icon,
          theme === 'light' && sound.enabled && styles.inkIcon,
        )}
        src={icon}
        width={iconSize}
        height={iconSize}
        alt=""
      />
      <span className={cx(compact && 'visually-hidden')}>{label}</span>
    </button>
  );
}
