import { SPAWN, WORLD, driveHeightAt, terrainGradient } from "./world.js";

export const FIXED_STEP = 1 / 120;
export const GRAVITY = 40;
export const TOP_SPEED = 29;
// Compress the mountain's exaggerated grades a little for driveability;
// free flight still uses the full gravity above.
const HILL_GRAVITY = 26;
const WHEELBASE = 2.6;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createCarState(pose = SPAWN, heightAt = driveHeightAt) {
  const slope = terrainGradient(pose.x, pose.z, heightAt);
  return { ...pose, y: heightAt(pose.x, pose.z), vy: 0, launchVy: 0, grounded: true, airtime: 0, landing: 0, inWater: false,
    suspension: 0, suspensionVelocity: 0,
    pitch: Math.atan(slope.x * Math.sin(pose.heading) - slope.z * Math.cos(pose.heading)),
    roll: Math.atan(slope.x * Math.cos(pose.heading) + slope.z * Math.sin(pose.heading)),
    vx: 0, vz: 0, yaw: 0, steer: 0, grip: 5.1, speed: 0, slip: 0, drift: false, wheelspin: 0, surface: "gravel" };
}

export function resetCar(state, pose = SPAWN, heightAt = driveHeightAt) {
  Object.assign(state, createCarState(pose, heightAt));
}

// Grounded tyres exchange forces with the slope. Once the surface falls away,
// the car retains its momentum and follows a ballistic arc until contact.
export function stepCar(state, input, dt, environment = {}) {
  dt = clamp(dt, 0, 1 / 30);
  if (!dt) return state;
  const heightAt = environment.heightAt || driveHeightAt;
  const supportAt = environment.supportAt || heightAt;
  const onRoad = environment.onRoad !== false;
  const throttle = clamp(input.throttle || 0, -1, 1), steering = clamp(input.steer || 0, -1, 1);
  const handbrake = Boolean(input.handbrake);
  const oldX = state.x, oldZ = state.z;
  const oldGround = supportAt(state.x, state.z, state.y + 0.7);
  const wasGrounded = state.grounded;
  state.landing *= Math.exp(-8 * dt);
  state.surface = onRoad ? "gravel" : "scrub";
  let forwardX = Math.sin(state.heading), forwardZ = -Math.cos(state.heading);
  let rightX = Math.cos(state.heading), rightZ = Math.sin(state.heading);
  let forward = state.vx * forwardX + state.vz * forwardZ;
  let sideways = state.vx * rightX + state.vz * rightZ;
  state.steer += (steering - state.steer) * (1 - Math.exp(-18 * dt));
  state.wheelspin = 0;

  if (state.grounded) {
    const slope = terrainGradient(state.x, state.z, (x, z) => supportAt(x, z, state.y + 1.1));
    const forwardGrade = slope.x * forwardX + slope.z * forwardZ;
    const lowGear = 1 + 0.3 * clamp(1 - Math.abs(forward) / 8, 0, 1);
    const acceleration = throttle < 0 && forward > 0.6 ? 29 : throttle > 0 && forward < -0.6 ? 24 : 14 * lowGear;
    const thrust = throttle * acceleration / Math.hypot(1, forwardGrade);
    forward += thrust * dt;
    if (Math.abs(forward) > 0.8 || throttle) {
      // Gravity acts along the incline, and engine thrust is spent climbing.
      // Keep the existing low-speed hill hold and modest downhill assistance.
      const gravity = HILL_GRAVITY * forwardGrade / (1 + forwardGrade * forwardGrade);
      const uphill = forward * forwardGrade > 0;
      if (throttle > 0 && forwardGrade > 0 && forward < 2) state.wheelspin = clamp(1 + (gravity + 1 - thrust) / 4, 0, 1);
      const beforeGravity = forward;
      forward -= (uphill ? gravity : clamp(gravity, -2.2, 2.2)) * dt;
      if (uphill && beforeGravity * forward < 0) forward = 0;
      sideways -= clamp(slope.x * rightX + slope.z * rightZ, -1, 1) * (handbrake || state.wheelspin > 0.5 ? 1.3 : 0.35) * dt;
    }
    const resistance = !throttle ? (handbrake ? 3.8 : 3.2) : 0.65;
    forward -= Math.sign(forward) * Math.min(Math.abs(forward), resistance * dt);
    // Grass retains almost all of the pace; crossing a verge never clamps speed.
    forward *= Math.exp(-(onRoad ? 0.38 : 0.46) * dt);
    const slidingBrake = throttle || Math.abs(state.steer) > 0.1 || Math.abs(sideways) > 2;
    forward *= Math.exp(-(handbrake ? (slidingBrake ? 0.16 : 0.95) : 0) * dt);
    forward = clamp(forward, -11, TOP_SPEED);
    const speed = Math.hypot(forward, sideways);
    // A sliding car still has steering authority even when most of its
    // momentum is sideways. A quick turn naturally loosens the rear tyres.
    const turnSpeed = Math.min(speed / 7, 1);
    const targetYaw = state.steer * Math.sign(forward) * turnSpeed * (handbrake ? 2.45 : 1.85);
    state.yaw += (targetYaw - state.yaw) * (1 - Math.exp(-12 * dt));
    const corner = clamp((speed - 4) / 9, 0, 1) * clamp((Math.abs(state.steer) - 0.04) / 0.5, 0, 1);
    // Once the rear steps out, throttle keeps the tyres loose even through
    // small steering corrections. A handbrake tap initiates this same slide.
    const powerSlide = throttle > 0 && forward > 0
      ? clamp((Math.abs(sideways) / Math.max(speed, 1) - 0.1) / 0.45, 0, 1) * clamp((speed - 5) / 7, 0, 1) : 0;
    const slide = handbrake ? clamp((speed - 3) / 5, 0, 1) : Math.max(corner, powerSlide);
    const baseGrip = onRoad ? 5.1 : 4.5;
    const targetGrip = baseGrip + ((handbrake ? 1.05 : 2.05) - baseGrip) * slide;
    // Grip breaks quickly but returns progressively, including on cambered
    // turns and after releasing the handbrake.
    state.grip += (targetGrip - state.grip) * (1 - Math.exp(-(targetGrip < state.grip ? 12 : 2.6) * dt));
    const lateralBeforeGrip = sideways;
    sideways *= Math.exp(-state.grip * dt);
    if (!throttle) sideways -= Math.sign(sideways) * Math.min(Math.abs(sideways), (speed > 4 ? 0.3 : 2.5) * dt);
    // Tyres primarily redirect momentum toward the nose. Scrub dissipates a
    // small part of it instead of deleting all sideways energy in a drift.
    forward = (Math.sign(forward) || Math.sign(throttle) || 1) * Math.sqrt(forward * forward + (lateralBeforeGrip * lateralBeforeGrip - sideways * sideways) * 0.97);
    const speedLimit = Math.min(1, TOP_SPEED / (Math.hypot(forward, sideways) || 1));
    forward *= speedLimit; sideways *= speedLimit;
    state.vx = forwardX * forward + rightX * sideways;
    state.vz = forwardZ * forward + rightZ * sideways;
    if (!throttle && Math.hypot(state.vx, state.vz) < 0.65) { state.vx = 0; state.vz = 0; state.yaw = 0; }
  } else {
    // Steering can trim the attitude in flight, but cannot turn momentum or
    // brake against empty air. The throttle only revs the engine here.
    state.vx *= Math.exp(-0.025 * dt); state.vz *= Math.exp(-0.025 * dt);
    state.yaw += (steering * 0.3 - state.yaw) * (1 - Math.exp(-2 * dt));
  }
  state.heading += state.yaw * dt * (wasGrounded ? 1 : 0.35);
  state.heading = Math.atan2(Math.sin(state.heading), Math.cos(state.heading));
  state.x += state.vx * dt; state.z += state.vz * dt;

  for (const obstacle of environment.obstacles || []) {
    if (state.y > (obstacle.elevation ?? heightAt(obstacle.x, obstacle.z)) + (obstacle.height ?? (obstacle.type === "tower" ? 17 : 10))) continue;
    let dx = state.x - obstacle.x, dz = state.z - obstacle.z;
    const radius = obstacle.radius + 1.15, distance = Math.hypot(dx, dz);
    if (distance >= radius) continue;
    if (distance < 0.0001) { dx = 1; dz = 0; }
    const length = Math.hypot(dx, dz), nx = dx / length, nz = dz / length;
    state.x = obstacle.x + nx * radius; state.z = obstacle.z + nz * radius;
    const impact = state.vx * nx + state.vz * nz;
    if (impact < 0) { state.vx -= impact * nx * 1.25; state.vz -= impact * nz * 1.25; state.yaw *= 0.45; }
  }
  if (Math.abs(state.x) > WORLD.limitX) { state.x = clamp(state.x, -WORLD.limitX, WORLD.limitX); state.vx *= -0.2; }
  if (Math.abs(state.z) > WORLD.limitZ) { state.z = clamp(state.z, -WORLD.limitZ, WORLD.limitZ); state.vz *= -0.2; }

  let ground = supportAt(state.x, state.z, state.y + Math.max(0.7, state.vy * dt + 0.35));
  let distance = Math.hypot(state.x - oldX, state.z - oldZ);
  // A rock face is a collision, not an elevator to its top.
  if (ground > state.y + Math.max(0.4, distance * 1.5, state.vy * dt + 0.3) && distance < 2) {
    state.x = oldX; state.z = oldZ; state.vx *= -0.15; state.vz *= -0.15; ground = oldGround;
    distance = 0;
  }
  if (wasGrounded && distance > 0.0001 && ground > oldGround) {
    // Bend incoming momentum into the slope instead of adding free vertical
    // speed on top of full horizontal speed at the foot of a steep bank.
    const grade = (ground - oldGround) / distance;
    const speed = Math.hypot(state.vx, state.vz);
    const projection = speed > 0.001 ? clamp((speed + state.vy * grade) / (speed * (1 + grade * grade)), 0, 1) : 1;
    state.vx *= projection; state.vz *= projection;
    state.x = oldX + (state.x - oldX) * projection;
    state.z = oldZ + (state.z - oldZ) * projection;
    distance *= projection;
    ground = supportAt(state.x, state.z, state.y + Math.max(0.7, state.vy * dt + 0.35));
  }
  const groundVelocity = (ground - oldGround) / dt;
  const verticalMomentum = wasGrounded ? Math.min(state.vy, state.launchVy) : state.vy;
  const freeVy = verticalMomentum - GRAVITY * dt;
  const freeY = state.y + (verticalMomentum + freeVy) * 0.5 * dt;
  const moving = Math.hypot(state.vx, state.vz) > 3;
  const crestRelease = moving && state.vy - groundVelocity > GRAVITY * dt * 1.2 && freeY > ground;
  if (wasGrounded && !crestRelease && ((!moving && ground >= state.y - 0.3) || freeY <= ground + 0.006)) {
    // Slow cars must keep ground velocity, or the next incline projection eats their climb.
    state.y = ground; state.vy = groundVelocity; state.grounded = true;
    // The sprung body responds over a wheelbase, so a short stone or deck seam
    // cannot give the whole car the wheel's instantaneous upward velocity.
    state.launchVy = moving ? state.launchVy + (state.vy - state.launchVy) * (1 - Math.exp(-distance / WHEELBASE)) : 0;
  } else {
    state.y = wasGrounded && crestRelease ? Math.max(ground, freeY) : freeY;
    state.vy = freeVy; state.grounded = false; state.airtime += dt;
    if (!wasGrounded && state.y <= ground && (state.vy <= 0 || ground >= oldGround)) {
      // Crossing a deck edge is not an upward terrain velocity. Do not turn
      // that discontinuity into an extra launch or a downward impulse.
      const speed = Math.hypot(state.vx, state.vz);
      const grade = speed > 0.001 && Math.abs(groundVelocity) < 40 ? groundVelocity / speed : 0;
      const projection = speed > 0.001 ? clamp((speed + state.vy * grade) / (speed * (1 + grade * grade)), 0, 1) : 1;
      const contactVy = speed * projection * grade;
      const impact = Math.max(0, contactVy - state.vy);
      state.vx *= projection; state.vz *= projection;
      state.y = ground; state.vy = moving ? contactVy : 0; state.grounded = true;
      state.launchVy = 0;
      if (state.airtime > 0.06) {
        state.landing = clamp(impact / 16, 0, 1);
        state.suspensionVelocity -= Math.min(impact * 0.13, 2.6);
      }
      state.airtime = 0;
    }
  }
  if (state.grounded) state.airtime = 0;
  state.suspensionVelocity += (-95 * state.suspension - 10 * state.suspensionVelocity) * dt;
  state.suspension = clamp(state.suspension + state.suspensionVelocity * dt, -0.22, 0.18);
  const water = environment.waterAt?.(state.x, state.z);
  state.inWater = Boolean(water && water.distance < water.width && state.y < water.y - 0.15);
  if (state.inWater) { state.vx *= Math.exp(-2.5 * dt); state.vz *= Math.exp(-2.5 * dt); }

  forwardX = Math.sin(state.heading); forwardZ = -Math.cos(state.heading);
  rightX = Math.cos(state.heading); rightZ = Math.sin(state.heading);
  forward = state.vx * forwardX + state.vz * forwardZ;
  sideways = state.vx * rightX + state.vz * rightZ;
  state.speed = Math.hypot(state.vx, state.vz); state.slip = Math.abs(sideways);
  state.drift = state.grounded && !state.inWater && state.speed > 4 && state.slip > 2.2;
  const slope = terrainGradient(state.x, state.z, (x, z) => supportAt(x, z, state.y + 1.2));
  const targetPitch = state.grounded ? Math.atan(slope.x * forwardX + slope.z * forwardZ) : clamp(Math.atan2(state.vy, Math.max(8, state.speed)), -0.8, 0.7);
  const targetRoll = state.grounded ? Math.atan(slope.x * rightX + slope.z * rightZ) : state.steer * 0.08;
  state.pitch += (targetPitch - state.pitch) * (1 - Math.exp(-(state.grounded ? 14 : 3.5) * dt));
  state.roll += (targetRoll - state.roll) * (1 - Math.exp(-12 * dt));
  return state;
}
