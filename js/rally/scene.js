import * as THREE from "../vendor/three/three.module.min.js";
import { createCameraRig } from "./camera.js";
import { createBatch } from "./batching.js";
import { GRAPHICS_PROFILES } from "./performance.js";
import { ROUTES, SPAWN, CAMPS, terrainHeight, terrainGradient, driveHeightAt, riverAt, roadAt } from "./world.js";
import { makeGround } from "./terrain.js";
import { makeWater, buildCrossings } from "./water.js";
import { createCrashEffect, createSplashEffect, createFireworks } from "./effects.js";
import { createAtmosphere } from "./atmosphere.js";
import { buildLandmark } from "./landmarks.js";
import { buildScenery, obstacleIndex } from "./scenery.js";

const PALETTE = { ground: "#22272e", road: "#554c42", cream: "#e2dfcd", red: "#dd735f", dark: "#282e36", glass: "#526f7b" };
const clamp = THREE.MathUtils.clamp;

function makeCar(scene) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const materials = new Map();
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const material = (color, glow = false) => {
    const key = `${color}:${glow}`;
    if (!materials.has(key)) materials.set(key, glow ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshStandardMaterial({ color, roughness: 0.63, metalness: 0.15 }));
    return materials.get(key);
  };
  const box = (color, x, y, z, w, h, d, parent = body, glow = false) => {
    const mesh = new THREE.Mesh(boxGeometry, material(color, glow));
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  box("#20262c", 0, 0.55, 0, 2, 0.35, 4.05);
  box(PALETTE.cream, 0, 0.98, 0, 2.05, 0.68, 4.05);
  for (const x of [-1, 1]) for (const z of [-1.5, 1.5]) box(PALETTE.cream, x, 0.9, z, 0.42, 0.55, 1.14);
  box("#b7bbae", 0, 1.27, -1.23, 1.97, 0.1, 1.6);
  const windshield = box("#304f5e", 0, 1.54, -0.56, 1.74, 0.67, 0.12);
  windshield.rotation.x = -0.55;
  const rearGlass = box("#304b57", 0, 1.54, 1.05, 1.74, 0.65, 0.12);
  rearGlass.rotation.x = 0.45;
  box("#34535f", 0, 1.55, 0.26, 1.77, 0.6, 1.33);
  box(PALETTE.cream, 0, 1.93, 0.22, 1.82, 0.15, 1.36);
  for (const x of [-0.91, 0.91]) {
    box(PALETTE.cream, x, 1.58, 0.35, 0.075, 0.65, 0.09);
    box("#e9e2ca", x, 1.09, 0.22, 0.07, 0.58, 1.05);
    box("#333d44", x * 1.23, 1.4, -0.42, 0.27, 0.18, 0.34);
  }
  // Group B proportions: short wheelbase, box flares, striped livery and wing.
  for (const [x, color, width] of [[-0.59, "#d56755", 0.22], [-0.3, "#c89960", 0.16], [-0.08, "#4c5557", 0.11]]) {
    box(color, x, 1.334, -1.25, width, 0.015, 1.54);
    box(color, x, 2.014, 0.22, width, 0.012, 1.36);
    box(color, x, 1.334, 1.67, width, 0.015, 0.66);
  }
  for (const x of [-0.7, 0.7]) box("#333c42", x, 1.5, 1.73, 0.12, 0.6, 0.16);
  box(PALETTE.cream, 0, 1.83, 1.82, 2.4, 0.15, 0.5);
  box("#d87760", 0, 1.84, 2.06, 2.4, 0.15, 0.05);
  box("#313a40", 0, 0.68, -2.09, 2.27, 0.28, 0.25);
  box("#242c30", 0, 1.05, -2.05, 1.1, 0.3, 0.04);
  const lights = [];
  const lit = (mesh, color, off) => { lights.push({ mesh, on: material(color, true), off: material(off) }); return mesh; };
  for (const x of [-0.83, 0.83]) {
    lit(box("#fff1c3", x, 1.06, -2.08, 0.4, 0.23, 0.06, body, true), "#fff1c3", "#8e8a78");
    lit(box("#e87566", x, 1.08, 2.05, 0.44, 0.2, 0.05, body, true), "#e87566", "#6e3f39");
  }
  for (const x of [-0.56, -0.19, 0.19, 0.56]) {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.12, 12), material("#fff0bd", true));
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(x, 0.83, -2.24);
    body.add(lit(lamp, "#fff0bd", "#8e8a78"));
  }
  // Small racing number on the roof, drawn locally without image downloads.
  const numberCanvas = document.createElement("canvas"); numberCanvas.width = 64; numberCanvas.height = 64;
  const nc = numberCanvas.getContext("2d");
  nc.fillStyle = "#e2dfcd"; nc.fillRect(0, 0, 64, 64); nc.fillStyle = "#303840";
  nc.font = "bold 42px monospace"; nc.textAlign = "center"; nc.fillText("04", 32, 48);
  const number = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(numberCanvas) }));
  number.rotation.x = -Math.PI / 2; number.position.set(0.46, 2.016, 0.2); body.add(number);
  const wheels = [];
  for (const x of [-1.12, 1.12]) for (const z of [-1.43, 1.44]) {
    const steering = new THREE.Group(); steering.position.set(x, 0.57, z); group.add(steering);
    const wheel = new THREE.Group(); steering.add(wheel);
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.51, 0.51, 0.38, 12), material("#1b2025"));
    tyre.rotation.z = Math.PI / 2; tyre.castShadow = true; wheel.add(tyre);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.4, 8), material("#c4c6b9"));
    hub.rotation.z = Math.PI / 2; wheel.add(hub);
    wheels.push({ wheel, steering, front: z < 0 });
    box("#282e2f", x, 0.55, z + 0.6, 0.4, 0.55, 0.08, group);
  }
  const beamCanvas = document.createElement("canvas"); beamCanvas.width = 128; beamCanvas.height = 256;
  const bc = beamCanvas.getContext("2d");
  const gradient = bc.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "rgba(255,236,177,0)");
  gradient.addColorStop(0.5, "rgba(255,236,177,.055)");
  gradient.addColorStop(1, "rgba(255,244,204,.2)");
  bc.fillStyle = gradient; bc.beginPath(); bc.moveTo(0, 0); bc.lineTo(128, 0); bc.lineTo(69, 256); bc.lineTo(59, 256); bc.closePath(); bc.fill();
  const beamMaterial = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(beamCanvas), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const beams = [];
  for (const x of [-0.8, 0.8]) {
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(7, 15), beamMaterial);
    beam.rotation.x = -Math.PI / 2; beam.position.set(x, 0.07, -9.8); group.add(beam);
    const light = new THREE.SpotLight("#ffedb5", 18, 22, 0.38, 0.75, 1.1);
    light.position.set(x, 1.2, -2);
    light.target.position.set(x, 0, -13);
    group.add(light, light.target);
    beams.push(beam, light);
  }
  // Lamps stay out of the shared body material because they change while parked.
  const lamps = new Set(lights.map(light => light.mesh));
  const panels = new THREE.MeshStandardMaterial({ roughness: 0.63, metalness: 0.15 });
  for (const parent of [body, group]) {
    const parts = parent.children.filter(child => child.isMesh && child.geometry === boxGeometry && !lamps.has(child));
    const mesh = new THREE.InstancedMesh(boxGeometry, panels, parts.length);
    parts.forEach((part, index) => {
      part.updateMatrix();
      mesh.setMatrixAt(index, part.matrix);
      mesh.setColorAt(index, part.material.color);
      parent.remove(part);
    });
    mesh.castShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.computeBoundingSphere();
    parent.add(mesh);
  }
  scene.add(group);
  const shadowCanvas = document.createElement("canvas"); shadowCanvas.width = 64; shadowCanvas.height = 64;
  const sc = shadowCanvas.getContext("2d"), shade = sc.createRadialGradient(32, 32, 6, 32, 32, 31);
  shade.addColorStop(0, "#000000b0"); shade.addColorStop(1, "#00000000"); sc.fillStyle = shade; sc.fillRect(0, 0, 64, 64);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4, 6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false, opacity: 0.5 }));
  shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
  return { group, body, wheels, beams, lights, shadow };
}

function makeTrails(scene) {
  const capacity = 800;
  const geometry = new THREE.PlaneGeometry(0.24, 1);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color: "#20262a", transparent: true, opacity: 0.38, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  dummy.scale.set(0, 0, 0); dummy.updateMatrix();
  for (let i = 0; i < capacity; i++) mesh.setMatrixAt(i, dummy.matrix);
  scene.add(mesh);
  const dustCapacity = 100;
  const positions = new Float32Array(dustCapacity * 3);
  const colors = new Float32Array(dustCapacity * 3);
  const particles = Array.from({ length: dustCapacity }, () => ({ life: 0, vx: 0, vz: 0 }));
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  dustGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  const dustCanvas = document.createElement("canvas"); dustCanvas.width = 32; dustCanvas.height = 32;
  const dc = dustCanvas.getContext("2d");
  const g = dc.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, "rgba(255,255,255,.35)"); g.addColorStop(1, "rgba(255,255,255,0)"); dc.fillStyle = g; dc.fillRect(0, 0, 32, 32);
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ size: 1.5, map: new THREE.CanvasTexture(dustCanvas), transparent: true, opacity: 0.5, depthWrite: false, vertexColors: true }));
  dust.frustumCulled = false; scene.add(dust);
  let cursor = 0, dustCursor = 0, lastX = SPAWN.x, lastZ = SPAWN.z;
  return (car, dt, active) => {
    const distance = Math.hypot(car.x - lastX, car.z - lastZ);
    if (active && car.grounded && !car.inWater && car.speed > 3 && distance > 0.28 && distance < 3) {
      const sin = Math.sin(car.heading), cos = Math.cos(car.heading);
      if (car.drift || car.slip > 1.3) {
        for (const side of [-1, 1]) {
          const x = car.x - sin * 1.4 + cos * side, z = car.z + cos * 1.4 + sin * side;
          const direction = Math.atan2(car.vx, car.vz), slope = terrainGradient(x, z, driveHeightAt);
          dummy.position.set(x, driveHeightAt(x, z) + 0.13, z);
          dummy.rotation.set(Math.atan(-slope.x * Math.sin(direction) - slope.z * Math.cos(direction)), direction, Math.atan(slope.x * Math.cos(direction) - slope.z * Math.sin(direction)), "YXZ");
          dummy.scale.set(1, 1, Math.min(distance + 0.2, 1.5)); dummy.updateMatrix();
          mesh.setMatrixAt(cursor++ % capacity, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
      if (car.speed > 6) {
        const i = dustCursor++ % dustCapacity;
        particles[i] = { life: 1, vx: -car.vx * 0.08 + (Math.random() - 0.5) * 2, vz: -car.vz * 0.08 + (Math.random() - 0.5) * 2 };
        positions[i * 3] = car.x - sin * 2;
        positions[i * 3 + 1] = car.y + 0.55;
        positions[i * 3 + 2] = car.z + cos * 2;
      }
      lastX = car.x; lastZ = car.z;
    } else if (distance >= 3 || !active) { lastX = car.x; lastZ = car.z; }
    if (active && car.grounded && !car.inWater && car.wheelspin > 0 && Math.random() < car.wheelspin * dt * 40) {
      const sin = Math.sin(car.heading), cos = Math.cos(car.heading), side = Math.random() < 0.5 ? -1 : 1;
      const i = dustCursor++ % dustCapacity;
      particles[i] = { life: 1, vx: -sin * 4 + (Math.random() - 0.5) * 2, vz: cos * 4 + (Math.random() - 0.5) * 2 };
      positions[i * 3] = car.x - sin * 1.4 + cos * side;
      positions[i * 3 + 1] = car.y + 0.3;
      positions[i * 3 + 2] = car.z + cos * 1.4 + sin * side;
    }
    particles.forEach((particle, i) => {
      particle.life = Math.max(0, particle.life - dt * 0.7);
      positions[i * 3] += particle.vx * dt;
      positions[i * 3 + 1] += dt * 0.45;
      positions[i * 3 + 2] += particle.vz * dt;
      colors[i * 3] = 0.43 * particle.life; colors[i * 3 + 1] = 0.4 * particle.life; colors[i * 3 + 2] = 0.33 * particle.life;
    });
    dustGeometry.attributes.position.needsUpdate = true;
    dustGeometry.attributes.color.needsUpdate = true;
  };
}

export function createScene(canvas, landmarks, { quality = "balanced" } = {}) {
  quality = Object.hasOwn(GRAPHICS_PROFILES, quality) ? quality : "balanced";
  let profile = GRAPHICS_PROFILES[quality];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.ground);
  scene.fog = new THREE.Fog(PALETTE.ground, 280, 780);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "default" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = profile.shadows;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.add(new THREE.HemisphereLight("#c2d7ed", "#62584c", 1.35));
  const moon = new THREE.DirectionalLight("#d7e0e5", 2.7);
  moon.position.set(-45, 85, 40);
  moon.castShadow = true;
  moon.shadow.mapSize.set(profile.shadowSize || 1024, profile.shadowSize || 1024);
  Object.assign(moon.shadow.camera, { left: -135, right: 135, top: 135, bottom: -135, near: 1, far: 420 });
  moon.shadow.bias = -0.0007;
  moon.shadow.normalBias = 0.12;
  scene.add(moon, moon.target);
  const routes = ROUTES;
  const roadGrid = new Map();
  for (const route of routes) for (const [x, z] of route.samples) {
    const reach = route.width / 2 + 6;
    for (let gx = Math.floor((x - reach) / 20); gx <= Math.floor((x + reach) / 20); gx++) {
      for (let gz = Math.floor((z - reach) / 20); gz <= Math.floor((z + reach) / 20); gz++) {
        const key = `${gx},${gz}`;
        if (!roadGrid.has(key)) roadGrid.set(key, []);
        roadGrid.get(key).push([x, z, route.width / 2]);
      }
    }
  }
  function isRoad(x, z, padding = 0) {
    if (CAMPS.some(camp => Math.hypot(x - camp.x, z - camp.z) < camp.radius + padding)) return true;
    if (landmarks.some(sight => Math.hypot(x - sight.marker[0], z - sight.marker[1]) < 8.5 + padding)) return true;
    return (roadGrid.get(`${Math.floor(x / 20)},${Math.floor(z / 20)}`) || []).some(([px, pz, radius]) => (x - px) ** 2 + (z - pz) ** 2 < (radius + padding) ** 2);
  }
  makeGround(scene, routes, landmarks);
  const batch = createBatch(scene);
  const updateWater = makeWater(scene, batch);
  buildCrossings(scene, batch);
  landmarks.forEach(sight => buildLandmark(batch, sight));
  const scenery = buildScenery(batch, landmarks, isRoad, routes);
  const atmosphere = createAtmosphere(scene, batch, landmarks);
  const obstacles = [...landmarks, ...atmosphere.obstacles, ...scenery];
  const obstaclesNear = obstacleIndex(obstacles);
  batch.finish();
  const car = makeCar(scene);
  const crashEffect = createCrashEffect(scene);
  const splashEffect = createSplashEffect(scene), fireworks = createFireworks(scene);
  const updateTrails = makeTrails(scene);
  const rings = landmarks.map(sight => {
    const material = new THREE.MeshBasicMaterial({ color: sight.color, transparent: true, opacity: 0.65, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(5.3, 5.44, 40), material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(sight.marker[0], sight.elevation + 0.13, sight.marker[1]);
    scene.add(ring);
    return ring;
  });
  const camera = new THREE.OrthographicCamera(-84, 84, 58, -58, 0.1, 1000);
  const cameraRig = createCameraRig(camera);
  const target = new THREE.Vector3();
  const lookAhead = new THREE.Vector3(0, 0, 10);
  const projection = new THREE.Vector3();
  const labelHeights = new Map(landmarks.map(sight => [`${sight.x},${sight.z}`, terrainHeight(sight.x, sight.z)]));
  let width = 0, height = 0, elapsed = 0, shadowElapsed = Infinity;
  const resize = () => {
    width = Math.max(1, window.innerWidth); height = Math.max(1, window.innerHeight);
    // Bound total pixels as well as DPR: a large external display needs a cap too.
    const pixelRatio = Math.min(window.devicePixelRatio || 1, profile.pixelRatio, Math.sqrt(profile.maxPixels / (width * height)));
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    cameraRig.resize(width, height);
  };
  resize();
  cameraRig.snap(new THREE.Vector3(SPAWN.x, driveHeightAt(SPAWN.x, SPAWN.z) + 2, SPAWN.z + 10));
  return {
    renderer, routes, isRoad, resize, cameraRig, crashEffect, splashEffect, fireworks, atmosphere, obstacles, obstaclesNear,
    get quality() { return quality; },
    setQuality(next) {
      if (!Object.hasOwn(GRAPHICS_PROFILES, next) || next === quality) return;
      quality = next; profile = GRAPHICS_PROFILES[quality];
      renderer.shadowMap.enabled = profile.shadows;
      moon.shadow.mapSize.set(profile.shadowSize || 1024, profile.shadowSize || 1024);
      // Three.js allocates the shadow target lazily; discard its old resolution.
      moon.shadow.map?.dispose();
      moon.shadow.map = null;
      shadowElapsed = Infinity;
      resize();
    },
    render(state, dt, active, reducedMotion, view = {}) {
      elapsed += dt;
      car.group.visible = !view.crashed;
      car.shadow.visible = !view.crashed;
      car.group.position.set(state.x, state.y, state.z);
      car.group.rotation.set(state.pitch, -state.heading, state.roll, "YXZ");
      car.body.rotation.z = reducedMotion ? 0 : clamp(state.yaw * state.speed * 0.002, -0.065, 0.065);
      car.body.rotation.x = reducedMotion ? 0 : Math.sin(elapsed * 26) * Math.min(state.speed / 2000, 0.015);
      car.body.position.y = reducedMotion ? 0 : state.suspension;
      car.beams.forEach(beam => { beam.visible = state.grounded && !state.inWater && !view.parked; });
      car.lights.forEach(light => { light.mesh.material = view.parked ? light.off : light.on; });
      const ground = driveHeightAt(state.x, state.z, state.y + 0.7), clearance = Math.max(0, state.y - ground);
      const water = riverAt(state.x, state.z);
      car.shadow.position.set(state.x, Math.max(ground, water && water.distance < water.width ? water.y : ground) + 0.12, state.z);
      car.shadow.rotation.set(-Math.PI / 2, 0, state.heading);
      car.shadow.scale.setScalar(1 + Math.min(clearance, 15) * 0.025);
      car.shadow.material.opacity = 0.48 / (1 + clearance * 0.08);
      car.wheels.forEach(({ wheel, steering, front }) => {
        wheel.rotation.x -= state.speed * dt * (state.vx * Math.sin(state.heading) - state.vz * Math.cos(state.heading) < 0 ? -1 : 1) / 0.51;
        if (front) steering.rotation.y = -state.steer * 0.45;
      });
      const lead = 10 + Math.min(state.speed * 0.55, 17);
      const moving = state.speed > 2;
      target.set((moving ? state.vx / state.speed : Math.sin(state.heading)) * lead, 0, (moving ? state.vz / state.speed : -Math.cos(state.heading)) * lead);
      lookAhead.lerp(target, reducedMotion ? 1 : 1 - Math.exp(-2.8 * dt));
      const road = roadAt(state.x, state.z);
      const groundFocus = road && road.distance < 20 ? road.y : ground;
      const cameraHeight = state.grounded ? groundFocus : Math.max(groundFocus, state.y - 6);
      target.set(state.x + lookAhead.x, cameraHeight + 2, state.z + lookAhead.z);
      cameraRig.update(target, dt, { ...view, car: state }, reducedMotion);
      const focus = cameraRig.focus;
      shadowElapsed += dt;
      if (profile.shadows && shadowElapsed >= 1 / profile.shadowFps) {
        moon.position.set(focus.x - 100, focus.y + 120, focus.z - 65);
        moon.target.position.copy(focus);
        renderer.shadowMap.needsUpdate = true;
        shadowElapsed = 0;
      } else if (!profile.shadows) {
        moon.position.set(focus.x - 100, focus.y + 120, focus.z - 65);
        moon.target.position.copy(focus);
      }
      updateTrails(state, reducedMotion ? 0 : dt, active && !reducedMotion);
      crashEffect.update(dt);
      splashEffect.update(dt); fireworks.update(dt);
      atmosphere.update(dt, reducedMotion, state);
      if (!reducedMotion && dt) updateWater(dt);
      rings.forEach((ring, index) => {
        const checkpoint = landmarks[index] === view.checkpoint;
        ring.material.opacity = checkpoint ? 0.9 : reducedMotion ? 0.6 : 0.45 + Math.sin(elapsed * 1.7 + index) * 0.12;
        ring.scale.setScalar(checkpoint ? 1.1 : 1);
      });
      renderer.render(scene, camera);
    },
    project(x, y, z, absolute = false) {
      const base = absolute ? 0 : labelHeights.get(`${x},${z}`) ?? terrainHeight(x, z);
      projection.set(x, base + y, z).project(camera);
      return { x: (projection.x + 1) * width / 2, y: (1 - projection.y) * height / 2, visible: projection.z > -1 && projection.z < 1 && Math.abs(projection.x) < 1.1 && Math.abs(projection.y) < 1.1 };
    },
    snapCamera(state) { shadowElapsed = Infinity; lookAhead.set(Math.sin(state.heading) * 10, 0, -Math.cos(state.heading) * 10); target.set(state.x + lookAhead.x, state.y + 2, state.z + lookAhead.z); cameraRig.snap(target); },
  };
}
