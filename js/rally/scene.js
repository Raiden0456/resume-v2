import * as THREE from "../vendor/three/three.module.min.js";
import { ROUTES, WORLD, SPAWN, terrainHeight, terrainGradient, driveHeightAt, riverAt, roadAt, CROSSINGS } from "./world.js";
import { makeGround } from "./terrain.js";
import { makeWater, buildCrossings } from "./water.js";

const PALETTE = { ground: "#22272e", road: "#554c42", cream: "#e2dfcd", red: "#dd735f", dark: "#282e36", glass: "#526f7b" };
const clamp = THREE.MathUtils.clamp;

function seededRandom(seed = 42) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

// Static scenery is grouped into instanced meshes: a forest does not need
// hundreds of individual draw calls.
function createBatch(scene) {
  const geometry = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 10),
    cone: new THREE.ConeGeometry(1, 1, 5),
    rock: new THREE.DodecahedronGeometry(1, 0),
    dome: new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    torus: new THREE.TorusGeometry(1, 0.09, 5, 24),
  };
  const buckets = new Map();
  const materials = {
    solid: new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0.05 }),
    light: new THREE.MeshBasicMaterial(),
    glass: new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.35, transparent: true, opacity: 0.68 }),
  };
  function add(shape, color, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, kind = "solid") {
    const key = `${shape}:${kind}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push({ x, y, z, sx, sy, sz, rx, ry, rz, color });
  }
  return {
    absolute: add,
    add(shape, color, x, y, z, ...rest) { add(shape, color, x, y + terrainHeight(x, z), z, ...rest); },
    building(x, z) {
      const base = terrainHeight(x, z);
      return (shape, color, px, py, pz, sx, sy, sz, rx = 0, ry = 0, rz = 0, kind = "solid") => add(shape, color, x + px, base + py, z + pz, sx, sy, sz, rx, ry, rz, kind);
    },
    finish() {
      const dummy = new THREE.Object3D();
      const color = new THREE.Color();
      for (const [key, items] of buckets) {
        const [shape, kind] = key.split(":");
        const mesh = new THREE.InstancedMesh(geometry[shape], materials[kind], items.length);
        items.forEach((item, index) => {
          dummy.position.set(item.x, item.y, item.z);
          dummy.rotation.set(item.rx, item.ry, item.rz, "YXZ");
          dummy.scale.set(item.sx, item.sy, item.sz);
          dummy.updateMatrix();
          mesh.setMatrixAt(index, dummy.matrix);
          mesh.setColorAt(index, color.set(item.color));
        });
        mesh.castShadow = kind === "solid";
        mesh.receiveShadow = kind === "solid";
        scene.add(mesh);
      }
    },
  };
}

function buildLandmark(batch, sight) {
  const add = batch.building(sight.x, sight.z);
  const c = sight.color, wall = "#778080", roof = "#3b454d", dark = PALETTE.dark;
  const box = (color, x, y, z, w, h, d, kind = "solid") => add("box", color, x, y, z, w, h, d, 0, 0, 0, kind);
  box("#424a50", 0, 0.15, 0, 18, 0.3, 14);
  const windows = (width, height, z, columns, rows) => {
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      box((col + row) % 4 ? "#aeaa7d" : "#3f5961", (col - (columns - 1) / 2) * width, 1.8 + row * height, z, width * 0.55, height * 0.55, 0.07, "light");
    }
  };
  if (sight.type === "bank") {
    box(wall, 0, 3.4, 0, 12, 6.4, 8);
    box(roof, 0, 6.8, 0, 13, 0.5, 9);
    box(c, 0, 5.6, 4.1, 11.5, 0.3, 0.12, "light");
    box(dark, 0, 1.8, 4.1, 2.2, 3.1, 0.2);
    for (const x of [-4.8, -2.9, 2.9, 4.8]) box("#bcc4b3", x, 2.7, 4.8, 0.65, 5, 0.7);
    box("#abb4a4", 0, 0.5, 5.1, 13, 0.6, 2);
    box("#9ba698", 0, 7.2, 0, 4, 0.5, 4);
    for (let i = 0; i < 3; i++) add("cylinder", c, 0, 7.8 + i * 0.45, 0, 1.25, 0.3, 1.25);
  } else if (sight.type === "town") {
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 4.5, h = [5.5, 9, 6.8][i];
      box(["#667c84", "#849394", "#7f898c"][i], x, h / 2 + 0.3, 0, 4, h, 7);
      box(roof, x, h + 0.5, 0, 4.5, 0.4, 7.5);
      for (let row = 0; row < Math.floor(h / 2); row++) for (const dx of [-0.8, 0.8]) box("#acbbba", x + dx, 1.7 + row * 2, 3.55, 0.85, 0.9, 0.08, "light");
      box(c, x, 2.8, 4.1, 3.7, 0.18, 1.3);
      box(dark, x, 1.15, 3.55, 1, 1.8, 0.1);
    }
  } else if (sight.type === "accelerator") {
    // A business campus: offices, a meeting terrace and an ascending roofline.
    box("#9caeaa", -2, 3.2, -1, 10, 5.8, 8);
    box("#6c858b", 4.6, 5, -1.6, 4, 9.4, 6.8);
    box("#c2c9b9", -2, 6.4, -1, 11, 0.45, 9);
    box("#b6c8c0", 4.6, 9.8, -1.6, 4.7, 0.4, 7.5);
    box("#4a707c", -2, 3.3, 3.06, 9.3, 4.5, 0.1, "glass");
    for (const x of [-6.3, -3.4, -0.5, 2.4]) box("#c2cebf", x, 3.1, 3.2, 0.14, 4.6, 0.12);
    for (let row = 0; row < 4; row++) box("#add0c0", 4.6, 1.8 + row * 2, 1.86, 3.2, 0.8, 0.08, "light");
    box(c, -2, 5.6, 3.4, 10.5, 0.25, 0.2, "light");
    box("#abb6a6", -2, 0.55, 5, 10.5, 0.35, 3.3);
    for (let i = 0; i < 3; i++) box(c, -4 + i * 1.55, 7.1 + i * 0.5, -1, 0.9, 1 + i, 0.8);
    add("cylinder", "#d0c7ae", 4.6, 1.3, 5, 1.3, 0.15, 1.3);
    add("cylinder", "#6c7776", 4.6, 0.8, 5, 0.18, 0.9, 0.18);
    for (const [x, z] of [[2.5, 5], [6.6, 5], [4.6, 6.9]]) { box("#536f72", x, 0.7, z, 0.9, 0.9, 0.9); box(c, x, 1.3, z + 0.3, 0.9, 0.8, 0.15); }
  } else if (sight.type === "tower") {
    box("#68727e", 0, 1.9, 0, 7, 3.2, 7);
    box(roof, 0, 3.8, 0, 7.6, 0.5, 7.6);
    for (const x of [-1.7, 1.7]) for (const z of [-1.7, 1.7]) add("box", "#8b9296", x, 9, z, 0.27, 11, 0.27, z * -0.026, 0, x * 0.026);
    for (let i = 0; i < 4; i++) {
      box("#879096", 0, 5 + i * 2.4, 0, 3.4 - i * 0.3, 0.18, 3.4 - i * 0.3);
      add("box", "#78848d", 0, 6 + i * 2.4, 1.4 - i * 0.1, 0.15, 3.3, 0.15, 0, 0, 0.8);
    }
    add("cylinder", "#92979a", 0, 15, 0, 0.13, 5, 0.13);
    add("rock", "#e99182", 0, 17.6, 0, 0.28, 0.28, 0.28, 0, 0, 0, "light");
    add("dome", "#b4bcc0", 1.7, 12, 0, 1.7, 1, 1.7, 0, 0, -Math.PI / 2);
    box(c, 0, 2.5, 3.55, 4, 0.18, 0.1, "light");
    box(dark, 0, 1.1, 3.55, 1.2, 1.6, 0.1);
  } else if (sight.type === "arcade") {
    box("#68626b", 0, 3.2, 0, 12, 5.8, 8);
    box(roof, 0, 6.3, 0, 13, 0.6, 9);
    box(c, 0, 5, 4.2, 12.6, 0.6, 0.3, "light");
    box("#c678dd", 0, 6.6, 0, 12.8, 0.1, 8.8, "light");
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 2.6;
      box(dark, x, 1.7, 4.4, 1.7, 2.6, 1.2);
      box(i % 2 ? "#61afef" : "#98c379", x, 2.3, 5.04, 1.3, 1, 0.04, "light");
      box(c, x, 1.45, 5.3, 1.7, 0.16, 0.7);
    }
    // A pixel invader on the roof gives the arcade a readable silhouette.
    const pixels = ["0100010", "0011100", "0111110", "1101011", "1111111", "1010101"];
    pixels.forEach((row, y) => [...row].forEach((pixel, x) => { if (pixel === "1") box(c, (x - 3) * 0.65, 11 - y * 0.65, 0, 0.59, 0.59, 0.5, "light"); }));
    box(dark, 0, 7.3, 0, 0.3, 3, 0.3);
  } else if (sight.type === "garage") {
    box("#919187", 0, 2.9, 0, 14, 5.2, 9);
    box("#d0c5a4", 0, 5.8, 0, 15, 0.5, 10);
    box(c, 0, 4.6, 4.6, 14, 0.25, 0.15, "light");
    for (const x of [-4.5, 0, 4.5]) {
      box(dark, x, 2.1, 4.55, 3.5, 3.6, 0.08);
      for (let y = 1; y < 4; y += 0.6) box("#555f64", x, y, 4.65, 3.3, 0.09, 0.08);
    }
    box("#252b31", 0, 1, 6, 2.4, 0.7, 4);
    box("#c4b58e", 0, 1.5, 6.1, 2.2, 0.8, 3.9);
    box("#425e69", 0, 2, 6.2, 1.8, 0.55, 1.9);
    for (const x of [-1.2, 1.2]) for (const z of [4.7, 7.3]) add("cylinder", "#1b2228", x, 0.8, z, 0.55, 0.4, 0.55, 0, 0, Math.PI / 2);
  } else if (sight.type === "observatory") {
    add("cylinder", "#78828e", 0, 2.7, 0, 5.7, 4.8, 5.7);
    add("dome", "#9aa5b0", 0, 5.1, 0, 6, 5, 6);
    box(dark, 0, 7.6, 3.4, 1.9, 5, 0.6);
    add("cylinder", "#adb6b6", 0, 8, 4.6, 0.75, 5, 0.75, 0.9);
    add("cylinder", "#3d525f", 0, 9.65, 6.55, 0.62, 0.1, 0.62, 0.9);
    add("torus", c, 0, 4.7, 0, 5.9, 5.9, 1, Math.PI / 2, 0, 0, "light");
    box(dark, -2.5, 1.5, 5, 1.5, 2.4, 0.2);
  } else if (sight.type === "salon") {
    // Blush storefront, striped awning, styling chairs and a scissors sign.
    box("#b89492", 0, 2.8, 0, 12, 5, 8);
    box("#e1d1b9", 0, 5.5, 0, 13, 0.4, 9);
    box("#587179", 0, 2.6, 4.06, 10.5, 3.5, 0.1, "glass");
    for (const x of [-5.5, -1, 1, 5.5]) box("#d5c2a6", x, 2.5, 4.2, 0.15, 4.1, 0.12);
    box("#c4ab92", 0, 0.35, 5, 13, 0.15, 2.5);
    for (let i = 0; i < 10; i++) box(i % 2 ? "#d3a5a0" : "#e4dac4", (i - 4.5) * 1.25, 4.1, 5, 1.25, 0.18, 1.8);
    for (const x of [-3.4, 3.4]) {
      add("cylinder", "#575b5c", x, 0.7, 3.1, 0.5, 0.9, 0.5);
      box("#b7797b", x, 1.3, 3.1, 1.35, 0.35, 1.2);
      box("#b7797b", x, 1.9, 3.6, 1.35, 1, 0.18);
      add("torus", "#d8c3a0", x, 3, 1.3, 0.8, 1.05, 1);
      box("#839fa4", x, 3, 1.26, 1.3, 1.65, 0.05, "light");
    }
    box(c, 0, 5.9, 0, 4.6, 0.25, 0.4, "light");
    for (const side of [-1, 1]) {
      add("torus", "#e6c6b0", side * 0.72, 6.9, 0, 0.52, 0.7, 1, 0, 0, 0, "light");
      add("box", "#e6c6b0", side * -0.2, 8.2, 0, 0.18, 2.25, 0.18, 0, 0, side * 0.45, "light");
    }
    add("cylinder", "#c7ae8c", -7.2, 0.7, 4.4, 0.7, 1, 0.7);
    add("rock", "#78816b", -7.2, 1.6, 4.4, 0.85, 0.9, 0.85);
  } else if (sight.type === "depot") {
    box("#788184", -2, 2.9, -1, 10, 5.2, 9);
    box(roof, -2, 5.9, -1, 11, 0.7, 10);
    for (const x of [-4.5, 0.3]) box(dark, x, 2, 3.6, 3.8, 3.5, 0.1);
    for (let i = 0; i < 2; i++) {
      box(i ? "#ad775e" : "#668797", 5.5, 1.6 + i * 2.5, -1, 3, 2.4, 8);
      for (let z = -4; z < 3; z += 0.7) box("#465965", 7.04, 1.6 + i * 2.5, z, 0.08, 2.2, 0.12);
    }
    box("#a7aaa0", -3, 1.6, 6, 6.2, 2.4, 2.6);
    box(c, 1.1, 1.4, 6, 2, 2, 2.6);
    box("#34525f", 1.3, 2, 7.32, 1.25, 0.7, 0.08);
    for (const x of [-5, -1, 1.4]) for (const z of [4.6, 7.4]) add("cylinder", "#20262a", x, 0.7, z, 0.55, 0.3, 0.55, Math.PI / 2);
  }
  // A tiny lit sign and two bollards mark each roadside discovery point.
  const [mx, mz] = sight.marker;
  const deck = batch.building(mx, mz);
  deck("cylinder", "#636b5d", 0, -0.04, 0, 8, 0.16, 8);
  for (let i = -5; i <= 5; i++) deck("box", "#88917a", 0, 0.055, i * 1.15, Math.sqrt(64 - (i * 1.15) ** 2) * 2, 0.02, 0.04);
  const side = Math.sign(sight.x) || 1;
  for (const z of [-5, -2.5, 0, 2.5, 5]) deck("box", "#a5b39c", side * 7, 0.85, z, 0.16, 1.7, 0.16);
  deck("box", "#b4bea6", side * 7, 1.5, 0, 0.14, 0.14, 10);
  deck("box", "#8e9b85", side * 7, 0.65, 0, 0.12, 0.12, 10);
  deck("box", "#af9b76", 0, 0.7, -5.2, 3.8, 0.18, 0.85);
  deck("box", "#7f8f7b", 0, 1.25, -5.65, 3.8, 0.9, 0.13);
  batch.add("box", "#7f8782", mx - 2.8, 1.1, mz - 1, 0.13, 2.2, 0.13);
  batch.add("box", c, mx - 2.8, 2.3, mz - 1, 1.6, 0.7, 0.18, 0, 0, 0, "light");
  for (const offset of [-2.5, 2.5]) {
    batch.add("cylinder", "#657078", mx + offset, 0.5, mz + 2, 0.16, 1, 0.16);
    batch.add("cylinder", c, mx + offset, 1.03, mz + 2, 0.18, 0.1, 0.18, 0, 0, 0, "light");
  }
}

function buildScenery(batch, landmarks, isRoad, routes) {
  const random = seededRandom(83);
  const farFromSights = (x, z) => landmarks.every(sight => Math.hypot(x - sight.x, z - sight.z) > 17 && Math.hypot(x - sight.marker[0], z - sight.marker[1]) > 13);
  for (let i = 0; i < 3400; i++) {
    const x = random() * 740 - 370, z = random() * 890 - 445;
    const water = riverAt(x, z);
    if ((water && water.distance < water.width + 4) || isRoad(x, z, 5) || !farFromSights(x, z) || Math.hypot(x - SPAWN.x, z - SPAWN.z) < 22) continue;
    const elevation = terrainHeight(x, z);
    const slope = terrainGradient(x, z);
    const rocky = elevation > 175 || Math.hypot(slope.x, slope.z) > 0.9;
    const size = 0.7 + random() * (rocky ? 3 : 1.5);
    if (!rocky && (i % 3 === 0 || (z > 30 && z < 235))) {
      const h = 4 + random() * 5;
      batch.add("cylinder", "#62574a", x, h * 0.25, z, 0.22, h * 0.5, 0.22);
      batch.add("cone", "#465f52", x, h * 0.6, z, size * 1.4, h * 0.9, size * 1.4, 0, random() * 6);
      batch.add("cone", "#597363", x, h * 0.85, z, size, h * 0.7, size, 0, random() * 6);
    } else if (rocky || i % 4 === 0) {
      batch.add("rock", elevation > 190 ? "#8a8e86" : "#616d68", x, size * 0.4, z, size * 1.3, size * 0.85, size, random(), random(), random());
    } else {
      batch.add("rock", i % 2 ? "#536954" : "#657a5c", x, size * 0.45, z, size, size * 0.6, size * 0.85, 0, random() * 6);
    }
  }
  // Exposed ledges have guardrails; the lower forest opens up into gravel.
  for (const main of routes) for (let i = 15; i < main.samples.length - 2; i += 19) {
    const [x, z] = main.samples[i], next = main.samples[i + 1];
    const angle = Math.atan2(next[1] - z, next[0] - x);
    for (const side of [-1, 1]) {
      const shoulder = main.width / 2 + 1.6;
      const px = x - Math.sin(angle) * side * shoulder, pz = z + Math.cos(angle) * side * shoulder;
      if (!farFromSights(px, pz)) continue;
      if (CROSSINGS.some(crossing => Math.hypot(x - crossing.x, z - crossing.z) < crossing.gap + 22)) continue;
      batch.add("box", "#a7ae99", px, 0.7, pz, 0.2, 1.4, 0.2);
      batch.add("box", i % 2 ? "#d49a79" : "#cdd0b4", px, 1.3, pz, 0.26, 0.22, 0.26, 0, 0, 0, "light");
      const outerX = x - Math.sin(angle) * side * 22, outerZ = z + Math.cos(angle) * side * 22;
      if (terrainHeight(x, z) - terrainHeight(outerX, outerZ) > 10) {
        const slope = terrainGradient(px, pz);
        const pitch = Math.atan(slope.x * Math.cos(angle) + slope.z * Math.sin(angle));
        batch.add("box", "#89918b", px, 1, pz, 13, 0.35, 0.22, 0, -angle, pitch);
      }
    }
  }
  const camp = batch.building(SPAWN.x, SPAWN.z);
  for (const side of [-1, 1]) {
    const x = Math.cos(SPAWN.heading) * side * 7 + Math.sin(SPAWN.heading) * 7;
    const z = Math.sin(SPAWN.heading) * side * 7 - Math.cos(SPAWN.heading) * 7;
    camp("cylinder", "#9eaa9f", x, 3, z, 0.1, 6, 0.1);
    camp("box", "#da7b64", x + side, 5.3, z, 1.8, 1.1, 0.08);
    for (let i = 0; i < 3; i++) camp("cylinder", "#252b2c", x + side * 1.5, 0.22 + i * 0.42, z + 2, 0.7, 0.4, 0.7);
  }
  const hut = batch.building(SPAWN.x + 16, SPAWN.z - 7);
  hut("box", "#57696b", 0, 2, 0, 5.5, 3.8, 4.5);
  hut("cone", "#9ba79e", 0, 4.7, 0, 4, 2.2, 3.8, 0, Math.PI / 4);
  hut("box", "#252d32", 0, 1.5, 2.3, 2, 2.8, 0.1);
  hut("box", "#e2c68a", 0, 3.3, 2.4, 3, 0.3, 0.1, 0, 0, 0, "light");
  const summit = batch.building(SPAWN.x - 15, SPAWN.z - 7);
  summit("cylinder", "#bac2ae", 0, 4.5, 0, 0.12, 9, 0.12);
  summit("box", "#98c379", 1.6, 8, 0, 3.1, 1.6, 0.12);
  for (let i = 0; i < 4; i++) summit("rock", "#a5aa9d", -2, 0.5 + i * 0.65, 1, 1.3 - i * 0.22, 0.5, 1.1 - i * 0.19);
  // Finish gantry in the valley, after the oldest chapter.
  const finish = batch.building(230, 390);
  for (const x of [-9, 9]) finish("box", "#8c9991", x, 4, 0, 0.35, 8, 0.35);
  finish("box", "#a5ad99", 0, 7.5, 0, 18, 1.3, 0.3);
  for (let i = 0; i < 18; i++) finish("box", i % 2 ? "#303a3c" : "#e2dcc7", i - 8.5, 7.5, 0.17, 0.9, 1.1, 0.06);
}

function makeCar(scene) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const materials = new Map();
  const material = (color, glow = false) => {
    const key = `${color}:${glow}`;
    if (!materials.has(key)) materials.set(key, glow ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshStandardMaterial({ color, roughness: 0.63, metalness: 0.15 }));
    return materials.get(key);
  };
  const box = (color, x, y, z, w, h, d, parent = body, glow = false) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color, glow));
    mesh.position.set(x, y, z);
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
  for (const x of [-0.83, 0.83]) {
    box("#fff1c3", x, 1.06, -2.08, 0.4, 0.23, 0.06, body, true);
    box("#e87566", x, 1.08, 2.05, 0.44, 0.2, 0.05, body, true);
  }
  for (const x of [-0.56, -0.19, 0.19, 0.56]) {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.12, 12), material("#fff0bd", true));
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(x, 0.83, -2.24);
    body.add(lamp);
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
    beams.push(beam);
    const light = new THREE.SpotLight("#ffedb5", 18, 22, 0.38, 0.75, 1.1);
    light.position.set(x, 1.2, -2);
    light.target.position.set(x, 0, -13);
    group.add(light, light.target);
  }
  scene.add(group);
  const shadowCanvas = document.createElement("canvas"); shadowCanvas.width = 64; shadowCanvas.height = 64;
  const sc = shadowCanvas.getContext("2d"), shade = sc.createRadialGradient(32, 32, 6, 32, 32, 31);
  shade.addColorStop(0, "#000000b0"); shade.addColorStop(1, "#00000000"); sc.fillStyle = shade; sc.fillRect(0, 0, 64, 64);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4, 6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false, opacity: 0.5 }));
  shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
  return { group, body, wheels, beams, shadow };
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

export function createScene(canvas, landmarks) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.ground);
  scene.fog = new THREE.Fog(PALETTE.ground, 280, 780);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.add(new THREE.HemisphereLight("#c2d7ed", "#62584c", 1.35));
  const moon = new THREE.DirectionalLight("#d7e0e5", 2.7);
  moon.position.set(-45, 85, 40);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
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
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 13 + padding) return true;
    if (landmarks.some(sight => Math.hypot(x - sight.marker[0], z - sight.marker[1]) < 8.5 + padding)) return true;
    return (roadGrid.get(`${Math.floor(x / 20)},${Math.floor(z / 20)}`) || []).some(([px, pz, radius]) => (x - px) ** 2 + (z - pz) ** 2 < (radius + padding) ** 2);
  }
  makeGround(scene, routes, landmarks);
  const batch = createBatch(scene);
  const updateWater = makeWater(scene, batch);
  buildCrossings(scene, batch);
  landmarks.forEach(sight => buildLandmark(batch, sight));
  buildScenery(batch, landmarks, isRoad, routes);
  batch.finish();
  const car = makeCar(scene);
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
  const focus = new THREE.Vector3(SPAWN.x, driveHeightAt(SPAWN.x, SPAWN.z) + 2, SPAWN.z + 10);
  // A steeper fixed view clears the foreground ridges while keeping their
  // faces visible. The camera never spins with the car during a drift.
  const offset = new THREE.Vector3(50, 170, 85);
  const target = new THREE.Vector3();
  const lookAhead = new THREE.Vector3(0, 0, 10);
  const projection = new THREE.Vector3();
  let width = 0, height = 0, elapsed = 0;
  const resize = () => {
    width = window.innerWidth; height = window.innerHeight;
    renderer.setSize(width, height, false);
    const aspect = width / height;
    const halfHeight = height < 550 ? 34 : 51;
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
    camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  return {
    renderer, routes, isRoad, resize,
    render(state, dt, active, reducedMotion) {
      elapsed += dt;
      car.group.position.set(state.x, state.y, state.z);
      car.group.rotation.set(state.pitch, -state.heading, state.roll, "YXZ");
      car.body.rotation.z = reducedMotion ? 0 : clamp(state.yaw * state.speed * 0.002, -0.065, 0.065);
      car.body.rotation.x = reducedMotion ? 0 : Math.sin(elapsed * 26) * Math.min(state.speed / 2000, 0.015);
      car.body.position.y = reducedMotion ? 0 : state.suspension;
      car.beams.forEach(beam => { beam.visible = state.grounded && !state.inWater; });
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
      target.set(state.x + lookAhead.x, groundFocus + 2, state.z + lookAhead.z);
      focus.lerp(target, reducedMotion ? 1 : 1 - Math.exp(-4 * dt));
      camera.position.copy(focus).add(offset);
      camera.lookAt(focus);
      moon.position.set(focus.x - 100, focus.y + 120, focus.z - 65);
      moon.target.position.copy(focus);
      updateTrails(state, reducedMotion ? 0 : dt, active && !reducedMotion);
      if (!reducedMotion && dt) updateWater(dt);
      rings.forEach((ring, index) => { ring.material.opacity = reducedMotion ? 0.6 : 0.45 + Math.sin(elapsed * 1.7 + index) * 0.12; });
      renderer.render(scene, camera);
    },
    project(x, y, z, absolute = false) {
      projection.set(x, absolute ? y : terrainHeight(x, z) + y, z).project(camera);
      return { x: (projection.x + 1) * width / 2, y: (1 - projection.y) * height / 2, visible: projection.z > -1 && projection.z < 1 && Math.abs(projection.x) < 1.1 && Math.abs(projection.y) < 1.1 };
    },
    snapCamera(state) { lookAhead.set(Math.sin(state.heading) * 10, 0, -Math.cos(state.heading) * 10); focus.set(state.x + lookAhead.x, state.y + 2, state.z + lookAhead.z); },
  };
}
