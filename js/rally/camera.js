import { Vector3 } from "../vendor/three/three.module.min.js";
import { terrainHeight } from "./world.js";

const DRIVE_OFFSET = new Vector3(50, 170, 85);
const START_ANGLE = Math.atan2(DRIVE_OFFSET.x, DRIVE_OFFSET.z);
const SWAY_AMPLITUDE = Math.PI / 12;
const SWAY_PERIOD = 24;

export function createCameraRig(camera, groundAt = terrainHeight) {
  const focus = new Vector3(), offset = DRIVE_OFFSET.clone(), desired = new Vector3();
  let width = 1, height = 1, span = 51, inset = 0;
  let mode = "drive", sight = null, angle = START_ANGLE, swayPhase = 0;

  function project() {
    camera.left = -span * width / height; camera.right = -camera.left;
    camera.top = span; camera.bottom = -span;
    // Shift the subject into the visible part of the scene beside the card.
    camera.setViewOffset(width, height, -inset / 2, 0, width, height);
    camera.updateProjectionMatrix();
  }

  return {
    get mode() { return mode; },
    get angle() { return angle; },
    get focus() { return focus; },
    resize(w, h) { width = Math.max(1, w); height = Math.max(1, h); project(); },
    snap(target) {
      focus.copy(target); offset.copy(DRIVE_OFFSET);
      span = height < 550 ? 34 : 51; inset = 0;
      mode = "drive"; sight = null; angle = START_ANGLE; swayPhase = 0;
      camera.position.copy(focus).add(offset); camera.lookAt(focus); project();
    },
    update(drivingFocus, dt, view = {}, reducedMotion = false) {
      const nextMode = view.sight ? (view.orbit ? "orbit" : "preview") : "drive";
      if (view.sight !== sight) { angle = START_ANGLE; swayPhase = 0; }
      mode = nextMode; sight = view.sight || null;
      let targetSpan = height < 550 ? 34 : 51;
      let targetInset = 0;
      desired.copy(DRIVE_OFFSET);
      const targetFocus = drivingFocus.clone();
      if (sight) {
        const cottage = sight.type === "cottage";
        if ((mode === "orbit" || cottage) && !view.paused && !reducedMotion) {
          swayPhase = (swayPhase + dt * Math.PI * 2 / SWAY_PERIOD) % (Math.PI * 2);
          // Stay on the original side of the mountain, easing into each reversal.
          angle = START_ANGLE + (cottage ? 0.1 : 0) + Math.sin(swayPhase) * SWAY_AMPLITUDE;
        }
        targetFocus.set(sight.x, sight.elevation + (sight.type === "tower" ? 8 : cottage ? 2 : 4), sight.z);
        if (mode === "preview") {
          targetFocus.x += (view.car.x - sight.x) * 0.25;
          targetFocus.z += (view.car.z - sight.z) * 0.25;
        }
        const radius = mode === "orbit" ? 52 : cottage ? 46 : 66;
        desired.set(Math.sin(angle) * radius, mode === "orbit" ? 58 : 78, Math.cos(angle) * radius);
        // Raise the camera over nearby ridges during the close-up, including
        // the sightlines between the camera and the building.
        for (let i = 1; i <= 12; i++) {
          const t = i / 12;
          const terrain = groundAt(targetFocus.x + desired.x * t, targetFocus.z + desired.z * t);
          desired.y = Math.max(desired.y, (terrain + 5 - targetFocus.y) / t);
        }
        targetInset = Math.min(view.panelWidth || 0, width * 0.65);
        const room = Math.max(0.3, (width - targetInset) / width);
        const minimumForBuilding = 18 * height / (width * room);
        targetSpan = cottage ? (height < 550 ? 11 : 14) : Math.max(minimumForBuilding, mode === "orbit" ? (height < 550 ? 18 : 21) : (height < 550 ? 23 : 29));
      }
      const blend = reducedMotion ? 1 : 1 - Math.exp(-(mode === "drive" ? 4 : 3) * dt);
      focus.lerp(targetFocus, blend); offset.lerp(desired, blend);
      span += (targetSpan - span) * blend; inset += (targetInset - inset) * blend;
      camera.position.copy(focus).add(offset); camera.lookAt(focus);
      project();
      camera.updateMatrixWorld();
    },
  };
}
