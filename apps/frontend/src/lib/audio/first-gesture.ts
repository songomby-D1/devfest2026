import { useEffect } from 'react';
import { ambience, soundPreference } from './ambience';

/**
 * Background music for the home: browsers only allow sound after a gesture,
 * so the ambience fades in on the visitor's first click, tap or key press,
 * unless they switched it off before. The sound toggle stays the control:
 * a gesture on it is left to the toggle itself.
 */
export function useAmbienceOnFirstGesture(active = true): void {
  useEffect(() => {
    if (!active || soundPreference() === 'off') {
      return;
    }
    function start(event: Event): void {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-sound-toggle]')) {
        detach();
        return;
      }
      if (event instanceof KeyboardEvent && event.key.toLowerCase() === 'm') {
        detach();
        return;
      }
      ambience.enable();
      detach();
    }
    function detach(): void {
      window.removeEventListener('pointerdown', start, true);
      window.removeEventListener('keydown', start, true);
    }
    window.addEventListener('pointerdown', start, true);
    window.addEventListener('keydown', start, true);
    return detach;
  }, [active]);
}
