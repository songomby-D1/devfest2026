import type { TransitionVariant } from './motion-prefs';

/** How the visitor left the previous screen, so the next one can continue it. */
export type Arrival = TransitionVariant | 'fade';

let pending: Arrival | null = null;

export function markArrival(arrival: Arrival): void {
  pending = arrival;
}

/** Returns the pending arrival once, then clears it. Deep links get `null`. */
export function takeArrival(): Arrival | null {
  const arrival = pending;
  pending = null;
  return arrival;
}
