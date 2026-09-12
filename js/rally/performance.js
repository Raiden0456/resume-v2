export const GRAPHICS_PROFILES = Object.freeze({
  eco: { fps: 30, pixelRatio: 1, maxPixels: 921600, shadows: false, shadowSize: 0, shadowFps: 0 },
  balanced: { fps: 60, pixelRatio: 1.25, maxPixels: 2073600, shadows: true, shadowSize: 1024, shadowFps: 15 },
  high: { fps: 60, pixelRatio: 1.5, maxPixels: 3686400, shadows: true, shadowSize: 2048, shadowFps: 30 },
});

const QUALITY_KEY = "resume-rally-graphics-v1";
export const isGraphicsQuality = value => Object.hasOwn(GRAPHICS_PROFILES, value);

export function loadGraphicsQuality(storage) {
  try {
    const value = storage?.getItem(QUALITY_KEY);
    if (isGraphicsQuality(value)) return value;
  } catch {}
  return "balanced";
}

export function saveGraphicsQuality(storage, value) {
  if (!isGraphicsQuality(value)) return;
  try { storage?.setItem(QUALITY_KEY, value); } catch {}
}

// Render cadence is independent of physics; a zero rate cancels the callback entirely.
export class RallyFrameLoop {
  constructor(draw, request = callback => requestAnimationFrame(callback), cancel = id => cancelAnimationFrame(id)) {
    this.draw = draw;
    this.request = request;
    this.cancel = cancel;
    this.pending = null;
    this.fps = 0;
    this.previous = null;
    this.next = null;
    this.dirty = false;
    this.tick = time => {
      this.pending = null;
      const interval = this.fps ? 1000 / this.fps : 0;
      if (this.dirty || (interval && (this.next === null || time >= this.next - 0.5))) {
        const dt = interval && this.previous !== null ? Math.min(Math.max(0, (time - this.previous) / 1000), 0.1) : 0;
        this.previous = interval ? time : null;
        this.next = interval ? this.next === null ? time + interval : this.next + Math.max(1, Math.floor((time - this.next) / interval) + 1) * interval : null;
        this.dirty = false;
        this.draw(time, dt);
      }
      if (this.fps || this.dirty) this.schedule();
    };
  }

  schedule() {
    if (this.pending === null) this.pending = this.request(this.tick);
  }

  setRate(fps) {
    if (this.fps === fps && fps) return;
    this.fps = fps;
    this.previous = this.next = null;
    if (this.pending !== null) this.cancel(this.pending);
    this.pending = null;
    this.dirty = false;
    if (fps) this.schedule();
  }

  invalidate() {
    this.dirty = true;
    this.schedule();
  }
}
