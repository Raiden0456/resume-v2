import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { RallyTiming, formatTime, formatDelta } from "../js/rally/timing.js";
import { RallyRecovery } from "../js/rally/recovery.js";
import { createCarState, resetCar } from "../js/rally/physics.js";
import { createLandmarks, SPAWN, START_LINE, FINISH_LINE, CROSSINGS, crossingPoint, crossingDeckHeight } from "../js/rally/world.js";

const sights = createLandmarks(JSON.parse(await readFile(new URL("../resume.json", import.meta.url), "utf8")));
const linePose = (line, along, across = 0) => ({ x: line.x + Math.sin(line.heading) * along + Math.cos(line.heading) * across, z: line.z - Math.cos(line.heading) * along + Math.sin(line.heading) * across, heading: line.heading });
const crossLine = (timing, car, line) => {
  resetCar(car, linePose(line, -1)); timing.update(car, 0);
  resetCar(car, linePose(line, 1)); car.speed = 2;
  return timing.update(car, 2);
};
const start = timing => {
  const car = createCarState(SPAWN);
  timing.travel(car); crossLine(timing, car, START_LINE);
  return car;
};
const finish = (timing, seconds = 10) => {
  const car = start(timing);
  for (const sight of sights) {
    resetCar(car, sight.arrival);
    timing.update(car, seconds, sight);
  }
  assert.equal(timing.status, "running", "Highway is a checkpoint, not the finish");
  assert.equal(timing.next.id, "finish");
  crossLine(timing, car, FINISH_LINE);
};
const memory = () => {
  let value = null;
  return { getItem: () => value, setItem: (_, next) => { value = next; } };
};

test("only crossing the start stripe in the upper circle begins a run; Rowte is the first timed checkpoint", () => {
  const timing = new RallyTiming(sights), car = createCarState(sights[0].arrival);
  car.speed = 10; timing.travel(car); timing.update(car, 2, sights[0]);
  assert.equal(timing.status, "idle"); assert.equal(timing.elapsed, 0);
  resetCar(car, SPAWN); timing.travel(car); car.speed = 2; timing.update(car, 2);
  assert.equal(timing.status, "ready"); assert.equal(timing.elapsed, 0, "revving or moving inside the circle does not start the clock");
  crossLine(timing, car, START_LINE);
  assert.equal(timing.status, "running"); assert.equal(timing.elapsed, 1); assert.deepEqual(timing.times, []);
  resetCar(car, sights[0].arrival);
  assert.equal(timing.update(car, 3, sights[0]).index, 0);
  assert.deepEqual(timing.times, [4]);
});

test("driving backward, bypassing a gate and flying over it do not start a run", () => {
  for (const invalid of ["reverse", "outside", "airborne"]) {
    const timing = new RallyTiming(sights), car = createCarState(SPAWN);
    timing.travel(car);
    resetCar(car, linePose(START_LINE, invalid === "reverse" ? 1 : -1, invalid === "outside" ? 15 : 0));
    timing.update(car, 0);
    resetCar(car, linePose(START_LINE, invalid === "reverse" ? -1 : 1, invalid === "outside" ? 15 : 0));
    if (invalid === "airborne") { car.grounded = false; car.y += 10; }
    timing.update(car, 1);
    assert.notEqual(timing.status, "running", invalid);
  }
});

test("splits require all nine checkpoints in order and restarts keep elapsed time", () => {
  const timing = new RallyTiming(sights), car = start(timing);
  resetCar(car, sights[1].arrival);
  assert.equal(timing.update(car, 10, sights[1]), null); assert.equal(timing.next, sights[0]);
  resetCar(car, sights[0].arrival);
  assert.equal(timing.update(car, 3, sights[0]).time, 14);
  assert.equal(timing.update(car, 2, sights[0]), null);
  assert.deepEqual(timing.times, [14]); assert.equal(timing.elapsed, 16);
  timing.update(car, 0, sights[0]); assert.equal(timing.elapsed, 16);
  resetCar(car, SPAWN); timing.update(car, 1);
  assert.equal(timing.elapsed, 17); assert.deepEqual(timing.times, [14]);
  crossLine(timing, car, FINISH_LINE);
  assert.equal(timing.status, "running", "the finish requires every checkpoint");
});

test("crossing the valley arch freezes the clock and saves all checkpoint splits plus the finish", () => {
  const storage = memory(), timing = new RallyTiming(sights, storage);
  finish(timing);
  assert.equal(timing.status, "finished"); assert.equal(timing.elapsed, 92);
  timing.update(createCarState(sights.at(-1).arrival), 10, sights.at(-1));
  assert.equal(timing.elapsed, 92);
  const next = new RallyTiming(sights, storage);
  assert.deepEqual(next.previous, [11, 21, 31, 41, 51, 61, 71, 81, 91, 92]);
  finish(next, 9);
  assert.equal(next.delta(0), -1); assert.equal(next.delta(8), -9); assert.equal(next.delta(9), -9);
  assert.equal(next.reference.at(-1), 92);
  assert.equal(new RallyTiming(sights, storage).previous.at(-1), 83);
});

test("instant travel stays untimed even at Rowte and does not replace a completed descent", () => {
  const storage = memory(), timing = new RallyTiming(sights, storage);
  finish(timing);
  const car = start(timing);
  resetCar(car, sights[0].arrival); timing.update(car, 5, sights[0]);
  timing.travel(car); car.speed = 15; timing.update(car, 2, sights[0]);
  assert.equal(timing.status, "idle"); assert.deepEqual(timing.times, []);
  assert.deepEqual(timing.reference, timing.previous);
  assert.equal(new RallyTiming(sights, storage).previous.at(-1), 92);
  resetCar(car, SPAWN); timing.travel(car);
  assert.equal(timing.status, "ready"); assert.equal(timing.elapsed, 0); assert.equal(timing.reference.at(-1), 92);
});

test("missing, corrupt and older timing storage remain playable", () => {
  for (const value of ["{", "{}", "null", JSON.stringify({ ids: sights.map(s => s.id), times: [0, 10, 20, 30, 40, 50, 60, 70, 80] }), JSON.stringify({ ids: [...sights.map(s => s.id), "finish"], times: [11, 21, 20, 41, 51, 61, 71, 81, 91, 92] })]) {
    const timing = new RallyTiming(sights, { getItem: () => value });
    assert.equal(timing.previous, null); assert.doesNotThrow(() => finish(timing));
  }
  const unavailable = { getItem() { throw Error(); }, setItem() { throw Error(); } };
  const timing = new RallyTiming(sights, unavailable);
  assert.doesNotThrow(() => finish(timing)); assert.equal(timing.previous.at(-1), 92);
});

test("timing labels handle minute boundaries and signed splits", () => {
  assert.equal(formatTime(59.999), "0:59.99"); assert.equal(formatTime(60), "1:00.00");
  assert.equal(formatTime(125.25), "2:05.25"); assert.equal(formatDelta(-1.25), "−1.25 s");
  assert.equal(formatDelta(2.5), "+2.50 s"); assert.equal(formatDelta(null), "FIRST RUN");
  assert.equal(formatTime(null), "—:——.——");
});

test("long off-course falls explode once, wait for the effect and recover; brief jumps remain safe", () => {
  const recovery = new RallyRecovery();
  const car = { ...createCarState(), x: 350, z: 400, y: 180, grounded: false, airtime: 1, vy: -35 };
  assert.equal(recovery.update(car, 0.05), null);
  car.airtime = 1.8;
  assert.equal(recovery.update(car, 0.05), "explode"); assert.equal(recovery.crashed, true);
  assert.equal(recovery.update(car, 0.5), null);
  assert.equal(recovery.update(car, 0.31), "respawn");
  resetCar(car, sights[2].arrival); recovery.reset(car);
  assert.equal(recovery.crashed, false); assert.equal(recovery.update(car, 3), null);
});

test("ramp landing corridors have bounded grace and cannot protect a later mountain fall", () => {
  for (const crossing of CROSSINGS.filter(c => c.type === "jump")) {
    const along = -crossing.gap - 0.5;
    const car = createCarState({ ...crossingPoint(crossing, along), heading: crossing.heading });
    car.y = crossingDeckHeight(crossing, along);
    const recovery = new RallyRecovery(); recovery.reset(car);
    Object.assign(car, crossingPoint(crossing, 0), { y: crossing.y + 35, grounded: false, airtime: 2, vy: -30 });
    assert.equal(recovery.update(car, 0.05), null);
    assert.equal(recovery.jump, crossing);
    car.airtime = 2.8;
    assert.equal(recovery.update(car, 0.05), "explode", "ramp grace must expire after a failed landing");
  }
});

test("water still uses bank recovery and clearing a recovery removes accumulated water time", () => {
  const recovery = new RallyRecovery(), car = { ...createCarState(), inWater: true };
  assert.equal(recovery.update(car, 0.1), "water-entry");
  assert.equal(recovery.update(car, 0.6), null);
  assert.equal(recovery.update(car, 0.1), "splash");
  recovery.reset(car);
  assert.equal(recovery.update(car, 0.1), "water-entry");
});
