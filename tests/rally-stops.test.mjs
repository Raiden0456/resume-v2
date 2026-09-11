import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { OrthographicCamera, Vector3 } from "../js/vendor/three/three.module.min.js";
import { RallyStops } from "../js/rally/stops.js";
import { createCameraRig } from "../js/rally/camera.js";
import { createLandmarks, SPAWN, terrainHeight } from "../js/rally/world.js";
import { createCarState, resetCar } from "../js/rally/physics.js";

const resume = JSON.parse(await readFile(new URL("../resume.json", import.meta.url), "utf8"));
const sights = createLandmarks(resume);
const park = (stops, sight = sights[0]) => {
  const car = createCarState(sight.arrival);
  for (let i = 0; i < 10; i++) stops.update(car, 0.05);
  return car;
};

test("every lookout becomes the restart checkpoint when driven through", () => {
  const stops = new RallyStops(sights);
  assert.deepEqual(stops.restartPose, SPAWN);
  const car = createCarState();
  for (const sight of sights) {
    resetCar(car, sight.arrival); car.speed = 24;
    stops.update(car, 0.05);
    assert.equal(stops.checkpoint, sight);
    assert.deepEqual(stops.restartPose, sight.arrival);
    assert.equal(stops.ready, false, "passing a checkpoint must not start the close-up");
    resetCar(car, stops.restartPose);
    assert.equal(car.speed, 0); assert.equal(car.vy, 0);
    assert.equal(car.y, sight.elevation);
  }
  const pose = stops.restartPose; pose.x = 999;
  assert.notEqual(stops.restartPose.x, 999);
});

test("a brief stop unlocks exploration; accelerating or leaving restores driving", () => {
  const stops = new RallyStops(sights), car = createCarState(sights[0].arrival);
  for (let i = 0; i < 4; i++) stops.update(car, 0.05);
  assert.equal(stops.ready, false);
  assert.equal(stops.open(), null);
  for (let i = 0; i < 6; i++) stops.update(car, 0.05);
  assert.equal(stops.ready, true);
  car.speed = 1.2; stops.update(car, 0.05);
  assert.equal(stops.ready, true, "minor residual motion must not flicker the stop prompt");
  car.speed = 2; stops.update(car, 0.05);
  assert.equal(stops.ready, false);
  assert.equal(stops.open(), null);
  car.speed = 0; car.x += 50; stops.update(car, 0.05);
  assert.equal(stops.nearby, null);
  assert.equal(stops.checkpoint, sights[0]);
});

test("flying over a lookout, wrong elevation and water cannot activate checkpoints", () => {
  for (const invalid of [{ grounded: false }, { inWater: true }, { y: sights[0].elevation + 10 }]) {
    const stops = new RallyStops(sights);
    const car = Object.assign(createCarState(sights[0].arrival), invalid);
    for (let i = 0; i < 20; i++) stops.update(car, 0.05);
    assert.equal(stops.checkpoint, null); assert.equal(stops.ready, false);
    assert.equal(stops.open(), null);
  }
});

test("reading holds the selected lookout until the side card is closed", () => {
  const stops = new RallyStops(sights), car = park(stops);
  assert.equal(stops.open(), sights[0]);
  resetCar(car, sights[1].arrival); stops.update(car, 0.05);
  assert.equal(stops.viewing, sights[0]); assert.equal(stops.checkpoint, sights[0]);
  stops.close(); stops.update(car, 0.05);
  assert.equal(stops.viewing, null); assert.equal(stops.checkpoint, sights[1]);
  assert.equal(stops.ready, false, "a new lookout needs its own stop");
});

test("the latest checkpoint persists and unavailable or stale storage is safe", () => {
  let value = null;
  const storage = { getItem: () => value, setItem: (_, id) => { value = id; } };
  const stops = new RallyStops(sights, storage);
  park(stops, sights[4]);
  assert.equal(new RallyStops(sights, storage).checkpoint, sights[4]);
  value = "removed-project";
  assert.deepEqual(new RallyStops(sights, storage).restartPose, SPAWN);
  const unavailable = { getItem() { throw Error(); }, setItem() { throw Error(); } };
  const session = new RallyStops(sights, unavailable);
  assert.doesNotThrow(() => park(session, sights[5]));
  assert.equal(session.checkpoint, sights[5]);
});

test("lookout camera sways within the initial view and frames every building beside the card", () => {
  for (const [width, height, panelWidth] of [[1440, 1000, 478], [844, 390, 400], [844, 390, 520]]) {
    for (const sight of sights) {
      const camera = new OrthographicCamera(), rig = createCameraRig(camera);
      rig.resize(width, height);
      const car = createCarState(sight.arrival), drivingFocus = new Vector3(car.x, car.y + 2, car.z);
      rig.snap(drivingFocus);
      const drivingSpan = camera.top;
      const view = { sight, car, panelWidth, orbit: false };
      for (let i = 0; i < 240; i++) rig.update(drivingFocus, 1 / 60, view);
      assert.equal(rig.mode, "preview"); assert.ok(camera.top < drivingSpan);
      const angle = rig.angle;
      view.orbit = true;
      let minimumAngle = angle, maximumAngle = angle, previousAngle = angle;
      let movedLeft = false, movedRight = false;
      for (let i = 0; i < 960; i++) {
        rig.update(drivingFocus, 0.05, view);
        minimumAngle = Math.min(minimumAngle, rig.angle);
        maximumAngle = Math.max(maximumAngle, rig.angle);
        movedLeft ||= rig.angle < previousAngle;
        movedRight ||= rig.angle > previousAngle;
        previousAngle = rig.angle;
        assert.ok(Math.abs(rig.angle - angle) <= Math.PI / 12 + 1e-9, "the camera must stay within 15 degrees of the initial view");
        const subject = new Vector3(sight.x, sight.elevation + 4, sight.z).project(camera);
        const screenX = (subject.x + 1) * width / 2;
        assert.ok(screenX > panelWidth + 40 && screenX < width - 40, "the building must remain framed beside the sidebar");
        assert.ok(Math.abs(subject.y) < 0.7 && subject.z > -1 && subject.z < 1);
        assert.ok(camera.position.y > terrainHeight(camera.position.x, camera.position.z) + 3);
      }
      assert.ok(movedLeft && movedRight && minimumAngle < angle - 0.2 && maximumAngle > angle + 0.2, "the camera must move gently in both directions");
      view.paused = true;
      const pausedAngle = rig.angle;
      for (let i = 0; i < 60; i++) rig.update(drivingFocus, 1 / 60, view);
      assert.equal(rig.angle, pausedAngle);
      view.paused = false;
      rig.update(drivingFocus, 1 / 60, view);
      assert.ok(Math.abs(rig.angle - pausedAngle) < 0.002, "resuming must continue smoothly from the paused view");
      rig.update(drivingFocus, 1 / 60, {}, true);
      assert.equal(rig.mode, "drive"); assert.equal(camera.top, drivingSpan);
    }
  }
});

test("reduced-motion preferences show a still close-up", () => {
  const camera = new OrthographicCamera(), rig = createCameraRig(camera);
  rig.resize(1440, 1000);
  const car = createCarState(sights[0].arrival), focus = new Vector3(car.x, car.y, car.z);
  rig.snap(focus);
  const angle = rig.angle;
  for (let i = 0; i < 300; i++) rig.update(focus, 1 / 60, { sight: sights[0], car, orbit: true, panelWidth: 478 }, true);
  assert.equal(rig.angle, angle); assert.equal(rig.mode, "orbit");
});
