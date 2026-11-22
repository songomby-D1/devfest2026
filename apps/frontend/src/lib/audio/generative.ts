/*
 * The LOVA ambience, generated live like on the landing page: a warm pad and
 * plucked notes in the manner of a valiha, in D major pentatonic. No audio
 * file, so it always plays, light on data and free of rights questions.
 */

/** D major pentatonic over two octaves, the valiha's bright, open colour. */
const SCALE = [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25, 739.99];
/** D, A, D, A: an open fifth drone under the plucks. */
const PAD = [73.42, 110, 146.83, 220];

export interface GenerativeAmbience {
  start(fadeSeconds: number): void;
  stop(fadeSeconds: number): void;
}

export function createGenerativeAmbience(
  context: AudioContext,
  destination: AudioNode = context.destination,
): GenerativeAmbience {
  const master = context.createGain();
  master.gain.value = 0;
  master.connect(destination);

  // A soft echo shared by the plucks.
  const delay = context.createDelay(1);
  delay.delayTime.value = 0.36;
  const feedback = context.createGain();
  feedback.gain.value = 0.3;
  const wet = context.createGain();
  wet.gain.value = 0.32;
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);
  wet.connect(master);

  // The pad breathes through a slowly moving low-pass filter.
  const lowpass = context.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 680;
  lowpass.Q.value = 0.4;
  const padGain = context.createGain();
  padGain.gain.value = 0.045;
  lowpass.connect(padGain);
  padGain.connect(master);
  const sources: OscillatorNode[] = [];
  PAD.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = index % 2 === 0 ? 'sine' : 'triangle';
    oscillator.frequency.value = frequency;
    oscillator.detune.value = (index - 1.5) * 4;
    oscillator.connect(lowpass);
    sources.push(oscillator);
  });
  const lfo = context.createOscillator();
  lfo.frequency.value = 0.06;
  const lfoDepth = context.createGain();
  lfoDepth.gain.value = 240;
  lfo.connect(lfoDepth);
  lfoDepth.connect(lowpass.frequency);
  sources.push(lfo);

  let started = false;
  let playing = false;
  let timer: number | undefined;
  let lastIndex = 3;

  /** One plucked note, a step or two away from the last one, then the next in 0.8 to 2.6 s. */
  function pluck(): void {
    if (!playing) return;
    const now = context.currentTime;
    const step = Math.round((Math.random() - 0.5) * 4);
    lastIndex = Math.min(SCALE.length - 1, Math.max(0, lastIndex + step));
    const base = SCALE[lastIndex] ?? 440;
    const frequency = Math.random() < 0.18 ? base / 2 : base;

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(0.075, now + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 2);
    const tone = context.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2200;
    [1, 2, 3.01].forEach((ratio, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index === 0 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency * ratio;
      const partial = context.createGain();
      partial.gain.value = [1, 0.32, 0.1][index] ?? 0;
      oscillator.connect(partial);
      partial.connect(tone);
      oscillator.start(now);
      oscillator.stop(now + 2.2);
    });
    tone.connect(envelope);
    envelope.connect(master);
    envelope.connect(delay);
    timer = window.setTimeout(pluck, 800 + Math.random() * 1800);
  }

  return {
    start(fadeSeconds) {
      if (!started) {
        for (const source of sources) source.start();
        started = true;
      }
      void context.resume();
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0.85, now + fadeSeconds);
      if (!playing) {
        playing = true;
        window.clearTimeout(timer);
        timer = window.setTimeout(pluck, 400);
      }
    },
    stop(fadeSeconds) {
      playing = false;
      window.clearTimeout(timer);
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + Math.max(fadeSeconds, 0.05));
    },
  };
}
