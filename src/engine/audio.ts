/**
 * Every sound is synthesised with WebAudio — no audio files. Each effect is a short
 * recipe of oscillator sweeps and filtered noise bursts.
 */
export type Sfx =
  | 'jump'
  | 'walljump'
  | 'land'
  | 'dash'
  | 'refill'
  | 'slash'
  | 'hit'
  | 'hurt'
  | 'die'
  | 'enemyDie'
  | 'soul'
  | 'checkpoint'
  | 'powerup'
  | 'shoot'
  | 'reflect'
  | 'charge'
  | 'growl'
  | 'blip'
  | 'select'
  | 'break'
  | 'gate'
  | 'slam'
  | 'roar'
  | 'explode'
  | 'chug'
  | 'whistle';

export interface MusicDef {
  bpm: number;
  /** MIDI note of the key's root. */
  root: number;
  /** Scale as semitone offsets from the root. */
  scale: number[];
  /** Chord root (scale degree) for each bar. */
  bars: number[];
  /** 16-step melody per bar, cycled: digits are scale degrees above the chord root, '.' is a rest. */
  melody: string[];
  lead: OscillatorType;
  bass: OscillatorType;
  /** Probability of an extra random grace note on an empty step: keeps loops from feeling static. */
  sparkle?: number;
  /** Percussion: 'soft' kick + hats, 'driving' adds snares and busier hats (bosses, action). */
  drums?: 'soft' | 'driving';
}

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
  ctx: AudioContext | null = null;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  musicOn = true;

  private song: MusicDef | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;

  /** Must be called from a user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.32 : 0;
    this.musicBus.connect(master);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (this.song) this.startSong();
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.32 : 0, this.ctx.currentTime, 0.1);
  }

  /** Play a synth tone (custom sound effects): type, start/end Hz, seconds, volume. */
  tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, at = 0, bus?: GainNode) {
    const c = this.ctx;
    if (!c) return;
    const t = at || c.currentTime;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Play filtered noise (custom sound effects): seconds, volume, filter type, start/end cutoff Hz. */
  noise(dur: number, vol: number, type: BiquadFilterType, f0: number, f1: number, at = 0, bus?: GainNode) {
    const c = this.ctx;
    if (!c) return;
    const t = at || c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = type === 'bandpass' ? 1.4 : 0.7;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus ?? this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  play(s: Sfx) {
    const c = this.ctx;
    if (!c) return;
    const now = c.currentTime;
    switch (s) {
      case 'jump':
        this.tone('square', 240, 470, 0.09, 0.07);
        break;
      case 'walljump':
        this.tone('square', 280, 560, 0.09, 0.07);
        this.noise(0.06, 0.12, 'highpass', 3000, 1500);
        break;
      case 'land':
        this.noise(0.07, 0.18, 'lowpass', 900, 200);
        break;
      case 'dash':
        this.noise(0.2, 0.3, 'bandpass', 3500, 500);
        this.tone('sawtooth', 180, 90, 0.16, 0.05);
        break;
      case 'refill':
        this.tone('triangle', 990, 1320, 0.07, 0.08);
        break;
      case 'slash':
        this.noise(0.09, 0.22, 'bandpass', 7000, 1400);
        break;
      case 'hit':
        this.tone('square', 170, 55, 0.12, 0.14);
        this.noise(0.08, 0.25, 'lowpass', 2500, 400);
        break;
      case 'hurt':
        this.tone('sawtooth', 520, 90, 0.3, 0.14);
        this.noise(0.15, 0.2, 'lowpass', 2000, 300);
        break;
      case 'die':
        this.tone('sawtooth', 400, 40, 0.8, 0.15);
        this.noise(0.6, 0.25, 'lowpass', 2500, 80);
        break;
      case 'enemyDie':
        this.tone('square', 300, 40, 0.25, 0.1);
        this.noise(0.3, 0.25, 'lowpass', 1600, 100);
        break;
      case 'soul':
        this.tone('triangle', 880, 880, 0.06, 0.07);
        this.tone('triangle', 1320, 1320, 0.09, 0.07, now + 0.05);
        break;
      case 'checkpoint':
        [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.25, 0.09, now + i * 0.07));
        break;
      case 'powerup':
        [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, f, 0.3, 0.06, now + i * 0.09));
        break;
      case 'shoot':
        this.tone('square', 900, 260, 0.12, 0.07);
        break;
      case 'reflect':
        this.tone('square', 600, 1500, 0.12, 0.09);
        this.noise(0.08, 0.15, 'highpass', 4000, 2000);
        break;
      case 'charge':
        this.tone('sine', 300, 900, 0.5, 0.05);
        break;
      case 'growl':
        this.tone('sawtooth', 120, 80, 0.3, 0.07);
        break;
      case 'blip':
        this.tone('square', 1100, 1100, 0.025, 0.03);
        break;
      case 'select':
        this.tone('square', 660, 880, 0.06, 0.06);
        break;
      case 'break':
        this.noise(0.35, 0.35, 'lowpass', 1800, 90);
        this.tone('square', 120, 40, 0.2, 0.08);
        break;
      case 'gate':
        this.tone('square', 90, 60, 0.4, 0.1);
        this.noise(0.4, 0.2, 'lowpass', 600, 80);
        break;
      case 'slam':
        this.noise(0.4, 0.4, 'lowpass', 900, 50);
        this.tone('sine', 90, 30, 0.4, 0.25);
        break;
      case 'roar':
        this.tone('sawtooth', 110, 55, 0.9, 0.14);
        this.tone('square', 116, 58, 0.9, 0.06);
        this.noise(0.8, 0.15, 'bandpass', 900, 200);
        break;
      case 'explode':
        this.noise(0.7, 0.45, 'lowpass', 3000, 60);
        this.tone('sine', 120, 30, 0.6, 0.25);
        break;
      case 'chug':
        this.noise(0.09, 0.12, 'lowpass', 500, 150);
        break;
      case 'whistle':
        this.tone('triangle', 1180, 1240, 0.5, 0.06);
        this.tone('triangle', 1480, 1520, 0.5, 0.05);
        break;
    }
  }

  // ---- generative chiptune music --------------------------------------------------

  playSong(def: MusicDef | null) {
    if (def === this.song) return;
    this.song = def;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    if (def && this.ctx) this.startSong();
  }

  private startSong() {
    this.step = 0;
    this.nextTime = this.ctx!.currentTime + 0.15;
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  private schedule() {
    const c = this.ctx;
    const s = this.song;
    if (!c || !s) return;
    const stepDur = 60 / s.bpm / 4;
    while (this.nextTime < c.currentTime + 0.2) {
      this.playStep(s, this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private note(s: MusicDef, degree: number, octave: number) {
    const n = s.scale.length;
    const oct = Math.floor(degree / n);
    const d = ((degree % n) + n) % n;
    return s.root + s.scale[d] + 12 * (oct + octave);
  }

  private playStep(s: MusicDef, step: number, t: number, stepDur: number) {
    const bar = Math.floor(step / 16);
    const i = step % 16;
    const chord = s.bars[bar % s.bars.length];
    if (i === 0) {
      // soft pad: chord tones on a quiet triangle
      for (const d of [0, 2, 4]) this.tone('triangle', midiHz(this.note(s, chord + d, 0)), midiHz(this.note(s, chord + d, 0)), stepDur * 15, 0.018, t, this.musicBus);
    }
    if (i % 4 === 0) {
      const f = midiHz(this.note(s, chord + (i === 8 ? 4 : 0), -2));
      this.tone(s.bass, f, f, stepDur * 3.2, 0.1, t, this.musicBus);
    }
    if (s.drums) {
      const m = this.musicBus;
      if (i === 0 || i === 8 || (s.drums === 'driving' && i === 10)) this.tone('sine', 140, 42, 0.16, 0.22, t, m);
      if (i % 4 === 2) this.noise(0.03, 0.05, 'highpass', 7000, 5000, t, m);
      if (s.drums === 'driving') {
        if (i === 4 || i === 12) this.noise(0.12, 0.12, 'bandpass', 1800, 900, t, m);
        if (i % 2 === 1) this.noise(0.02, 0.025, 'highpass', 9000, 7000, t, m);
      }
    }
    const ch = s.melody[bar % s.melody.length][i];
    if (ch && ch !== '.') {
      const f = midiHz(this.note(s, chord + Number(ch), 0));
      this.tone(s.lead, f, f, stepDur * 1.8, 0.05, t, this.musicBus);
    } else if (Math.random() < (s.sparkle ?? 0)) {
      const f = midiHz(this.note(s, chord + Math.floor(Math.random() * 6), 1));
      this.tone('triangle', f, f, stepDur * 1.2, 0.025, t, this.musicBus);
    }
  }
}
