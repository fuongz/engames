import { createStorage } from "./storage";

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

  tone({ freq, to, dur = 0.12, type = "square", vol = 0.2, delay = 0 }: ToneOptions) {
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
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.buffer = buf;
    src.connect(gain).connect(this.master);
    src.start();
  }
}

export const audioBus = new AudioBus();
