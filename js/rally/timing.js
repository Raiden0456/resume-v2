import { SPAWN, START_LINE, FINISH_LINE } from "./world.js";

const RUN_KEY = "resume-rally-run-v2";

function lineCoordinates(car, line) {
  const dx = car.x - line.x, dz = car.z - line.z;
  return { along: dx * Math.sin(line.heading) - dz * Math.cos(line.heading), across: dx * Math.cos(line.heading) + dz * Math.sin(line.heading) };
}

function crossingFraction(previous, car, line) {
  if (!previous || !car.grounded || car.inWater || Math.abs(car.y - line.elevation) > 3
    || Math.hypot(car.x - previous.x, car.z - previous.z) > 10) return null;
  const a = lineCoordinates(previous, line), b = lineCoordinates(car, line);
  if (a.along > 0 || b.along <= 0) return null;
  const fraction = -a.along / (b.along - a.along);
  return Math.abs(a.across + (b.across - a.across) * fraction) < line.halfWidth ? fraction : null;
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "—:——.——";
  const hundredths = Math.max(0, Math.floor(seconds * 100 + 1e-6));
  return `${Math.floor(hundredths / 6000)}:${String(Math.floor(hundredths / 100) % 60).padStart(2, "0")}.${String(hundredths % 100).padStart(2, "0")}`;
}

export function formatDelta(seconds) {
  if (!Number.isFinite(seconds)) return "FIRST RUN";
  return `${seconds < -0.005 ? "−" : "+"}${Math.abs(seconds).toFixed(2)} s`;
}

export class RallyTiming {
  constructor(landmarks, storage) {
    this.landmarks = landmarks;
    this.finish = { ...FINISH_LINE, index: landmarks.length };
    this.ids = [...landmarks.map(sight => sight.id), FINISH_LINE.id];
    this.storage = storage;
    this.previous = null;
    try {
      const saved = JSON.parse(storage?.getItem(RUN_KEY) || "null");
      if (saved?.ids?.length === this.ids.length && saved.times?.length === this.ids.length
        && saved.ids.every((id, i) => id === this.ids[i])
        && saved.times.every((time, i) => Number.isFinite(time) && time > (i ? saved.times[i - 1] : 0))) {
        this.previous = saved.times;
      }
    } catch { /* Invalid or unavailable storage does not stop a descent. */ }
    this.status = "idle";
    this.elapsed = 0;
    this.times = [];
    this.reference = this.previous;
    this.lastPosition = null;
  }

  atSummit(car) {
    return car.grounded && !car.inWater && Math.abs(car.y - START_LINE.elevation) < 3
      && Math.hypot(car.x - SPAWN.x, car.z - SPAWN.z) < 13
      && lineCoordinates(car, START_LINE).along <= 0;
  }

  arm() {
    this.status = "ready";
    this.elapsed = 0;
    this.times = [];
    this.reference = this.previous;
  }

  // Instant travel ends a timed attempt. Only the summit can arm another one.
  travel(car) {
    this.status = "idle";
    this.times = [];
    this.reference = this.previous;
    this.lastPosition = { x: car.x, z: car.z };
    if (this.atSummit(car)) this.arm();
  }

  update(car, dt, reached) {
    const previous = this.lastPosition;
    this.lastPosition = { x: car.x, z: car.z };
    if (this.status !== "running" && this.status !== "ready" && this.atSummit(car)) this.arm();
    const startFraction = this.status === "ready" ? crossingFraction(previous, car, START_LINE) : null;
    if (startFraction !== null && dt > 0) {
      this.status = "running";
      dt *= 1 - startFraction;
    }
    if (this.status !== "running") return null;
    this.elapsed += Math.max(0, dt);
    const index = this.times.length;
    const atFinish = index === this.landmarks.length;
    if (atFinish) {
      const fraction = crossingFraction(previous, car, FINISH_LINE);
      if (fraction === null || dt <= 0) return null;
      this.elapsed -= dt * (1 - fraction);
    } else if (reached !== this.landmarks[index]) return null;
    this.times.push(this.elapsed);
    const split = { index, time: this.elapsed, delta: this.delta(index), finished: atFinish };
    if (split.finished) {
      this.status = "finished";
      this.previous = [...this.times];
      try {
        this.storage?.setItem(RUN_KEY, JSON.stringify({ ids: this.ids, times: this.previous }));
      } catch { /* Keep the completed run in memory when storage is unavailable. */ }
    }
    return split;
  }

  delta(index) {
    return Number.isFinite(this.times[index]) && Number.isFinite(this.reference?.[index])
      ? this.times[index] - this.reference[index] : null;
  }

  get next() { return this.status === "running" ? this.landmarks[this.times.length] || this.finish : null; }
}
