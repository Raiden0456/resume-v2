export class RallyInput {
  constructor(surface) {
    this.keys = new Set();
    this.pointers = new Map();
    this.value = { throttle: 0, steer: 0, handbrake: false };
    this.enabled = false;
    this.surface = surface;
    this.onAction = () => {};
    const driveKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyS", "KeyA", "KeyD", "Space"]);
    window.addEventListener("keydown", event => {
      if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      const interactive = event.target.closest("button, a, dialog");
      if (this.enabled && driveKeys.has(event.code) && !interactive) {
        event.preventDefault();
        this.keys.add(event.code);
      }
      if (!event.repeat && !interactive && ["KeyR", "KeyE", "KeyM", "Escape"].includes(event.code)) {
        // Prevent Escape's default action from immediately closing a dialog
        // opened by this same key event.
        event.preventDefault();
        this.onAction(event.code);
      }
    });
    window.addEventListener("keyup", event => this.keys.delete(event.code));
    window.addEventListener("blur", () => this.clear());
    document.addEventListener("visibilitychange", () => this.clear());
    this.zones = [...surface.querySelectorAll("[data-zone]")];
    surface.addEventListener("pointerdown", event => {
      if (!this.enabled || event.pointerType === "mouse") return;
      event.preventDefault();
      surface.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, this.zoneAt(event.clientX, event.clientY));
      this.updateTouchHint();
    });
    surface.addEventListener("pointermove", event => {
      if (!this.pointers.has(event.pointerId)) return;
      this.pointers.set(event.pointerId, this.zoneAt(event.clientX, event.clientY));
      this.updateTouchHint();
    });
    const release = event => {
      this.pointers.delete(event.pointerId);
      this.updateTouchHint();
    };
    surface.addEventListener("pointerup", release);
    surface.addEventListener("pointercancel", release);
    surface.addEventListener("lostpointercapture", release);
    surface.addEventListener("contextmenu", event => event.preventDefault());
  }

  zoneAt(x, y) {
    const hit = this.zones.find(zone => {
      const rect = zone.getBoundingClientRect();
      return x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom;
    });
    return hit?.dataset.zone ?? null;
  }

  updateTouchHint() {
    const active = new Set(this.pointers.values());
    for (const zone of this.zones) zone.classList.toggle("active", active.has(zone.dataset.zone));
  }

  sample() {
    const has = (...keys) => keys.some(key => this.keys.has(key));
    this.value.throttle = Number(has("ArrowUp", "KeyW")) - Number(has("ArrowDown", "KeyS"));
    this.value.steer = Number(has("ArrowRight", "KeyD")) - Number(has("ArrowLeft", "KeyA"));
    this.value.handbrake = has("Space");
    const zones = new Set(this.pointers.values());
    if (zones.has("left") || zones.has("right")) this.value.steer = Number(zones.has("right")) - Number(zones.has("left"));
    if (zones.has("gas") || zones.has("brake")) this.value.throttle = Number(zones.has("gas")) - Number(zones.has("brake"));
    if (zones.has("handbrake")) this.value.handbrake = true;
    if (!this.enabled) { this.value.throttle = 0; this.value.steer = 0; this.value.handbrake = false; }
    return this.value;
  }

  clear() {
    this.keys.clear();
    this.pointers.clear();
    this.updateTouchHint();
  }
}
