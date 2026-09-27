// All sound is synthesized locally; audio is unlocked by a user gesture.
export class SoundEngine {
  constructor() { this.context = null; this.alarm = null; this.ambient = null; }
  async unlock() {
    if (!this.context) this.context = new (window.AudioContext || window.webkitAudioContext)();
    await this.context.resume();
  }
  startAlarm() {
    if (!this.context || this.alarm) return;
    const ctx = this.context, oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = 'square'; oscillator.frequency.value = 740; gain.gain.value = .12;
    oscillator.connect(gain).connect(ctx.destination); oscillator.start();
    const timer = setInterval(() => {
      const t = ctx.currentTime;
      oscillator.frequency.setValueAtTime(740, t);
      oscillator.frequency.setValueAtTime(980, t + .22);
      gain.gain.setValueAtTime(.12, t);
      gain.gain.setValueAtTime(.025, t + .4);
    }, 600);
    this.alarm = { oscillator, gain, timer };
  }
  stopAlarm() {
    if (!this.alarm) return;
    clearInterval(this.alarm.timer); this.alarm.oscillator.stop(); this.alarm.gain.disconnect(); this.alarm = null;
  }
  toggleAmbient() {
    if (this.ambient) { this.ambient.forEach(o => o.stop()); this.ambient = null; return false; }
    if (!this.context) return false;
    this.ambient = [174, 261, 348].map(frequency => {
      const o = this.context.createOscillator(), g = this.context.createGain();
      o.frequency.value = frequency; g.gain.value = .012; o.connect(g).connect(this.context.destination); o.start();
      o.onended = () => g.disconnect(); return o;
    }); return true;
  }
  dispose() { this.stopAlarm(); if (this.ambient) this.toggleAmbient(); this.context?.close(); }
}
