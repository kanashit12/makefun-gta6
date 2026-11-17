// Sunset Streets — procedural WebAudio sound bank.
// Every sound is synthesised in code (oscillators and noise). No audio
// files, no network. The context starts on the first user gesture.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

// A moody synthwave bassline (MIDI notes) and its chord pads.
const BASS_LINE = [45, 45, 48, 45, 43, 43, 50, 48, 45, 45, 48, 45, 52, 50, 48, 47];
const CHORDS = [
  [57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59],
];

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicOn = true;
    this.musicStep = 0;
    this.nextNoteTime = 0;
    this.sirenPhase = 0;
    this.started = false;
  }

  // Call from a user gesture (key/click). Safe to call repeatedly.
  unlock() {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.master);

      // Engine hum: sawtooth through a lowpass, pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();

      // Police siren: sine wail, frequency steered in update().
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 750;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();

      this.nextNoteTime = this.ctx.currentTime + 0.1;
      this.started = true;
    } catch {
      this.started = false;
    }
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.musicGain) this.musicGain.gain.value = this.musicOn ? 0.16 : 0;
    return this.musicOn;
  }

  setEngine(speed01) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(52 + speed01 * 165, t, 0.08);
    this.engineGain.gain.setTargetAtTime(speed01 > 0.03 ? 0.05 + speed01 * 0.06 : 0, t, 0.1);
  }

  setSiren(on, dt) {
    if (!this.started) return;
    this.sirenPhase += dt;
    const t = this.ctx.currentTime;
    if (on) {
      const wail = 700 + 320 * Math.sin(this.sirenPhase * Math.PI * 2 * 0.55);
      this.sirenOsc.frequency.setTargetAtTime(wail, t, 0.05);
      this.sirenGain.gain.setTargetAtTime(0.05, t, 0.2);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, t, 0.2);
    }
  }

  noiseBurst(duration, filterFreq, gainValue) {
    if (!this.started) return;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.value = gainValue;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start();
  }

  tone(freq, duration, type, gainValue, when = 0) {
    if (!this.started) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gainValue, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  gunshot() {
    this.noiseBurst(0.14, 3200, 0.5);
    this.tone(140, 0.1, 'square', 0.18);
  }

  punch() {
    this.tone(110, 0.12, 'sine', 0.5);
    this.noiseBurst(0.08, 900, 0.25);
  }

  pickup() {
    this.tone(880, 0.12, 'sine', 0.25);
    this.tone(1318, 0.18, 'sine', 0.25, 0.07);
  }

  missionComplete() {
    const seq = [72, 76, 79, 84, 79, 84];
    seq.forEach((n, i) => this.tone(NOTE(n), 0.22, 'triangle', 0.3, i * 0.11));
  }

  busted() {
    const seq = [62, 58, 55, 50];
    seq.forEach((n, i) => this.tone(NOTE(n), 0.3, 'sawtooth', 0.2, i * 0.16));
  }

  crash() {
    this.noiseBurst(0.3, 700, 0.4);
  }

  // Synthwave loop: one 8th-note step per call window.
  updateMusic() {
    if (!this.started || !this.musicOn) return;
    const stepDur = 0.24;
    while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
      const t = this.nextNoteTime;
      const step = this.musicStep % 16;
      const bar = Math.floor(this.musicStep / 16) % 4;
      const bass = BASS_LINE[step];
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = NOTE(bass - 12);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.95);
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 500;
      osc.connect(f);
      f.connect(g);
      g.connect(this.musicGain);
      osc.start(t);
      osc.stop(t + stepDur);
      if (step === 0) {
        for (const n of CHORDS[bar]) {
          const po = this.ctx.createOscillator();
          po.type = 'triangle';
          po.frequency.value = NOTE(n);
          const pg = this.ctx.createGain();
          pg.gain.setValueAtTime(0.05, t);
          pg.gain.linearRampToValueAtTime(0.09, t + 0.4);
          pg.gain.setValueAtTime(0.09, t + stepDur * 14);
          pg.gain.linearRampToValueAtTime(0.001, t + stepDur * 16);
          po.connect(pg);
          pg.connect(this.musicGain);
          po.start(t);
          po.stop(t + stepDur * 16);
        }
      }
      if (step % 4 === 2) {
        const hat = this.ctx.createBufferSource();
        const len = Math.floor(this.ctx.sampleRate * 0.04);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        hat.buffer = buf;
        const hg = this.ctx.createGain();
        hg.gain.value = 0.12;
        const hf = this.ctx.createBiquadFilter();
        hf.type = 'highpass';
        hf.frequency.value = 6000;
        hat.connect(hf);
        hf.connect(hg);
        hg.connect(this.musicGain);
        hat.start(t);
      }
      this.musicStep++;
      this.nextNoteTime += stepDur;
    }
  }

  update(dt, speed01, wanted) {
    if (!this.started) return;
    this.setEngine(speed01);
    this.setSiren(wanted > 0, dt);
    this.updateMusic();
  }
}
