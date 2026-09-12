import { terrainHeight } from "./world.js";

const STORAGE_KEY = "resume-rally-secrets-v1";

export class RallyRest {
  constructor(spots, storage) {
    this.spots = spots.map(spot => ({ ...spot, sight: { x: spot.x, z: spot.z, elevation: terrainHeight(spot.x, spot.z), type: "rest" } }));
    this.storage = storage;
    this.visit = null;
    this.still = 0;
    this.found = new Set();
    try {
      for (const id of JSON.parse(storage?.getItem(STORAGE_KEY) || "[]")) if (this.spots.some(spot => spot.id === id)) this.found.add(id);
    } catch {}
  }

  update(car, dt, active) {
    const spot = active ? this.spots.find(spot => Math.hypot(car.x - spot.x, car.z - spot.z) < spot.approach) : null;
    this.still = spot && car.speed < 1.2 ? this.still + dt : 0;
    const result = { arrived: false, discovered: false };
    if (this.still >= 0.5 && !this.visit) {
      this.visit = spot; result.arrived = true;
      if (!this.found.has(spot.id)) {
        this.found.add(spot.id); result.discovered = true;
        try { this.storage?.setItem(STORAGE_KEY, JSON.stringify([...this.found])); } catch {}
      }
    }
    if (!spot) this.visit = null;
    return result;
  }
}
