import { CROSSINGS, crossingCoordinates, crossingDeckHeight, roadAt } from "./world.js";

export class RallyRecovery {
  constructor() { this.reset(); }

  reset(car) {
    this.waterTime = 0;
    this.crashed = false;
    this.remaining = 0;
    this.jump = null;
    this.lastGrounded = car?.grounded ? { x: car.x, y: car.y, z: car.z } : null;
  }

  update(car, dt) {
    if (this.crashed) {
      this.remaining -= dt;
      return this.remaining <= 0 ? "respawn" : null;
    }
    const enteringWater = car.inWater && this.waterTime === 0;
    this.waterTime = car.inWater ? this.waterTime + dt : 0;
    if (this.waterTime > 0.75) return "splash";
    if (enteringWater) return "water-entry";
    if (car.grounded) {
      this.lastGrounded = { x: car.x, y: car.y, z: car.z };
      this.jump = null;
      return null;
    }
    if (this.lastGrounded) {
      const launch = this.lastGrounded;
      this.jump = CROSSINGS.find(crossing => {
        if (crossing.type !== "jump") return false;
        const { along, across } = crossingCoordinates(crossing, launch.x, launch.z);
        return along >= -crossing.gap - crossing.rampLength && along <= -crossing.gap + 3
          && Math.abs(across) < crossing.halfWidth + 1
          && Math.abs(launch.y - crossingDeckHeight(crossing, along)) < 3;
      }) || null;
      this.lastGrounded = null;
    }
    // Actual ramp launches get a generous landing corridor, but never an
    // unlimited exemption if a missed landing turns into a mountain fall.
    let safeJump = false;
    if (this.jump && car.airtime < 2.7) {
      const { along, across } = crossingCoordinates(this.jump, car.x, car.z);
      safeJump = Math.abs(across) < this.jump.halfWidth + 5
        && along > -this.jump.gap - 4 && along < this.jump.gap + this.jump.rampLength + 20;
    }
    const road = roadAt(car.x, car.z);
    const offCourse = !road || road.distance > road.width / 2 + 6 || Math.abs(car.y - road.y) > 22;
    if (!car.inWater && car.airtime > 1.65 && car.vy < -10 && offCourse && !safeJump) {
      this.crashed = true;
      this.remaining = 0.8;
      return "explode";
    }
    return null;
  }
}
