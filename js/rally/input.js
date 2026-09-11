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
    surface.addEventListener("pointerdown", event => {
      if (!this.enabled || event.pointerType === "mouse") return;
      event.preventDefault();
      surface.setPointerCapture(event.pointerId);
      const side = event.clientX < window.innerWidth / 2 ? "steer" : "pedal";
      this.pointers.set(event.pointerId, { side, x: event.clientX, y: event.clientY, dx: 0, dy: 0 });
      this.updateTouchHint();
    });
    surface.addEventListener("pointermove", event => {
      const pointer = this.pointers.get(event.pointerId);
      if (!pointer) return;
      pointer.dx = event.clientX - pointer.x;
      pointer.dy = event.clientY - pointer.y;
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

  updateTouchHint() {
    for (const side of ["steer", "pedal"]) {
      const indicator = document.getElementById(`touch-${side}`);
      const pointer = [...this.pointers.values()].find(value => value.side === side);
      indicator.classList.toggle("active", Boolean(pointer));
      if (pointer) {
        indicator.style.left = `${pointer.x}px`;
        indicator.style.top = `${pointer.y}px`;
        indicator.style.setProperty("--touch-x", `${Math.max(-40, Math.min(40, pointer.dx))}px`);
        indicator.style.setProperty("--touch-y", `${Math.max(-40, Math.min(40, pointer.dy))}px`);
      }
    }
  }

  sample() {
    const has = (...keys) => keys.some(key => this.keys.has(key));
    this.value.throttle = Number(has("ArrowUp", "KeyW")) - Number(has("ArrowDown", "KeyS"));
    this.value.steer = Number(has("ArrowRight", "KeyD")) - Number(has("ArrowLeft", "KeyA"));
    this.value.handbrake = has("Space");
    for (const pointer of this.pointers.values()) {
      if (pointer.side === "steer") this.value.steer = Math.max(-1, Math.min(1, pointer.dx / 45));
      else {
        this.value.throttle = pointer.dy > 58 ? -1 : 1;
        this.value.handbrake = pointer.dy < -35;
      }
    }
    if (!this.enabled) { this.value.throttle = 0; this.value.steer = 0; this.value.handbrake = false; }
    return this.value;
  }

  clear() {
    this.keys.clear();
    this.pointers.clear();
    this.updateTouchHint();
  }
}
