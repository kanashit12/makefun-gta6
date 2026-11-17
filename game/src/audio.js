// Procedural sound and music: WebAudio oscillators only, no audio files.
// Engine hum, gunshots, pickup chimes, sirens and a sunset synthwave loop.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicOn = true;
    this.sfxOn = true;
    this.musicTimer = null;
    this.step = 0;
    this.engineOsc = null;
    this.engineGain = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.startMusic();
      return true;
    } catch {
      return false;
    }
  }

  tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
    if (!this.ctx || !this.sfxOn) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  shot() {
    this.tone(900, 0.12, 'square', 0.18, 120);
    this.tone(160, 0.1, 'sawtooth', 0.12, 60);
  }

  punch() {
    this.tone(180, 0.09, 'sine', 0.25, 70);
  }

  pickup() {
    this.tone(660, 0.12, 'sine', 0.2);
    this.tone(990, 0.18, 'sine', 0.2, null, 0.09);
  }

  missionDone() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.22, null, i * 0.11));
  }

  busted() {
    this.tone(440, 0.5, 'sawtooth', 0.2, 220);
  }

  sirenTick() {
    this.tone(720, 0.18, 'sine', 0.05, 980);
  }

  setEngine(speed01) {
    if (!this.ctx) return;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const target = speed01 > 0.02 ? 0.05 + speed01 * 0.05 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 165, this.ctx.currentTime, 0.1);
  }

  // Simple sunset synthwave loop: bass + pad arpeggio, 8 steps at 112 BPM.
  startMusic() {
    if (this.musicTimer || !this.ctx) return;
    const bass = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4];
    const arp = [220, 261.6, 329.6, 392, 329.6, 261.6, 220, 196];
    const stepDur = 60 / 112 / 2;
    this.musicTimer = window.setInterval(() => {
      if (!this.musicOn || !this.ctx) return;
      const i = this.step % 8;
      this.tone(bass[i], stepDur * 1.8, 'triangle', 0.16);
      this.tone(arp[i], stepDur * 0.9, 'sine', 0.06);
      if (i === 0) this.tone(110, stepDur * 4, 'sine', 0.05);
      this.step += 1;
    }, stepDur * 1000);
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    return this.musicOn;
  }
}
