/**
 * Optional ambience, synthesised with Web Audio so there are no audio files to load.
 * Off by default; nothing is created until the visitor turns it on (browsers require a gesture anyway).
 */
type Blip = 'key' | 'enter' | 'switch' | 'whoosh' | 'quack' | 'boom' | 'warning';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let on = false;
const listeners = new Set<(on: boolean) => void>();

function setup(): AudioContext {
  if (ctx) return ctx;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  // Brown noise: soft, rain-on-the-window rumble.
  const len = ctx.sampleRate * 4;
  noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noise.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }

  const rain = ctx.createBufferSource();
  rain.buffer = noise;
  rain.loop = true;
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 900;
  const rainGain = ctx.createGain();
  rainGain.gain.value = 0.28;
  rain.connect(low).connect(rainGain).connect(master);
  rain.start();

  // A faint high hiss on top, slowly swelling like gusts.
  const hiss = ctx.createBufferSource();
  hiss.buffer = noise;
  hiss.loop = true;
  hiss.playbackRate.value = 4;
  const high = ctx.createBiquadFilter();
  high.type = 'highpass';
  high.frequency.value = 2400;
  const hissGain = ctx.createGain();
  hissGain.gain.value = 0.025;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.015;
  lfo.connect(lfoDepth).connect(hissGain.gain);
  lfo.start();
  hiss.connect(high).connect(hissGain).connect(master);
  hiss.start();

  return ctx;
}

export function isSoundOn(): boolean {
  return on;
}

export function setSound(next: boolean): void {
  on = next;
  const c = next ? setup() : ctx;
  if (c && master) {
    if (next) void c.resume();
    master.gain.setTargetAtTime(next ? 1 : 0, c.currentTime, next ? 0.4 : 0.12);
  }
  listeners.forEach((fn) => fn(on));
}

export function onSoundChange(fn: (on: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const BLIPS: Record<Exclude<Blip, 'quack' | 'boom' | 'warning'>, { freq: number; q: number; len: number; gain: number; rate: number }> = {
  key: { freq: 3200, q: 1.2, len: 0.035, gain: 0.5, rate: 6 },
  enter: { freq: 1800, q: 1, len: 0.06, gain: 0.6, rate: 5 },
  switch: { freq: 2400, q: 4, len: 0.05, gain: 0.9, rate: 3 },
  whoosh: { freq: 600, q: 0.7, len: 2.4, gain: 0.5, rate: 1 },
};

/** Short one-shot sounds: key clicks, the lamp switch, the jet passing by. No-op while sound is off. */
export function blip(kind: Blip): void {
  if (!on || !ctx || !master || !noise) return;
  if (kind === 'quack') return quack(ctx, master);
  if (kind === 'boom') return boom(ctx, master, noise);
  if (kind === 'warning') return warning(ctx, master);
  const { freq, q, len, gain, rate } = BLIPS[kind];
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = rate * (0.9 + Math.random() * 0.2);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = freq;
  band.Q.value = q;
  if (kind === 'whoosh') {
    band.frequency.setValueAtTime(300, t);
    band.frequency.exponentialRampToValueAtTime(1600, t + len * 0.45);
    band.frequency.exponentialRampToValueAtTime(250, t + len);
  }
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.005, len / 4) + (kind === 'whoosh' ? len * 0.4 : 0));
  env.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(band).connect(env).connect(master);
  src.start(t, Math.random() * 3);
  src.stop(t + len + 0.05);
}

/** Rubber duck: a nasal saw tone that drops in pitch, twice. */
function quack(c: AudioContext, out: AudioNode) {
  for (const delay of [0, 0.16]) {
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(620, t);
    osc.frequency.exponentialRampToValueAtTime(380, t + 0.11);
    const formant = c.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.value = 1300;
    formant.Q.value = 3;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.35, t + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(formant).connect(env).connect(out);
    osc.start(t);
    osc.stop(t + 0.14);
  }
}

/** Distant explosion: a low thump that rumbles off. */
function boom(c: AudioContext, out: AudioNode, buf: AudioBuffer) {
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = 0.6;
  const low = c.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.setValueAtTime(900, t);
  low.frequency.exponentialRampToValueAtTime(120, t + 1.2);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(1.4, t + 0.02);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  src.connect(low).connect(env).connect(out);
  src.start(t, Math.random() * 2);
  src.stop(t + 1.7);
}

/** Missile warning: four quick high beeps, like a radar warning receiver. */
function warning(c: AudioContext, out: AudioNode) {
  for (let i = 0; i < 4; i++) {
    const t = c.currentTime + i * 0.16;
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 1250;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    env.gain.setValueAtTime(0.12, t + 0.08);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(env).connect(out);
    osc.start(t);
    osc.stop(t + 0.12);
  }
}
