// Tiny WebAudio synth — no audio files. Every effect is generated.
// Muted state persists; the context lazily resumes on first user gesture.

let ctx: AudioContext | null = null;
let muted = typeof localStorage !== 'undefined' && localStorage.getItem('sfxMuted') === '1';

export function isMuted() { return muted; }
export function setMuted(m: boolean) {
  muted = m;
  localStorage.setItem('sfxMuted', m ? '1' : '0');
}

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  at: number,
  dur: number,
  type: OscillatorType = 'sine',
  gain = 0.07,
  slideTo?: number,
) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  /** Short rattle of clicks — a die tumbling. */
  dice() {
    for (let i = 0; i < 6; i++) {
      tone(700 + Math.random() * 900, i * 0.055, 0.03, 'square', 0.035);
    }
    tone(420, 0.36, 0.1, 'triangle', 0.06);
  },
  /** Two quick coin pings — money changed hands. */
  coin() {
    tone(880, 0, 0.09, 'triangle', 0.06);
    tone(1318, 0.07, 0.12, 'triangle', 0.055);
  },
  /** Lower thunk + ping — money left you (rent, tax, toll). */
  pay() {
    tone(220, 0, 0.1, 'triangle', 0.07);
    tone(330, 0.08, 0.1, 'triangle', 0.05);
  },
  /** Ascending gold arpeggio — jackpot, big win. */
  jackpot() {
    [523, 659, 784, 1047, 1318].forEach((f, i) => tone(f, i * 0.09, 0.22, 'triangle', 0.07));
  },
  /** Sad slide down — wager lost, bad card. */
  lose() {
    tone(330, 0, 0.3, 'sawtooth', 0.04, 165);
  },
  /** Warm chord — salary day, suit collected. */
  salary() {
    tone(523, 0, 0.3, 'sine', 0.05);
    tone(659, 0.02, 0.3, 'sine', 0.05);
    tone(784, 0.04, 0.35, 'sine', 0.05);
  },
  /** Two low beeps — debt, bankruptcy, warnings. */
  alert() {
    tone(196, 0, 0.16, 'square', 0.05);
    tone(147, 0.2, 0.24, 'square', 0.05);
  },
};
