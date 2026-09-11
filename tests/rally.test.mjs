import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createCarState, resetCar, stepCar, FIXED_STEP, TOP_SPEED } from "../js/rally/physics.js";
import { RallyRecovery } from "../js/rally/recovery.js";
import { createLandmarks, loadVisits, saveVisits, SPAWN, WORLD, ROUTES, terrainHeight, terrainGradient, roadAt, driveHeightAt, riverAt, RIVER, CROSSINGS, crossingPoint, crossingCoordinates, crossingSections, crossingDeckHeight } from "../js/rally/world.js";

const resume = JSON.parse(await readFile(new URL("../resume.json", import.meta.url), "utf8"));
const run = (state, input, seconds, environment) => {
  for (let i = 0; i < Math.round(seconds / FIXED_STEP); i++) stepCar(state, input, FIXED_STEP, environment);
  return state;
};
const driftAngle = car => Math.atan2(car.slip, Math.abs(car.vx * Math.sin(car.heading) - car.vz * Math.cos(car.heading)));

test("all projects and all jobs have unique, reachable sightseeing stops", () => {
  const sights = createLandmarks(resume);
  const expected = resume.experience.reduce((sum, job) => sum + (job.projects?.length || 1), 0);
  assert.equal(sights.length, expected);
  assert.equal(new Set(sights.map(sight => sight.id)).size, expected);
  for (const job of resume.experience) assert.ok(sights.some(sight => sight.company === job.company));
  for (const sight of sights) {
    assert.ok(sight.description && sight.stack.length && sight.subsections.length);
    assert.ok(Math.abs(sight.marker[0]) < WORLD.limitX && Math.abs(sight.marker[1]) < WORLD.limitZ);
    assert.ok(Math.hypot(sight.x - sight.marker[0], sight.z - sight.marker[1]) > sight.radius + 1.15);
    assert.ok(sights.every(other => Math.hypot(other.x - sight.marker[0], other.z - sight.marker[1]) > other.radius + 1.15));
  }
});

test("throttle accelerates forward and braking transitions into reverse", () => {
  const car = run(createCarState(), { throttle: 1 }, 1);
  assert.ok(car.speed > 10);
  assert.ok((car.x - SPAWN.x) * Math.sin(SPAWN.heading) - (car.z - SPAWN.z) * Math.cos(SPAWN.heading) > 5);
  run(car, { throttle: -1 }, 3);
  assert.ok(car.vx * Math.sin(car.heading) - car.vz * Math.cos(car.heading) < -2);
});

test("the handbrake widens a drift while retaining most of the cornering pace", () => {
  const normal = run(createCarState(), { throttle: 1 }, 1.5);
  const sliding = { ...normal };
  run(normal, { throttle: 1, steer: 1 }, 0.8);
  run(sliding, { throttle: 1, steer: 1, handbrake: true }, 0.8);
  assert.ok(sliding.slip > normal.slip * 1.3);
  assert.ok(sliding.speed < normal.speed);
  assert.ok(sliding.speed > normal.speed * 0.85);
  assert.ok(sliding.drift);
});

test("turn-in promptly starts a natural drift on flat and cambered roads", () => {
  for (const heightAt of [() => 0, (x, z) => x * 0.3 + z * 0.2]) for (const steer of [-1, 1]) {
    const car = createCarState({ x: 0, z: 0, heading: 0 }, heightAt);
    car.vz = -25; car.speed = 25;
    car.vy = -25 * terrainGradient(0, 0, heightAt).z; car.launchVy = car.vy;
    run(car, { throttle: 1, steer }, 0.2, { heightAt });
    assert.ok(car.heading * steer > 0.13 && car.yaw * steer > 1, "steering must respond during a short key press");
    run(car, { throttle: 1, steer }, 0.6, { heightAt });
    assert.ok(car.grounded && car.drift && driftAngle(car) > 0.45, "turning alone must bring the rear out");
    assert.ok(car.speed > 22, "entering a slide must preserve the run-up");
  }
});

test("releasing the handbrake recovers grip progressively without killing the drift's pace", () => {
  for (const heightAt of [() => 0, (x, z) => x * 0.3 + z * 0.2]) {
    const car = createCarState({ x: 0, z: 0, heading: 0 }, heightAt);
    car.vz = -25; car.speed = 25;
    car.vy = -25 * terrainGradient(0, 0, heightAt).z; car.launchVy = car.vy;
    run(car, { throttle: 1, steer: 1, handbrake: true }, 1.4, { heightAt });
    assert.ok(car.speed > 20 && driftAngle(car) > 0.9);
    const speed = car.speed, angle = driftAngle(car);
    run(car, { throttle: 1 }, 0.25, { heightAt });
    assert.ok(driftAngle(car) > angle * 0.3 && driftAngle(car) < angle * 0.8, "the rear must settle progressively");
    assert.ok(car.speed > speed * 0.9, "recovering grip must redirect sideways momentum, not erase it");
    run(car, { throttle: 1 }, 1.15, { heightAt });
    assert.ok(driftAngle(car) < 0.08 && car.grounded, "the slide must still be easy to catch");
  }
});

test("moderate steering starts a rally slide without the handbrake", () => {
  for (const heightAt of [() => 0, (x, z) => x * 0.3 + z * 0.2]) for (const steer of [-0.5, -0.35, 0.35, 0.5]) {
    const car = createCarState({ x: 0, z: 0, heading: 0 }, heightAt);
    car.vz = -15; car.speed = 15;
    car.vy = -15 * terrainGradient(0, 0, heightAt).z; car.launchVy = car.vy;
    run(car, { throttle: 1, steer }, 1, { heightAt });
    assert.ok(car.grounded && car.drift && driftAngle(car) > 0.17, "a gentle corner must also bring the rear out");
    assert.ok(car.speed > 14);
  }
});

test("a short handbrake tap helps initiate a slide that continues after release", () => {
  for (const heightAt of [() => 0, (x, z) => x * 0.3 + z * 0.2]) {
    const car = createCarState({ x: 0, z: 0, heading: 0 }, heightAt);
    car.vz = -22; car.speed = 22;
    car.vy = -22 * terrainGradient(0, 0, heightAt).z; car.launchVy = car.vy;
    const unassisted = { ...car };
    run(car, { throttle: 1, steer: 1, handbrake: true }, 0.18, { heightAt });
    run(unassisted, { throttle: 1, steer: 1 }, 0.18, { heightAt });
    assert.ok(driftAngle(car) > driftAngle(unassisted) * 1.2, "the tap must help the rear break away");
    run(car, { throttle: 1, steer: 0.55 }, 0.6, { heightAt });
    assert.ok(car.drift && driftAngle(car) > 0.3);
    run(car, { throttle: 1, steer: 0.55 }, 0.6, { heightAt });
    assert.ok(car.grounded && car.drift && driftAngle(car) > 0.35, "throttle and steering must sustain the slide with Space released");
    assert.ok(car.speed > 20);
  }
});

test("countersteering changes the rotation promptly while the car keeps moving", () => {
  const heightAt = () => 0;
  for (const steer of [-1, 1]) {
    const car = createCarState({ x: 0, z: 0, heading: 0 }, heightAt);
    car.vz = -25; car.speed = 25;
    run(car, { throttle: 1, steer }, 0.8, { heightAt });
    const speed = car.speed;
    run(car, { throttle: 1, steer: -steer }, 0.2, { heightAt });
    assert.ok(car.yaw * steer < -0.7, "countersteering must not wait for forward traction to return");
    assert.ok(car.speed > speed * 0.9);
  }
});

test("sustained arcade slides respect top speed and do not create momentum after lift-off", () => {
  const heightAt = () => 0;
  for (const handbrake of [false, true]) {
    const car = createCarState({ x: 0, z: 0, heading: 0 }, heightAt);
    car.vz = -25; car.speed = 25;
    for (let i = 0; i < 480; i++) {
      stepCar(car, { throttle: 1, steer: 1, handbrake }, FIXED_STEP, { heightAt });
      assert.ok(car.speed <= TOP_SPEED + 1e-6 && Number.isFinite(car.heading));
    }
    assert.ok(car.drift && car.speed > 25);
    let previousSpeed = car.speed;
    for (let i = 0; i < 120; i++) {
      stepCar(car, {}, FIXED_STEP, { heightAt });
      assert.ok(car.speed <= previousSpeed + 1e-8);
      previousSpeed = car.speed;
    }
  }
});

test("leaving gravel retains pace instead of imposing an off-road speed limit", () => {
  const road = run(createCarState(), { throttle: 1 }, 2, { onRoad: true });
  const scrub = run(createCarState(), { throttle: 1 }, 2, { onRoad: false });
  assert.ok(scrub.speed < road.speed);
  assert.ok(scrub.speed > road.speed * 0.9);
  const fast = createCarState(SPAWN, () => 0); fast.vz = TOP_SPEED - 0.5; fast.speed = fast.vz;
  stepCar(fast, { throttle: 1 }, FIXED_STEP, { onRoad: false, heightAt: () => 0 });
  assert.ok(fast.speed > TOP_SPEED - 0.7, "crossing the verge must not abruptly clamp speed");
});

test("a handbrake turn still drifts when the driver lifts off the throttle", () => {
  const car = run(createCarState(), { throttle: 1 }, 1.3, { heightAt: terrainHeight });
  run(car, { steer: 1, handbrake: true }, 0.6, { heightAt: terrainHeight });
  assert.ok(car.drift);
  assert.ok(car.slip > 2.2);
});

test("buildings resolve collisions without trapping the car at their centre", () => {
  const car = createCarState();
  const obstacle = { x: SPAWN.x, z: SPAWN.z, radius: 6 };
  stepCar(car, {}, FIXED_STEP, { obstacles: [obstacle] });
  assert.ok(Math.hypot(car.x - obstacle.x, car.z - obstacle.z) >= 7.149);
  assert.ok(Object.values(car).every(value => typeof value !== "number" || Number.isFinite(value)));
});

test("parked cars block a ground collision but allow a jump above their roof", () => {
  const obstacle = { x: SPAWN.x, z: SPAWN.z, elevation: 0, radius: 2.6, height: 2.7 };
  const environment = { heightAt: () => 0, obstacles: [obstacle] };
  const grounded = createCarState(SPAWN, environment.heightAt);
  stepCar(grounded, {}, FIXED_STEP, environment);
  assert.ok(Math.hypot(grounded.x - obstacle.x, grounded.z - obstacle.z) >= 3.749);
  const jumping = { ...createCarState(SPAWN, environment.heightAt), y: 4, grounded: false, vy: -1 };
  stepCar(jumping, {}, FIXED_STEP, environment);
  assert.equal(jumping.x, SPAWN.x);
  assert.equal(jumping.z, SPAWN.z);
  assert.ok(jumping.y < 4 && jumping.y > obstacle.height);
});

test("world boundaries contain the car, including after a long frame", () => {
  const car = { ...createCarState(), x: WORLD.limitX - 0.1, vx: 30, heading: Math.PI / 2 };
  stepCar(car, { throttle: 1 }, 5);
  assert.ok(Math.abs(car.x) <= WORLD.limitX);
  assert.ok(Math.abs(car.z) <= WORLD.limitZ);
  assert.ok(car.vx <= 0);
});

test("reset restores heading and clears every source of momentum", () => {
  const car = run(createCarState(), { throttle: 1, steer: 1, handbrake: true }, 1);
  resetCar(car);
  assert.deepEqual(car, createCarState());
});

test("discovery persistence tolerates stale, malformed and unavailable storage", () => {
  const sights = createLandmarks(resume);
  let value = '["rowte","rowte","removed-project"]';
  const storage = { getItem: () => value, setItem: (_, saved) => { value = saved; } };
  assert.deepEqual([...loadVisits(storage, sights)], ["rowte"]);
  saveVisits(storage, new Set(["rowte", "aurus"]));
  assert.deepEqual([...loadVisits(storage, sights)], ["rowte", "aurus"]);
  value = "{broken";
  assert.equal(loadVisits(storage, sights).size, 0);
  value = '{}';
  assert.equal(loadVisits(storage, sights).size, 0);
  assert.equal(loadVisits(undefined, sights).size, 0);
  assert.doesNotThrow(() => saveVisits(undefined, new Set(["rowte"])));
});

test("the continuous course descends through every project from newest to oldest", () => {
  const sights = createLandmarks(resume);
  assert.equal(sights[0].id, "rowte");
  assert.equal(sights.at(-1).id, "highway");
  assert.equal(terrainHeight(SPAWN.x, SPAWN.z), WORLD.summit);
  assert.ok(Math.hypot(sights[0].marker[0] - SPAWN.x, sights[0].marker[1] - SPAWN.z) < 30);
  const samples = ROUTES.flatMap(route => route.samples);
  let lastIndex = -1;
  for (const [i, sight] of sights.entries()) {
    if (i) {
      assert.ok(sight.elevation < sights[i - 1].elevation);
      assert.ok(sight.courseDistance > sights[i - 1].courseDistance);
    }
    const index = samples.findIndex(([x, z]) => Math.hypot(x - sight.marker[0], z - sight.marker[1]) < 0.1);
    assert.ok(index > lastIndex, `${sight.id} lies on the course in chronological order`);
    lastIndex = index;
  }
  for (const [i, route] of ROUTES.entries()) {
    if (i) assert.ok(route.samples[0].every((value, axis) => Math.abs(value - ROUTES[i - 1].samples.at(-1)[axis]) < 1e-8));
    for (const [x, z] of route.samples) {
      const slope = terrainGradient(x, z);
      if (CROSSINGS.every(crossing => Math.hypot(x - crossing.x, z - crossing.z) > crossing.gap + 28)) assert.ok(Math.hypot(slope.x, slope.z) < 0.85, "ordinary road grading must remain driveable outside the bridges and jumps");
      assert.ok(sights.every(sight => Math.hypot(x - sight.x, z - sight.z) > sight.radius + 1.15 + route.width / 2));
    }
  }
  assert.ok(terrainHeight(...samples.at(-1)) < 1);
});

test("stages have different lengths and widths, with exposed relief beside the road", () => {
  const lengths = ROUTES.map(route => route.samples.slice(1).reduce((sum, [x, z], i) => sum + Math.hypot(x - route.samples[i][0], z - route.samples[i][1]), 0));
  assert.ok(lengths.reduce((a, b) => a + b) > 2200);
  assert.ok(Math.max(...lengths) > Math.min(...lengths) * 1.6);
  assert.ok(new Set(ROUTES.map(route => route.width)).size >= 5);
  let northbound = 0, steepSides = 0;
  for (const route of ROUTES) for (let i = 1; i < route.samples.length; i++) {
    const [x, z] = route.samples[i], previous = route.samples[i - 1];
    northbound += Math.max(0, previous[1] - z);
    if (i % 20) continue;
    const heading = roadAt(x, z).heading;
    for (const side of [-1, 1]) {
      const outside = terrainHeight(x + Math.cos(heading) * side * 25, z + Math.sin(heading) * side * 25);
      if (Math.abs(terrainHeight(x, z) - outside) > 24) steepSides++;
    }
  }
  assert.ok(northbound > 150, "the descent winds around ridges, not just a repeated southbound snake");
  assert.ok(steepSides > 12, "cliffs and cuts must be actual terrain beside the course");
});

test("lookouts provide level parking and their businesses have the right identities", () => {
  const sights = createLandmarks(resume);
  assert.equal(sights.find(sight => sight.id === "facestellar").type, "salon");
  assert.equal(sights.find(sight => sight.id === "supplier").type, "accelerator");
  for (const sight of sights) {
    const slope = terrainGradient(...sight.marker);
    assert.ok(Math.hypot(slope.x, slope.z) < 0.001);
    for (const dx of [-7, 7]) for (const dz of [-5, 5]) {
      assert.ok(Math.abs(terrainHeight(sight.x + dx, sight.z + dz) - sight.elevation) < 0.01);
    }
  }
});

test("the car and its pitch follow the terrain while uphill travel costs speed", () => {
  const slope = (x, z) => ((x - SPAWN.x) * Math.sin(SPAWN.heading) - (z - SPAWN.z) * Math.cos(SPAWN.heading)) * 0.25;
  const uphill = run(createCarState(SPAWN, slope), { throttle: 1 }, 1.5, { onRoad: true, heightAt: slope });
  const flat = run(createCarState(SPAWN, () => 0), { throttle: 1 }, 1.5, { onRoad: true, heightAt: () => 0 });
  assert.equal(uphill.y, slope(uphill.x, uphill.z));
  assert.ok(uphill.pitch > 0.1);
  assert.ok(uphill.speed < flat.speed * 0.75, "even a moderate climb must noticeably cost speed");
});

test("a steep bank consumes the run-up and cannot be climbed at full speed", () => {
  const heightAt = x => Math.max(0, Math.min(18, (x - 8) * 1.2));
  const car = createCarState({ x: 0, z: 0, heading: Math.PI / 2 }, heightAt);
  car.vx = 25; car.speed = 25;
  run(car, { throttle: 1 }, 8, { heightAt });
  assert.ok(car.x > 8 && car.x < 23, "the run-up cannot carry the car to the top of this bank");
  assert.ok(car.speed < 0.1 && car.grounded, "holding the gas must stall on the steep climb");
  const stopped = car.x;
  run(car, { throttle: 1 }, 4, { heightAt });
  assert.ok(Math.abs(car.x - stopped) < 0.1, "continued throttle must not ratchet the car up the bank");
});

test("entering an incline redirects momentum without adding kinetic energy", () => {
  for (const grade of [0.5, 1.2]) {
    const heightAt = x => Math.max(0, x * grade);
    const car = createCarState({ x: -0.5, z: 0, heading: Math.PI / 2 }, heightAt);
    car.vx = 25; car.speed = 25;
    let previousEnergy = 25 ** 2;
    for (let i = 0; i < 50; i++) {
      stepCar(car, {}, FIXED_STEP, { heightAt });
      const energy = car.vx ** 2 + car.vz ** 2 + car.vy ** 2;
      assert.ok(energy <= previousEnergy + 1e-6, "climbing without the engine must not create vertical energy");
      previousEnergy = energy;
    }
    assert.ok(car.x > 0 && car.speed < 20 && car.grounded);
  }
});

test("landing against an uphill bank dissipates momentum instead of launching again", () => {
  const heightAt = x => x * 0.8;
  const car = createCarState({ x: 0, z: 0, heading: Math.PI / 2 }, heightAt);
  car.y = 0.5; car.vx = 18; car.speed = 18; car.vy = -12; car.grounded = false; car.airtime = 0.2;
  for (let i = 0; i < 60; i++) {
    const incomingEnergy = car.vx ** 2 + car.vz ** 2 + car.vy ** 2;
    stepCar(car, {}, FIXED_STEP, { heightAt });
    if (!car.grounded) continue;
    assert.ok(car.vx ** 2 + car.vz ** 2 + car.vy ** 2 < incomingEnergy);
    assert.ok(car.speed < 9 && car.landing > 0.5 && car.suspensionVelocity < 0);
    run(car, { throttle: 1 }, 0.5, { heightAt });
    assert.ok(car.grounded);
    return;
  }
  assert.fail("the car must land on the bank");
});

test("small bumps at rally speeds produce brief hops instead of high launches", () => {
  for (const [height, width] of [[0.2, 1], [0.3, 4]]) for (const speed of [25, 33]) {
    const heightAt = x => x > 8 && x < 8 + width ? height * Math.sin((x - 8) / width * Math.PI) : 0;
    const car = createCarState({ x: 0, z: 0, heading: Math.PI / 2 }, heightAt);
    car.vx = speed; car.speed = speed;
    let peak = 0, longestFlight = 0;
    for (let i = 0; i < 240; i++) {
      stepCar(car, { throttle: 1 }, FIXED_STEP, { heightAt });
      peak = Math.max(peak, car.y);
      longestFlight = Math.max(longestFlight, car.airtime);
    }
    assert.ok(peak < 0.55, "a small stone must not throw the body metres into the air");
    assert.ok(longestFlight < 0.3 && car.grounded, "the car must settle quickly after a bump");
  }
});


test("a parked car and residual low-speed momentum settle on steep slopes", () => {
  const heightAt = (x, z) => x * 0.9 - z * 0.8;
  for (const heading of [0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const car = createCarState({ ...SPAWN, heading }, heightAt);
    run(car, {}, 10, { heightAt });
    assert.equal(car.x, SPAWN.x);
    assert.equal(car.z, SPAWN.z);
    car.vx = Math.sin(heading) * 1.2; car.vz = -Math.cos(heading) * 1.2; car.speed = 1.2;
    run(car, {}, 5, { heightAt });
    assert.equal(car.speed, 0, "small residual motion cannot sustain an endless downhill slide");
    const parked = { x: car.x, z: car.z };
    run(car, { steer: 1 }, 10, { heightAt });
    assert.equal(car.x, parked.x); assert.equal(car.z, parked.z);
  }
});

test("releasing the gas stops a downhill car and the handbrake stops it sooner", () => {
  const heightAt = (x, z) => -z * 0.65;
  const coast = createCarState({ x: 0, z: 0, heading: Math.PI }, heightAt);
  coast.vz = 20; coast.speed = 20;
  const braking = { ...coast };
  run(coast, {}, 10, { heightAt });
  run(braking, { handbrake: true }, 10, { heightAt });
  assert.equal(coast.speed, 0); assert.equal(braking.speed, 0);
  assert.ok(braking.z < coast.z * 0.65);
});

test("instant travel clears momentum and faces down the road at every destination", () => {
  const sights = createLandmarks(resume);
  const car = run(createCarState(), { throttle: 1, steer: 1, handbrake: true }, 2);
  for (const sight of sights) {
    resetCar(car, sight.arrival);
    assert.equal(car.x, sight.marker[0]); assert.equal(car.z, sight.marker[1]);
    assert.equal(car.y, sight.elevation);
    assert.equal(car.speed, 0); assert.equal(car.slip, 0); assert.equal(car.yaw, 0);
    assert.equal(car.steer, 0); assert.equal(car.drift, false);
    assert.ok(Math.abs(car.pitch) + Math.abs(car.roll) < 0.001);
    const start = { x: car.x, z: car.z };
    run(car, { throttle: 1 }, 0.7, { onRoad: true, heightAt: terrainHeight, obstacles: sights });
    assert.ok(roadAt(car.x, car.z).distance < 4);
    assert.ok(Math.hypot(car.x - start.x, car.z - start.z) > 2);
  }
});


test("driving over a cliff preserves momentum and falls under gravity", () => {
  const heightAt = x => x < 0 ? 18 : 0;
  const car = createCarState({ x: -2, z: 0, heading: Math.PI / 2 }, heightAt);
  car.vx = 20; car.speed = 20;
  run(car, {}, 0.3, { heightAt });
  assert.ok(car.x > 0 && !car.grounded);
  assert.ok(car.y > 17 && car.y < 18 && car.vy < 0);
  const airborne = { ...car };
  run(car, { throttle: -1, handbrake: true, steer: 1 }, 0.2, { heightAt });
  assert.ok(car.vx > airborne.vx * 0.98, "tyre controls cannot brake in midair");
  assert.ok(car.vy < airborne.vy - 3);
  let landed = false;
  for (let i = 0; i < 250; i++) { stepCar(car, {}, FIXED_STEP, { heightAt }); if (car.grounded) { landed = true; break; } }
  assert.ok(landed && car.y === 0);
  assert.ok(car.landing > 0.5 && car.suspensionVelocity < 0);
  run(car, {}, 4, { heightAt });
  assert.ok(Math.abs(car.suspension) < 0.01);
});

test("a rounded crest launches the car without a scripted jump trigger", () => {
  const heightAt = x => x < 15 ? x * 0.25 : Math.max(-14, 3.75 + (x - 15) * 0.25 - (x - 15) ** 2 * 0.04);
  const car = createCarState({ x: 8, z: 0, heading: Math.PI / 2 }, heightAt);
  car.vx = 23; car.speed = 23; car.vy = 23 * 0.25;
  let flew = false;
  for (let i = 0; i < 130; i++) {
    stepCar(car, { throttle: 1 }, FIXED_STEP, { heightAt });
    if (!car.grounded && car.y - heightAt(car.x) > 0.4) flew = true;
  }
  assert.ok(flew);
});

test("the stream descends continuously through the mountain with five safe crossings", () => {
  assert.ok(RIVER[0][1] < -400 && RIVER.at(-1)[1] > 470);
  assert.ok(RIVER[0][2] - RIVER.at(-1)[2] > 300);
  for (let i = 1; i < RIVER.length; i++) assert.ok(RIVER[i][2] <= RIVER[i - 1][2] + 1e-6);
  assert.equal(CROSSINGS.filter(crossing => crossing.type === "bridge").length, 3);
  assert.equal(CROSSINGS.filter(crossing => crossing.type === "jump").length, 2);
  const sights = createLandmarks(resume);
  for (const [x, z, y, width] of RIVER.filter((_, i) => i % 8 === 0)) {
    assert.ok(terrainHeight(x, z) < y - 1, "the water must sit above its riverbed");
    assert.ok(sights.every(sight => Math.hypot(x - sight.x, z - sight.z) > width + 30));
  }
});

test("bridges support the car above the water and do not teleport cars from underneath", () => {
  for (const crossing of CROSSINGS.filter(crossing => crossing.type === "bridge")) {
    const water = riverAt(crossing.x, crossing.z);
    const deck = driveHeightAt(crossing.x, crossing.z);
    assert.ok(deck > water.y + 3);
    assert.ok(driveHeightAt(crossing.x, crossing.z, water.y) < water.y);
    const car = createCarState({ x: crossing.x, z: crossing.z, heading: crossing.heading });
    run(car, {}, 2, { heightAt: driveHeightAt, supportAt: driveHeightAt, waterAt: riverAt });
    assert.equal(car.y, deck); assert.ok(car.grounded && !car.inWater);
  }
});

test("bridge approaches join the road across their full width without holes in either direction", () => {
  for (const crossing of CROSSINGS.filter(c => c.type === "bridge")) {
    const [[from, to]] = crossingSections(crossing);
    for (const end of [from, to]) for (const side of [-0.95, 0, 0.95]) {
      const p = crossingPoint(crossing, end, side * crossing.halfWidth);
      assert.ok(Math.abs(crossingDeckHeight(crossing, end) - terrainHeight(p.x, p.z)) < 0.15, `${crossing.label} must overlap solid road across the whole approach`);
    }
    for (const direction of [-1, 1]) for (const side of [-0.7, 0, 0.7]) {
      const beginning = direction > 0 ? from - 4 : to + 4;
      const position = crossingPoint(crossing, beginning, side * crossing.halfWidth);
      const car = createCarState({ ...position, heading: roadAt(position.x, position.z).heading + (direction < 0 ? Math.PI : 0) });
      let arrived = false;
      for (let i = 0; i < 2400; i++) {
        const road = roadAt(car.x, car.z);
        car.heading = road.heading + (direction < 0 ? Math.PI : 0); car.yaw = 0;
        car.vx = Math.sin(car.heading) * 16; car.vz = -Math.cos(car.heading) * 16;
        stepCar(car, { throttle: 1 }, FIXED_STEP, { heightAt: driveHeightAt, supportAt: driveHeightAt, waterAt: riverAt });
        assert.ok(!car.inWater && car.airtime < 0.25, `${crossing.label} must be driveable through both deck joints`);
        const { along } = crossingCoordinates(crossing, car.x, car.z);
        if (direction > 0 ? along > to + 3 : along < from - 3) { arrived = true; break; }
      }
      assert.ok(arrived, `${crossing.label} must not block the car at a seam`);
    }
  }
});

test("both ramps launch, clear the open water and land on the far bank", () => {
  for (const crossing of CROSSINGS.filter(crossing => crossing.type === "jump")) for (const speed of [0, 25, TOP_SPEED]) {
    assert.ok(driveHeightAt(crossing.x, crossing.z) < riverAt(crossing.x, crossing.z).y, "the gap must be open air above water");
    const start = crossingPoint(crossing, -crossing.gap - (speed ? crossing.rampLength + 3 : 42));
    const car = createCarState({ ...start, heading: crossing.heading });
    const recovery = new RallyRecovery(); recovery.reset(car);
    car.vx = Math.sin(car.heading) * speed; car.vz = -Math.cos(car.heading) * speed; car.speed = speed;
    let crossed = false, landed = false, maxClearance = 0, launchHeight = null, peak = 0, flightTime = 0;
    for (let i = 0; i < 720; i++) {
      stepCar(car, { throttle: 1 }, FIXED_STEP, { heightAt: driveHeightAt, supportAt: driveHeightAt, waterAt: riverAt });
      assert.equal(recovery.update(car, FIXED_STEP), null, "a normal ramp jump must never trigger crash recovery");
      const { along } = crossingCoordinates(crossing, car.x, car.z);
      if (along > -crossing.gap - 1 && !car.grounded) {
        launchHeight ??= car.y;
        peak = Math.max(peak, car.y - launchHeight);
        flightTime += FIXED_STEP;
      }
      if (Math.abs(along) < crossing.gap) {
        crossed = true;
        assert.ok(!car.grounded && !car.inWater, `${crossing.label} must cross in flight`);
        maxClearance = Math.max(maxClearance, car.y - riverAt(car.x, car.z).y);
      }
      if (crossed && along > crossing.gap && car.grounded) { landed = true; break; }
    }
    assert.ok(crossed && landed && maxClearance > 5, crossing.label);
    assert.ok(peak < 3 && flightTime < 1.3, "even a fast jump must have a low, heavy arc");
  }
});

test("a failed jump reaches the water instead of snapping to the far bank", () => {
  const crossing = CROSSINGS.find(crossing => crossing.type === "jump");
  const water = riverAt(crossing.x, crossing.z);
  const car = createCarState({ x: crossing.x, z: crossing.z, heading: crossing.heading });
  car.y = water.y + 4; car.grounded = false;
  run(car, {}, 1.5, { heightAt: driveHeightAt, supportAt: driveHeightAt, waterAt: riverAt });
  assert.ok(car.inWater && car.y < water.y);
});
