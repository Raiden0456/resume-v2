export class RallyAudio {
  constructor() {
    this.context = null;
    this.enabled = false;
    this.effects = new Set();
  }

  async toggle() {
    if (!this.context) this.create();
    if (this.context.state === "suspended") await this.context.resume();
    this.enabled = !this.enabled;
    this.master.gain.setTargetAtTime(this.enabled ? 0.14 : 0, this.context.currentTime, 0.08);
    return this.enabled;
  }

  create() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error("Audio is unavailable in this browser.");
    const context = this.context = new AudioContext();
    this.master = context.createGain();
    this.master.gain.value = 0;
    this.master.connect(context.destination);
    this.engineGain = context.createGain();
    this.engineGain.gain.value = 0.25;
    const lowpass = context.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 520;
    this.engineGain.connect(lowpass).connect(this.master);
    this.oscillators = [1, 1.5, 2.01].map((ratio, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index === 0 ? "sawtooth" : "triangle";
      oscillator.frequency.value = 38 * ratio;
      oscillator.connect(this.engineGain);
      oscillator.start();
      return { oscillator, ratio };
    });
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = buffer.getChannelData(0);
    this.effectNoise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const effectSamples = this.effectNoise.getChannelData(0);
    for (let i = 0; i < effectSamples.length; i++) effectSamples[i] = Math.random() * 2 - 1;
    let last = 0;
    for (let i = 0; i < samples.length; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.09) / 1.09;
      samples[i] = last * 3;
    }
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const bandpass = context.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 1000;
    bandpass.Q.value = 0.6;
    this.gravelGain = context.createGain();
    this.gravelGain.gain.value = 0;
    noise.connect(bandpass).connect(this.gravelGain).connect(this.master);
    noise.start();
  }

  impact(kind) {
    if (!this.enabled || this.context?.state !== "running") return;
    const context = this.context, time = context.currentTime, water = kind === "splash";
    const duration = water ? 0.7 : 0.55;
    const noise = context.createBufferSource(), filter = context.createBiquadFilter(), envelope = context.createGain();
    noise.buffer = this.effectNoise;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(water ? 2800 : 900, time);
    filter.frequency.exponentialRampToValueAtTime(water ? 240 : 65, time + duration);
    envelope.gain.setValueAtTime(0.001, time);
    envelope.gain.linearRampToValueAtTime(water ? 1.25 : 1.65, time + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + duration);
    noise.connect(filter).connect(envelope).connect(this.master);
    const thump = context.createOscillator(), bass = context.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(water ? 220 : 100, time);
    thump.frequency.exponentialRampToValueAtTime(water ? 55 : 25, time + duration * 0.7);
    bass.gain.setValueAtTime(water ? 0.65 : 1.4, time);
    bass.gain.exponentialRampToValueAtTime(0.001, time + duration);
    thump.connect(bass).connect(this.master);
    const effect = { kind, noise, thump };
    this.effects.add(effect);
    noise.onended = () => { noise.disconnect(); filter.disconnect(); envelope.disconnect(); this.effects.delete(effect); };
    thump.onended = () => { thump.disconnect(); bass.disconnect(); };
    noise.start(time); thump.start(time);
    noise.stop(time + duration); thump.stop(time + duration);
  }

  meow() {
    if (!this.enabled || this.context?.state !== "running") return;
    const context = this.context, time = context.currentTime, duration = 0.55;
    const voice = context.createOscillator(), formant = context.createBiquadFilter(), envelope = context.createGain();
    voice.type = "sawtooth";
    voice.frequency.setValueAtTime(520, time);
    voice.frequency.linearRampToValueAtTime(760, time + 0.16);
    voice.frequency.exponentialRampToValueAtTime(430, time + duration);
    formant.type = "bandpass"; formant.Q.value = 2.2;
    formant.frequency.setValueAtTime(1100, time);
    formant.frequency.linearRampToValueAtTime(1900, time + 0.18);
    formant.frequency.exponentialRampToValueAtTime(900, time + duration);
    envelope.gain.setValueAtTime(0.001, time);
    envelope.gain.linearRampToValueAtTime(0.22, time + 0.06);
    envelope.gain.setValueAtTime(0.22, time + 0.3);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + duration);
    voice.connect(formant).connect(envelope).connect(this.master);
    voice.onended = () => { voice.disconnect(); formant.disconnect(); envelope.disconnect(); };
    voice.start(time); voice.stop(time + duration);
  }

  update(car, throttle, paused, parked = false) {
    if (!this.context) return;
    const time = this.context.currentTime;
    this.master.gain.setTargetAtTime(this.enabled && !paused ? 0.14 : 0, time, 0.08);
    const gearSpeed = car.speed % 10;
    const rpm = 38 + gearSpeed * 7 + Math.abs(throttle) * 15 + car.wheelspin * 45;
    for (const { oscillator, ratio } of this.oscillators) oscillator.frequency.setTargetAtTime(rpm * ratio, time, 0.12);
    this.engineGain.gain.setTargetAtTime(parked ? 0 : 0.16 + Math.abs(throttle) * 0.1, time, parked ? 0.25 : 0.1);
    this.gravelGain.gain.setTargetAtTime(car.grounded && !car.inWater ? Math.min(car.speed * 0.008 + car.slip * 0.045 + car.wheelspin * 0.35, 0.7) : 0, time, 0.08);
  }
}
