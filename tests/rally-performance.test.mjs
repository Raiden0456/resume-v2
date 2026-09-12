import test from "node:test";
import assert from "node:assert/strict";
import { RallyFrameLoop, loadGraphicsQuality, saveGraphicsQuality } from "../js/rally/performance.js";
import { createCarState, stepCar, FIXED_STEP } from "../js/rally/physics.js";

function harness(draw = () => {}) {
  const callbacks = new Map(), frames = [];
  let sequence = 0;
  const loop = new RallyFrameLoop((time, dt) => { frames.push({ time, dt }); draw(time, dt); }, callback => {
    callbacks.set(++sequence, callback); return sequence;
  }, id => callbacks.delete(id));
  return { loop, frames, callbacks, tick(time) {
    const pending = [...callbacks.values()]; callbacks.clear();
    pending.forEach(callback => callback(time));
  } };
}

test("30 and 60 FPS caps work across common display refresh rates without changing driving time", () => {
  const reference = createCarState();
  for (let i = 0; i < 10 / FIXED_STEP; i++) stepCar(reference, { throttle: 1 }, FIXED_STEP);
  for (const fps of [30, 60]) for (const refresh of [60, 120, 144, 165]) {
    const car = createCarState();
    let accumulator = 0, steps = 0;
    const h = harness((_, dt) => {
      accumulator += dt;
      while (accumulator + 1e-9 >= FIXED_STEP) {
        stepCar(car, { throttle: 1 }, FIXED_STEP);
        accumulator -= FIXED_STEP; steps++;
      }
    });
    h.loop.setRate(fps);
    for (let i = 0; i <= refresh * 10; i++) h.tick(i * 1000 / refresh);
    assert.ok(h.frames.length >= fps * 10 && h.frames.length <= fps * 10 + 1, `${fps} FPS on ${refresh} Hz: ${h.frames.length} frames`);
    assert.equal(steps, 10 / FIXED_STEP);
    assert.deepEqual(car, reference);
    assert.equal(h.callbacks.size, 1, "there is only one animation callback pending");
  }
});

test("suspending cancels all work; resuming excludes paused time", () => {
  const h = harness();
  h.loop.setRate(30); h.tick(0); h.tick(100 / 3);
  h.loop.setRate(0);
  assert.equal(h.callbacks.size, 0);
  h.tick(60000);
  assert.equal(h.frames.length, 2);
  h.loop.setRate(30); h.tick(60000);
  assert.equal(h.frames.at(-1).dt, 0);
  h.tick(60000 + 100 / 3);
  assert.ok(Math.abs(h.frames.at(-1).dt - 1 / 30) < 1e-9);
});

test("still-view invalidation draws once and can be cancelled before hiding", () => {
  const h = harness();
  h.loop.invalidate(); h.loop.invalidate();
  assert.equal(h.callbacks.size, 1);
  h.tick(1000);
  assert.deepEqual(h.frames, [{ time: 1000, dt: 0 }]);
  assert.equal(h.callbacks.size, 0);
  h.loop.invalidate(); h.loop.setRate(0);
  assert.equal(h.callbacks.size, 0);
});

test("a callback can suspend itself without scheduling another frame", () => {
  const h = harness(() => h.loop.setRate(0));
  h.loop.setRate(60); h.tick(0);
  assert.equal(h.frames.length, 1);
  assert.equal(h.callbacks.size, 0);
});

test("a long stall bounds physics catch-up work", () => {
  const h = harness();
  h.loop.setRate(30); h.tick(0); h.tick(5000);
  assert.equal(h.frames.at(-1).dt, 0.1);
  h.tick(5000 + 100 / 3);
  assert.ok(Math.abs(h.frames.at(-1).dt - 1 / 30) < 1e-9);
});

test("graphics preferences default to balanced and tolerate unavailable or stale storage", () => {
  let value;
  const storage = { getItem: () => value, setItem: (_, next) => { value = next; } };
  assert.equal(loadGraphicsQuality(storage), "balanced");
  saveGraphicsQuality(storage, "eco");
  assert.equal(loadGraphicsQuality(storage), "eco");
  value = "__proto__";
  assert.equal(loadGraphicsQuality(storage), "balanced");
  const blocked = { getItem() { throw Error("Unavailable"); }, setItem() { throw Error("Unavailable"); } };
  assert.equal(loadGraphicsQuality(blocked), "balanced");
  assert.doesNotThrow(() => saveGraphicsQuality(blocked, "high"));
});
