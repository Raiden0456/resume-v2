export class RallyAudio {
  constructor() {
    this.context = null;
    this.enabled = false;
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

  update(car, throttle, paused) {
    if (!this.context) return;
    const time = this.context.currentTime;
    this.master.gain.setTargetAtTime(this.enabled && !paused ? 0.14 : 0, time, 0.08);
    const gearSpeed = car.speed % 10;
    const rpm = 38 + gearSpeed * 7 + Math.abs(throttle) * 15;
    for (const { oscillator, ratio } of this.oscillators) oscillator.frequency.setTargetAtTime(rpm * ratio, time, 0.12);
    this.engineGain.gain.setTargetAtTime(0.16 + Math.abs(throttle) * 0.1, time, 0.1);
    this.gravelGain.gain.setTargetAtTime(car.grounded && !car.inWater ? Math.min(car.speed * 0.008 + car.slip * 0.045, 0.7) : 0, time, 0.08);
  }
}
