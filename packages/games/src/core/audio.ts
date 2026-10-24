import { createStorage } from "./storage";

/** A looping music track; quiet while the game is held. */
export interface MusicLoop {
  /** Fade to silence (game paused, tab hidden) without losing the place. */
  hold(): void;
  release(): void;
  stop(): void;
}

export interface ToneOptions {
  freq: number;
  /** Frequency at the end of the tone, for chirps and drops. */
  to?: number;
  dur?: number;
  type?: OscillatorType;
  vol?: number;
  delay?: number;
}

/**
 * Tiny synth shared by all games, so the portal's mute button works everywhere
 * and no game has to ship audio files.
 */
export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private listeners = new Set<(muted: boolean) => void>();
  /** Loops asked for before the first gesture unlocked audio. */
  private waiting: (() => void)[] = [];
  private prefs = createStorage("portal");
  muted = this.prefs.get("muted", false);

  /** Browsers only allow audio after a user gesture; call from a tap handler. */
  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    for (const start of this.waiting.splice(0)) start();
  }

  /**
   * Loop a music file through the master volume (so the portal's mute applies).
   * It starts once audio is unlocked; `volume` is relative to the sound effects.
   */
  loop(url: string, volume = 0.35): MusicLoop {
    let source: AudioBufferSourceNode | null = null;
    let gain: GainNode | null = null;
    let stopped = false;
    let held = false;
    const start = () => {
      const ctx = this.ctx;
      const master = this.master;
      if (!ctx || !master || stopped) return;
      void fetch(url)
        .then((r) => r.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data))
        .then((buffer) => {
          if (stopped) return;
          gain = ctx.createGain();
          gain.gain.value = held ? 0 : volume;
          gain.connect(master);
          source = ctx.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          source.connect(gain);
          source.start();
        })
        .catch(() => undefined);
    };
    if (this.ctx) start();
    else this.waiting.push(start);
    const fade = (to: number) => {
      if (!gain || !this.ctx) return;
      gain.gain.cancelScheduledValues(this.ctx.currentTime);
      gain.gain.setTargetAtTime(to, this.ctx.currentTime, 0.25);
    };
    return {
      hold: () => {
        held = true;
        fade(0);
      },
      release: () => {
        held = false;
        fade(volume);
      },
      stop: () => {
        stopped = true;
        this.waiting = this.waiting.filter((w) => w !== start);
        try {
          source?.stop();
        } catch {
          // never started
        }
        gain?.disconnect();
      },
    };
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.prefs.set("muted", muted);
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
    for (const fn of this.listeners) fn(muted);
  }

  onMuteChange(fn: (muted: boolean) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  tone({
    freq,
    to,
    dur = 0.12,
    type = "square",
    vol = 0.2,
    delay = 0,
  }: ToneOptions) {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur = 0.15, vol = 0.15) {
    if (!this.ctx || !this.master || this.muted) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++)
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.buffer = buf;
    src.connect(gain).connect(this.master);
    src.start();
  }
}

export const audioBus = new AudioBus();
