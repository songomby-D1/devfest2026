import { useEffect, useRef, useState } from 'react';

/** Milliseconds per typed character, like the Haj'Aina storyteller (typed.js at 20 ms). */
const TYPE_INTERVAL_MS = 20;
/** Pause after a chapter before the storyline moves deeper. */
const PAUSE_AFTER_MS = 900;
/** Reading time when the voice is off or unavailable. */
const READ_MS_PER_CHARACTER = 32;
const MIN_READ_MS = 2200;
/** Some browsers never fire `end`: give up waiting after the expected speech time. */
const SPEECH_MS_PER_CHARACTER = 95;
const SPEECH_MARGIN_MS = 4000;

export function speechAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

function frenchVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((voice) => voice.lang === 'fr-FR') ??
    voices.find((voice) => voice.lang.startsWith('fr')) ??
    null
  );
}

export interface NarratorOptions {
  readonly text: string;
  /** True while the storyline plays: type, speak, then call `onFinished`. */
  readonly playing: boolean;
  readonly voice: boolean;
  readonly reducedMotion: boolean;
  readonly onFinished: () => void;
}

export interface Narrator {
  /** Number of characters shown; the whole text when not playing. */
  readonly shown: number;
  readonly speaking: boolean;
}

/**
 * The storyteller: types the chapter text, reads it aloud in French, then
 * hands over so the storyline can travel to the next chapter.
 */
export function useNarrator({
  text,
  playing,
  voice,
  reducedMotion,
  onFinished,
}: NarratorOptions): Narrator {
  const [shown, setShown] = useState(text.length);
  const [speaking, setSpeaking] = useState(false);
  const finished = useRef(onFinished);

  useEffect(() => {
    finished.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    if (!playing) {
      setShown(text.length);
      return undefined;
    }

    let cancelled = false;
    const timers: number[] = [];
    const later = (callback: () => void, ms: number): void => {
      timers.push(
        window.setTimeout(() => {
          if (!cancelled) callback();
        }, ms),
      );
    };
    const handOver = (): void => {
      later(() => {
        finished.current();
      }, PAUSE_AFTER_MS);
    };

    const narrate = (): void => {
      if (!voice || !speechAvailable()) {
        later(
          handOver,
          Math.max(MIN_READ_MS, text.length * READ_MS_PER_CHARACTER),
        );
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      utterance.rate = 0.98;
      const chosen = frenchVoice();
      if (chosen !== null) utterance.voice = chosen;
      let done = false;
      const end = (): void => {
        if (done || cancelled) return;
        done = true;
        setSpeaking(false);
        handOver();
      };
      utterance.addEventListener('end', end);
      utterance.addEventListener('error', end);
      setSpeaking(true);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      later(end, text.length * SPEECH_MS_PER_CHARACTER + SPEECH_MARGIN_MS);
    };

    if (reducedMotion) {
      setShown(text.length);
      narrate();
    } else {
      setShown(0);
      let count = 0;
      const typing = window.setInterval(() => {
        count += 1;
        setShown(count);
        if (count >= text.length) {
          window.clearInterval(typing);
          if (!cancelled) narrate();
        }
      }, TYPE_INTERVAL_MS);
      timers.push(typing);
    }

    return () => {
      cancelled = true;
      for (const timer of timers) {
        window.clearTimeout(timer);
        window.clearInterval(timer);
      }
      if (speechAvailable()) window.speechSynthesis.cancel();
      setSpeaking(false);
    };
  }, [text, playing, voice, reducedMotion]);

  return { shown: Math.min(shown, text.length), speaking };
}
