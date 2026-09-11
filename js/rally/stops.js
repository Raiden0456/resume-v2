import { SPAWN } from "./world.js";

const CHECKPOINT_KEY = "resume-rally-checkpoint-v1";

export class RallyStops {
  constructor(landmarks, storage) {
    this.landmarks = landmarks;
    this.storage = storage;
    this.checkpoint = null;
    try {
      const id = storage?.getItem(CHECKPOINT_KEY);
      this.checkpoint = landmarks.find(sight => sight.id === id) || null;
    } catch { /* Checkpoints still work when persistent storage is unavailable. */ }
    this.viewing = null;
    this.clearApproach();
  }

  clearApproach() {
    this.nearby = null;
    this.reached = null;
    this.ready = false;
    this.stoppedFor = 0;
  }

  activate(sight) {
    if (!this.landmarks.includes(sight) || this.checkpoint === sight) return;
    this.checkpoint = sight;
    try { this.storage?.setItem(CHECKPOINT_KEY, sight.id); } catch { /* Session-only checkpoint. */ }
  }

  resetToSummit() {
    this.checkpoint = null;
    this.close(); this.clearApproach();
    try { this.storage?.removeItem(CHECKPOINT_KEY); } catch { /* Session-only checkpoint. */ }
  }

  update(car, dt) {
    if (this.viewing) return;
    let nearest = null, distance = Infinity;
    for (const sight of this.landmarks) {
      const d = Math.hypot(car.x - sight.marker[0], car.z - sight.marker[1]);
      if (d < distance) { nearest = sight; distance = d; }
    }
    const onGround = nearest && car.grounded && !car.inWater && Math.abs(car.y - nearest.elevation) < 3;
    this.reached = onGround && distance < 9 ? nearest : null;
    if (this.reached) this.activate(this.reached);
    const nearby = onGround && distance < (nearest === this.nearby ? 14 : 9) ? nearest : null;
    if (nearby !== this.nearby) this.clearApproach();
    this.nearby = nearby;
    this.reached = onGround && distance < 9 ? nearest : null;
    const stopped = nearby && car.speed < (this.ready ? 1.8 : 0.8);
    this.stoppedFor = stopped ? this.stoppedFor + Math.max(0, Math.min(dt, 0.1)) : 0;
    this.ready = Boolean(stopped && this.stoppedFor >= 0.4);
  }

  open() {
    if (!this.ready || !this.nearby) return null;
    this.viewing = this.nearby;
    return this.viewing;
  }

  close() { this.viewing = null; }

  get restartPose() { return { ...(this.checkpoint?.arrival || SPAWN) }; }
}
