import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../js/vendor/three/three.module.min.js";
import { createAtmosphere } from "../js/rally/atmosphere.js";
import { createCrashEffect } from "../js/rally/effects.js";

function visibleLights(scene) {
  const lights = [];
  scene.traverseVisible(object => { if (object.isLight) lights.push(object); });
  return lights;
}

function atmosphereScene(t) {
  const original = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) };
  t.after(() => {
    if (original === undefined) delete globalThis.document;
    else globalThis.document = original;
  });
  const scene = new THREE.Scene();
  const atmosphere = createAtmosphere(scene, { absolute() {} }, []);
  return { scene, atmosphere };
}

test("distance culling keeps a fixed renderer light count and restores nearby illumination", t => {
  const { scene, atmosphere } = atmosphereScene(t);
  const lights = visibleLights(scene);
  const ids = lights.map(light => light.id);
  assert.equal(lights.length, 3);
  const sites = lights.map(light => light.getWorldPosition(new THREE.Vector3()));
  const far = { x: 10000, z: 10000 };
  for (const still of [false, true]) {
    atmosphere.update(1 / 60, still, far);
    assert.deepEqual(visibleLights(scene).map(light => light.id), ids);
    assert.ok(lights.every(light => light.intensity === 0));
    for (let index = 0; index < lights.length; index++) {
      atmosphere.update(1 / 60, still, sites[index]);
      assert.deepEqual(visibleLights(scene).map(light => light.id), ids);
      assert.ok(lights[index].intensity > 0);
      const intensity = lights[index].intensity;
      atmosphere.update(0, still, sites[index]);
      assert.equal(lights[index].intensity, intensity, "a redraw preserves the current flicker intensity");
    }
  }
});

test("cabin illumination follows its current sway and returns after distance culling", t => {
  const { scene, atmosphere } = atmosphereScene(t);
  const light = visibleLights(scene).find(light => light.color.getHexString() === "f0c979");
  const cabin = scene.children.find(object => object.isGroup && object.children.some(child => child.material?.color.getHexString() === "f0d9a0"));
  assert.ok(light && cabin);
  let previous;
  for (const dt of [0.3, 0.4]) {
    atmosphere.update(dt, false, cabin.position);
    scene.updateMatrixWorld(true);
    const expected = cabin.localToWorld(new THREE.Vector3(0, -3.1, 0));
    const actual = light.getWorldPosition(new THREE.Vector3());
    assert.ok(actual.distanceTo(expected) < 1e-9);
    if (previous) assert.ok(actual.distanceTo(previous) > 0.01);
    previous = actual;
  }
  atmosphere.update(1 / 60, false, { x: 10000, z: 10000 });
  assert.equal(cabin.visible, false);
  assert.ok(visibleLights(scene).includes(light));
  assert.equal(light.intensity, 0);
  atmosphere.update(0, true, cabin.position);
  assert.equal(cabin.visible, true);
  assert.equal(light.intensity, 6);
  assert.ok(light.getWorldPosition(new THREE.Vector3()).distanceTo(cabin.localToWorld(new THREE.Vector3(0, -3.1, 0))) < 1e-9);
});

test("crashing, expiring and clearing effects do not change the renderer light count", () => {
  const scene = new THREE.Scene(), effect = createCrashEffect(scene);
  const lights = visibleLights(scene);
  const ids = lights.map(light => light.id);
  assert.equal(lights.length, 1);
  const light = lights[0];
  assert.equal(light.intensity, 0);
  for (const still of [false, true]) {
    const car = { x: 12, y: 4, z: -7 };
    effect.explode(car, still);
    assert.deepEqual(visibleLights(scene).map(light => light.id), ids);
    assert.deepEqual(light.getWorldPosition(new THREE.Vector3()).toArray(), [12, 5, -7]);
    assert.equal(light.intensity, still ? 0 : 45);
    effect.update(1);
    assert.deepEqual(visibleLights(scene).map(light => light.id), ids);
    assert.equal(light.intensity, 0);
    effect.explode(car, still);
    effect.clear();
    assert.deepEqual(visibleLights(scene).map(light => light.id), ids);
    assert.equal(light.intensity, 0, "clearing during the flash extinguishes the light");
  }
});
