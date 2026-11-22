import { useSyncExternalStore } from 'react';

/*
 * Room ambience shared by the home page and the gallery. Sound is off by
 * default and only `enable()` starts it, which callers run from a click or a
 * key press. Fades use a Web Audio gain node, because iOS ignores
 * HTMLMediaElement.volume.
 */

export interface AmbienceTrack {
  id: string;
  label: string;
  src: string;
}

export type AmbienceStatus = 'off' | 'loading' | 'playing' | 'unavailable';

export interface AmbienceState {
  enabled: boolean;
  status: AmbienceStatus;
  track: AmbienceTrack | null;
}

export const FADE_IN_SECONDS = 1.5;
const FADE_OUT_SECONDS = 0.6;
const CROSSFADE_SECONDS = 1.5;

interface Voice {
  track: AmbienceTrack;
  element: HTMLAudioElement;
  gain: GainNode | null;
}

type Listener = () => void;

const INITIAL_STATE: AmbienceState = {
  enabled: false,
  status: 'off',
  track: null,
};

const listeners = new Set<Listener>();
let state: AmbienceState = INITIAL_STATE;
let audioContext: AudioContext | null = null;
let voice: Voice | null = null;

function setState(patch: Partial<AmbienceState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) {
    listener();
  }
}

function getAudioContext(): AudioContext | null {
  if (audioContext === null && 'AudioContext' in window) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function ramp(gain: GainNode, target: number, seconds: number): void {
  const now = gain.context.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(target, now + seconds);
}

function startVoice(track: AmbienceTrack, fadeSeconds: number): void {
  const element = new Audio();
  element.loop = true;
  element.preload = 'auto';
  element.src = track.src;

  const context = getAudioContext();
  let gain: GainNode | null = null;
  if (context !== null) {
    gain = context.createGain();
    gain.gain.value = 0;
    context.createMediaElementSource(element).connect(gain);
    gain.connect(context.destination);
    void context.resume();
  }

  const next: Voice = { track, element, gain };
  voice = next;
  setState({ status: 'loading' });

  element.addEventListener(
    'error',
    () => {
      if (voice === next) {
        setState({ status: 'unavailable' });
      }
    },
    { once: true },
  );

  element.play().then(
    () => {
      if (voice !== next) {
        return;
      }
      setState({ status: 'playing' });
      if (gain !== null) {
        ramp(gain, 1, fadeSeconds);
      }
    },
    (_error: unknown) => {
      if (voice === next) {
        setState({ status: 'unavailable' });
      }
    },
  );
}

function stopVoice(stopping: Voice, fadeSeconds: number): void {
  const { element, gain } = stopping;
  const release = (): void => {
    element.pause();
    element.removeAttribute('src');
    gain?.disconnect();
  };
  if (gain === null) {
    release();
    return;
  }
  ramp(gain, 0, fadeSeconds);
  window.setTimeout(release, fadeSeconds * 1000 + 50);
}

function getState(): AmbienceState {
  return state;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const ambience = {
  getState,
  subscribe,

  /** Starts sound with a 1.5 s fade. Call it only from a user gesture. */
  enable(): void {
    if (state.enabled) {
      return;
    }
    setState({ enabled: true });
    if (state.track !== null) {
      startVoice(state.track, FADE_IN_SECONDS);
    }
  },

  disable(): void {
    if (!state.enabled) {
      return;
    }
    setState({ enabled: false, status: 'off' });
    if (voice !== null) {
      stopVoice(voice, FADE_OUT_SECONDS);
      voice = null;
    }
  },

  toggle(): void {
    if (state.enabled) {
      ambience.disable();
    } else {
      ambience.enable();
    }
  },

  /** Selects the room track. Plays only when the visitor already enabled sound. */
  setTrack(track: AmbienceTrack | null): void {
    if (state.track?.id === track?.id) {
      return;
    }
    setState({ track });
    if (!state.enabled) {
      return;
    }
    if (voice !== null) {
      stopVoice(voice, CROSSFADE_SECONDS);
      voice = null;
    }
    if (track === null) {
      setState({ status: 'off' });
    } else {
      startVoice(track, CROSSFADE_SECONDS);
    }
  },

  /** Stops playback and forgets the state. Used when the app unmounts and in tests. */
  reset(): void {
    if (voice !== null) {
      stopVoice(voice, 0);
      voice = null;
    }
    state = INITIAL_STATE;
    for (const listener of listeners) {
      listener();
    }
  },
};

export function useAmbience(): AmbienceState {
  return useSyncExternalStore(subscribe, getState, () => INITIAL_STATE);
}
