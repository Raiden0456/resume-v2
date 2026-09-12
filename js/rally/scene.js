import * as THREE from "../vendor/three/three.module.min.js";
import { createCameraRig } from "./camera.js";
import { ROUTES, WORLD, SPAWN, FINISH_LINE, CAMPS, SNOW_LINE, MEADOW_LINE, terrainHeight, terrainGradient, driveHeightAt, riverAt, roadAt, CROSSINGS } from "./world.js";
import { makeGround } from "./terrain.js";
import { makeWater, buildCrossings } from "./water.js";
import { createCrashEffect, createSplashEffect, createFireworks } from "./effects.js";
import { createAtmosphere } from "./atmosphere.js";

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
  const [padWidth, padDepth] = { hub: [24, 18], showroom: [24, 18], web3: [22, 18] }[sight.type] || [18, 14];
  box("#424a50", 0, 0.15, 0, padWidth, 0.3, padDepth);
  const windows = (width, height, z, columns, rows) => {
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      box((col + row) % 4 ? "#aeaa7d" : "#3f5961", (col - (columns - 1) / 2) * width, 1.8 + row * height, z, width * 0.55, height * 0.55, 0.07, "light");
    }
  };
  if (sight.type === "bank") {
    box("#ece4dd", 0, 3.4, 0, 12, 6.4, 8);
    box("#c9a9a6", 0, 6.8, 0, 13, 0.5, 9);
    box(c, 0, 5.6, 4.1, 11.5, 0.3, 0.12, "light");
    box(dark, 0, 1.8, 4.1, 2.2, 3.1, 0.2);
    for (const x of [-4.8, -2.9, 2.9, 4.8]) box("#f6f1ea", x, 2.7, 4.8, 0.65, 5, 0.7);
    box("#e4d6cf", 0, 0.5, 5.1, 13, 0.6, 2);
    box("#f2d9d2", 0, 7.2, 0, 4, 0.5, 4);
    for (let i = 0; i < 3; i++) add("cylinder", c, 0, 7.8 + i * 0.45, 0, 1.25, 0.3, 1.25);
  } else if (sight.type === "hub") {
    box("#243b5e", 0, 7.2, -1.5, 9.5, 14, 8.5);
    box("#d7d3ca", 0, 14.4, -1.5, 10.5, 0.45, 9.5);
    box("#4a707c", 0, 7.2, 2.8, 8.6, 13.4, 0.1, "glass");
    for (const x of [-3.9, -1.3, 1.3, 3.9]) box("#c8d1c3", x, 7.2, 2.95, 0.14, 13.6, 0.12);
    for (let row = 0; row < 6; row++) box(row % 2 ? "#f5d9a6" : "#f8efe0", 0, 2.2 + row * 2.1, -1.5 + 4.28, 7.6, 0.55, 0.06, "light");
    for (const [x, h, color] of [[-8.6, 6.4, "#2d4a73"], [8.6, 7.6, "#34527d"]]) {
      box(color, x, h / 2 + 0.3, 0, 7.2, h, 9.5);
      box("#d7d3ca", x, h + 0.5, 0, 7.9, 0.4, 10.3);
      box("#4a707c", x, h / 2 + 0.6, 4.8, 6.2, h - 1.6, 0.1, "glass");
      for (let row = 0; row < Math.floor(h / 2.2); row++) box("#f5d9a6", x, 1.9 + row * 2.2, 4.86, 5.4, 0.45, 0.05, "light");
    }
    box("#cfc9bc", 0, 0.42, 7.6, 23, 0.25, 5);
    box("#d7d3ca", 0, 3.4, 4.6, 7, 0.22, 3.4);
    for (const x of [-3.1, 3.1]) box("#c8d1c3", x, 1.9, 6.1, 0.18, 3, 0.18);
    box(dark, 0, 1.6, 2.9, 2.6, 2.7, 0.15);
    box(c, 0, 15.1, -1.5, 5.5, 0.9, 0.5, "light");
    box(c, 0, 4.1, 3.05, 8.4, 0.22, 0.14, "light");
    for (let i = 0; i < 6; i++) {
      const angle = i / 6 * Math.PI * 2, nx = -8 + Math.cos(angle) * 1.9, nz = 8 + Math.sin(angle) * 1.9;
      add("rock", i % 2 ? c : "#e2dfcd", nx, 1.7 + Math.sin(i * 2.1) * 0.5, nz, 0.42, 0.42, 0.42, 0, 0, 0, "light");
      const next = (i + 1) / 6 * Math.PI * 2;
      add("box", "#c8d1c3", -8 + Math.cos((angle + next) / 2) * 1.9, 1.7 + (Math.sin(i * 2.1) + Math.sin((i + 1) * 2.1)) * 0.25, 8 + Math.sin((angle + next) / 2) * 1.9, 0.06, 0.06, 2, Math.atan2(Math.sin(i * 2.1) - Math.sin((i + 1) * 2.1), 4), -(angle + next) / 2 - Math.PI / 2, 0);
    }
    add("box", "#c8d1c3", -8, 1.7, 8, 0.06, 0.06, 3.8, 0, 0, 0);
    add("box", "#c8d1c3", -8, 1.7, 8, 0.06, 0.06, 3.8, 0, Math.PI / 3, 0);
    add("box", "#c8d1c3", -8, 1.7, 8, 0.06, 0.06, 3.8, 0, -Math.PI / 3, 0);
    add("cylinder", "#636d68", -8, 0.5, 8, 0.5, 0.5, 0.5);
    for (const x of [5, 7.2, 9.4]) {
      add("cylinder", "#d7d3ca", x, 4, 8.6, 0.07, 7.4, 0.07);
      box([c, "#f8efe0", "#243b5e"][Math.round((x - 5) / 2.2)], x + 0.75, 7.1, 8.6, 1.5, 0.9, 0.06);
    }
  } else if (sight.type === "accelerator") {
    // A business campus: offices, a meeting terrace and an ascending roofline.
    box("#2d4a73", -2, 3.2, -1, 10, 5.8, 8);
    box("#243b5e", 4.6, 5, -1.6, 4, 9.4, 6.8);
    box("#d7d3ca", -2, 6.4, -1, 11, 0.45, 9);
    box("#d7d3ca", 4.6, 9.8, -1.6, 4.7, 0.4, 7.5);
    box("#4a707c", -2, 3.3, 3.06, 9.3, 4.5, 0.1, "glass");
    for (const x of [-6.3, -3.4, -0.5, 2.4]) box("#c2cebf", x, 3.1, 3.2, 0.14, 4.6, 0.12);
    for (let row = 0; row < 4; row++) box("#f5d9a6", 4.6, 1.8 + row * 2, 1.86, 3.2, 0.8, 0.08, "light");
    box(c, -2, 5.6, 3.4, 10.5, 0.25, 0.2, "light");
    box("#abb6a6", -2, 0.55, 5, 10.5, 0.35, 3.3);
    for (let i = 0; i < 3; i++) box(c, -4 + i * 1.55, 7.1 + i * 0.5, -1, 0.9, 1 + i, 0.8);
    add("cylinder", "#d0c7ae", 4.6, 1.3, 5, 1.3, 0.15, 1.3);
    add("cylinder", "#6c7776", 4.6, 0.8, 5, 0.18, 0.9, 0.18);
    for (const [x, z] of [[2.5, 5], [6.6, 5], [4.6, 6.9]]) { box("#536f72", x, 0.7, z, 0.9, 0.9, 0.9); box(c, x, 1.3, z + 0.3, 0.9, 0.8, 0.15); }
  } else if (sight.type === "tower") {
    box("#2f5d4a", 0, 1.9, 0, 7, 3.2, 7);
    box("#24473a", 0, 3.8, 0, 7.6, 0.5, 7.6);
    for (const x of [-1.7, 1.7]) for (const z of [-1.7, 1.7]) add("box", "#dfe6e4", x, 9, z, 0.27, 11, 0.27, z * -0.026, 0, x * 0.026);
    for (let i = 0; i < 4; i++) {
      box("#c9d6cf", 0, 5 + i * 2.4, 0, 3.4 - i * 0.3, 0.18, 3.4 - i * 0.3);
      add("box", "#dfe6e4", 0, 6 + i * 2.4, 1.4 - i * 0.1, 0.15, 3.3, 0.15, 0, 0, 0.8);
    }
    add("cylinder", "#dfe6e4", 0, 15, 0, 0.13, 5, 0.13);
    add("rock", "#61afef", 0, 17.9, 0, 0.9, 0.9, 0.9, 0.4, 0.3, 0);
    add("rock", "#98c379", 0.35, 18.1, 0.3, 0.5, 0.45, 0.4, 0.2, 0.9, 0.4);
    add("rock", "#98c379", -0.3, 17.6, -0.35, 0.42, 0.4, 0.45, 0.7, 0.2, 0.1);
    add("dome", "#e8eef0", 1.7, 12, 0, 1.7, 1, 1.7, 0, 0, -Math.PI / 2);
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
  } else if (sight.type === "showroom") {
    const gold = "#d9c07a";
    box("#2a2f37", 0, 0.42, 0, 21, 0.3, 13.5);
    box("#4b4952", 0, 3.5, -6.5, 21, 6, 0.5);
    box("#4a5763", 0, 3.5, 6.55, 20, 6, 0.1, "glass");
    for (const side of [-1, 1]) box("#4a5763", side * 10.55, 3.5, 0, 0.1, 6, 13, "glass");
    for (const z of [-7.3, 7.3]) { box("#d9cfb4", 0, 6.7, z, 22.5, 0.45, 0.5); box(gold, 0, 6.98, z, 22.5, 0.12, 0.5, "light"); }
    for (const x of [-11, 11]) box("#d9cfb4", x, 6.7, 0, 0.5, 0.45, 15);
    for (let x = -9.6; x <= 9.7; x += 2.4) box("#c9b98f", x, 6.75, 0, 0.22, 0.28, 14.6);
    box("#c9b98f", 0, 6.8, 0, 22, 0.2, 0.22);
    for (const x of [-10.4, -5.2, 0, 5.2, 10.4]) box("#c9b98f", x, 3.5, 6.5, 0.3, 6, 0.3);
    for (const x of [-10.4, 10.4]) box("#c9b98f", x, 3.5, -6.4, 0.3, 6, 0.3);
    add("torus", gold, 0, 5.6, 0, 1.7, 1.7, 1, Math.PI / 2, 0, 0, "light");
    add("torus", gold, 0, 5.1, 0, 1, 1, 1, Math.PI / 2, 0, 0, "light");
    add("cylinder", "#e7e2d0", 0, 5.4, 0, 0.12, 1.3, 0.12, 0, 0, 0, "light");
    const luxury = (cx, cz, angle, body, trim) => {
      const sin = Math.sin(angle), cos = Math.cos(angle);
      const place = (shape, color, px, py, pz, sx, sy, sz, kind = "solid", rx = 0, rz = 0) => add(shape, color, cx + px * cos - pz * sin, py, cz + px * sin + pz * cos, sx, sy, sz, rx, -angle, rz, kind);
      add("cylinder", "#3b3f47", cx, 0.7, cz, 3.4, 0.28, 3.4);
      add("torus", gold, cx, 0.86, cz, 3.2, 3.2, 1, Math.PI / 2, 0, 0, "light");
      place("box", "#15191d", 0, 1.15, 0, 2.5, 0.35, 6.2);
      place("box", body, 0, 1.55, 0, 2.6, 0.7, 6.3);
      place("box", "#1b2329", 0, 2.25, 0.2, 2.2, 0.75, 2.9, "glass");
      place("box", body, 0, 2.66, 0.2, 2.1, 0.12, 2.6);
      place("box", trim, 0, 1.6, -3.19, 1.6, 0.55, 0.08, "light");
      place("box", gold, 0, 1.92, -3.17, 0.4, 0.5, 0.06, "light");
      for (const x of [-0.95, 0.95]) place("box", "#f1e6c2", x, 1.7, -3.18, 0.5, 0.2, 0.06, "light");
      for (const x of [-0.85, 0.85]) place("box", "#c65d4c", x, 1.6, 3.19, 0.55, 0.16, 0.06, "light");
      place("box", gold, 0, 1.5, 0, 2.72, 0.06, 6, "light");
      for (const x of [-1.32, 1.32]) for (const z of [-2, 2.05]) {
        place("cylinder", "#101418", x, 1.05, z, 0.62, 0.42, 0.62, "solid", 0, Math.PI / 2);
        place("cylinder", gold, x * 1.16, 1.05, z, 0.36, 0.04, 0.36, "light", 0, Math.PI / 2);
      }
      place("box", "#cfa74d", 0, 2.85, 0.2, 0.7, 0.05, 0.7, "light");
    };
    luxury(-6.4, 0.6, 0.35, "#0f1216", "#e8e0c4");
    luxury(0, -0.4, -0.15, "#5d1f27", "#e8e0c4");
    luxury(6.4, 0.6, -0.4, "#ece5d3", "#2a2f37");
    box("#8b2a34", 0, 0.58, 10, 3.2, 0.06, 6.5);
    for (const z of [7.6, 9.6, 11.6, 13.4]) for (const side of [-1, 1]) {
      add("cylinder", gold, side * 2, 1.05, z, 0.07, 1.1, 0.07);
      add("rock", gold, side * 2, 1.65, z, 0.14, 0.14, 0.14, 0, 0, 0, "light");
      if (z < 13) add("box", "#8b2a34", side * 2, 1.4, z + 1, 0.05, 0.05, 1.9, 0.18, 0, 0);
    }
    box(dark, 0, 1.6, 6.6, 3, 3.2, 0.2);
    add("cylinder", gold, 0, 7.5, 7.3, 0.12, 1.4, 0.12);
    box(gold, 0, 8.7, 7.3, 4.2, 1.1, 0.35, "light");
    add("torus", gold, 0, 8.7, 7.05, 0.95, 0.95, 1, 0, 0, 0, "light");
    for (const x of [-8, 8]) { add("cylinder", "#b7bfb2", x, 3.9, 9.4, 0.08, 7, 0.08); box(gold, x + 0.75, 6.9, 9.4, 1.5, 0.9, 0.06); }
    for (const x of [-7, 7]) { add("cylinder", "#4b4952", x, 0.8, -8.4, 0.18, 1.6, 0.18); add("cone", "#f1e6c2", x, 1.9, -8.4, 0.5, 0.6, 0.5, Math.PI, 0, 0, "light"); }
  } else if (sight.type === "web3") {
    const neon = "#56b6c2", ink = "#1f2330";
    add("cylinder", "#2a2e3b", 0, 0.45, 0, 9.5, 0.3, 9.5);
    add("cylinder", "#2b2f3d", 0, 4.2, 0, 3.2, 8, 3.2);
    add("cylinder", ink, 0, 8.5, 0, 3.5, 0.7, 3.5);
    for (const y of [1.8, 4.4, 7]) add("torus", c, 0, y, 0, 3.4, 3.4, 1, Math.PI / 2, 0, 0, "light");
    for (let i = 0; i < 4; i++) box(neon, 0, 2 + i * 1.4, 3.23, 0.28, 0.28, 0.08, "light");
    add("torus", c, 0, 11.4, 0, 2.1, 2.1, 1.6, 0, 0, 0, "light");
    add("torus", neon, 0, 11.4, 0, 1.3, 1.3, 1.6, 0, 0, 0, "light");
    add("cylinder", ink, 0, 11.4, 0, 0.75, 0.3, 0.75, Math.PI / 2, 0, 0);
    add("rock", "#e2dfcd", 0.25, 11.65, 0.2, 0.18, 0.18, 0.18, 0, 0, 0, "light");
    add("cylinder", "#9b93ad", 0, 9.8, 0, 0.16, 1.9, 0.16);
    for (let i = 0; i < 7; i++) {
      const angle = i / 7 * Math.PI * 2, r = 6.6, y = 4.6 + Math.sin(i * 1.9) * 1.1;
      const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
      add("box", i % 2 ? c : "#5b68b8", x, y, z, 1.15, 1.15, 1.15, 0.6, angle, 0.5);
      add("box", "#e2dfcd", x, y, z, 0.5, 0.5, 0.5, 0.6, angle, 0.5, "light");
      const next = (i + 1) / 7 * Math.PI * 2, ny = 4.6 + Math.sin((i + 1) * 1.9) * 1.1;
      const mx = Math.cos((angle + next) / 2) * r * 0.975, mz = Math.sin((angle + next) / 2) * r * 0.975;
      add("box", neon, mx, (y + ny) / 2, mz, 0.07, 0.07, Math.hypot(Math.cos(next) * r - x, ny - y, Math.sin(next) * r - z) - 1.1, Math.atan2(y - ny, Math.hypot(Math.cos(next) * r - x, Math.sin(next) * r - z)), -(angle + next) / 2 - Math.PI / 2, 0, "light");
      add("cylinder", "#2b2f3d", x, y / 2 - 0.4, z, 0.12, y - 1.4, 0.12);
    }
    box(ink, 8.6, 4.4, -0.5, 0.4, 5.2, 7.4);
    box("#2b3550", 8.35, 4.4, -0.5, 0.1, 4.6, 6.8, "light");
    for (let i = 0; i < 7; i++) box(i === 6 ? "#98c379" : neon, 8.28, 2.5 + (0.6 + i * 0.5) / 2, -3.2 + i * 0.9, 0.06, 0.6 + i * 0.5, 0.55, "light");
    box("#e2dfcd", 8.28, 6.4, -0.5, 0.06, 0.25, 5.6, "light");
    for (const x of [8.2, 9]) box("#2b2f3d", x, 0.9, -0.5, 0.3, 1.8, 0.3);
    box(ink, -5.6, 1.4, 7.4, 3.2, 2.4, 0.3);
    box(c, -5.6, 1.5, 7.58, 2.8, 0.7, 0.05, "light");
    box(dark, 0, 1.4, 3.15, 1.7, 2.6, 0.2);
  } else if (sight.type === "salon") {
    const indigo = "#4d4a8f", silver = "#b9bec8", white = "#d8dbe2";
    const logo = (lx, ly, lz, size, color) => {
      for (const side of [-1, 1]) box(color, lx + side * 0.36 * size, ly + 0.1 * size, lz, 0.17 * size, 0.9 * size, 0.06, "light");
      box(color, lx, ly - 0.38 * size, lz, 0.89 * size, 0.17 * size, 0.06, "light");
      for (const side of [-1, 1]) add("rock", color, lx + side * 0.8 * size, ly + 0.12 * size, lz, 0.11 * size, 0.11 * size, 0.06, 0, 0, 0, "light");
    };
    box(white, 0, 2.8, 0, 12, 5, 8);
    add("dome", "#e3e5ea", 0, 5.2, 0, 6.6, 1.7, 4.6);
    box(silver, 0, 5.35, 0, 12.4, 0.16, 8.4);
    box(indigo, 4.6, 2.8, 4.08, 2.8, 4.6, 0.16);
    logo(4.6, 3.2, 4.2, 1.1, "#dfe1e8");
    box("#587179", -2.2, 2.6, 4.06, 7.2, 3.5, 0.1, "glass");
    for (const x of [-5.6, 1.4]) box(silver, x, 2.5, 4.2, 0.14, 4.1, 0.12);
    for (const x of [-4.4, -2.8, -1.2, 0.4]) {
      add("torus", indigo, x, 3.1, 4.14, 0.42, 0.62, 0.8, 0, 0, 0, "light");
      box("#f3f2f7", x, 3.1, 4.12, 0.5, 0.9, 0.04, "light");
    }
    box(white, -2.2, 4.45, 4.9, 8, 0.2, 1.7);
    box(indigo, -2.2, 4.32, 4.9, 7.8, 0.06, 1.5, "light");
    box("#cfd3dc", 0, 0.35, 5, 13, 0.15, 2.5);
    for (const x of [-3.4, 3.4]) {
      add("cylinder", "#8f96a8", x, 0.7, 3.1, 0.5, 0.9, 0.5);
      box("#8a93b0", x, 1.3, 3.1, 1.35, 0.35, 1.2);
      box("#8a93b0", x, 1.9, 3.6, 1.35, 1, 0.18);
      add("torus", silver, x, 3, 1.3, 0.8, 1.05, 1);
      box("#c8d6df", x, 3, 1.26, 1.3, 1.65, 0.05, "light");
    }
    box(indigo, -6.04, 2.8, 0, 0.12, 4.6, 7.4);
    for (const z of [-2.2, 0, 2.2]) box(silver, -6.12, 2.8, z, 0.05, 0.08, 1.4);
    add("cylinder", silver, 0, 7.35, 0, 0.09, 0.95, 0.09);
    box(silver, 0, 7.8, 0, 3.6, 0.1, 0.25);
    logo(0, 8.65, 0, 1.7, indigo);
    add("cylinder", "#c7ae8c", -7.2, 0.7, 4.4, 0.7, 1, 0.7);
    add("rock", "#78816b", -7.2, 1.6, 4.4, 0.85, 0.9, 0.85);
  } else if (sight.type === "depot") {
    box("#56668a", -2, 2.9, -1, 10, 5.2, 9);
    box("#2f3f5c", -2, 5.9, -1, 11, 0.7, 10);
    box(c, -2, 5.5, -1, 10.2, 0.22, 9.2, "light");
    box("#e2dfcd", -2, 0.8, -1, 10.15, 1, 9.15);
    for (const x of [-4.5, 0.3]) {
      box("#8e9bb5", x, 2.05, 3.55, 4.1, 3.7, 0.12);
      box("#2a3347", x, 2, 3.62, 3.6, 3.3, 0.1);
      for (let y = 0.9; y < 3.4; y += 0.55) box("#4d5b78", x, y, 3.68, 3.5, 0.06, 0.04);
    }
    for (let i = 0; i < 4; i++) box("#f0e2bf", -7.07, 4.3, -3.4 + i * 1.6, 0.06, 0.7, 1, "light");
    for (let i = 0; i < 2; i++) {
      box(i ? "#c48a5a" : "#33507a", 5.5, 1.6 + i * 2.5, -1, 3, 2.4, 8);
      for (let z = -4; z < 3; z += 0.7) box(i ? "#8e6340" : "#1d2b4a", 7.04, 1.6 + i * 2.5, z, 0.08, 2.2, 0.12);
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
  const obstacles = [];
  const farFromSights = (x, z) => landmarks.every(sight => Math.hypot(x - sight.x, z - sight.z) > sight.radius + 9 && Math.hypot(x - sight.marker[0], z - sight.marker[1]) > 13);
  for (let i = 0; i < 3400; i++) {
    const x = random() * 740 - 370, z = random() * 890 - 445;
    const water = riverAt(x, z);
    if ((water && water.distance < water.width + 4) || isRoad(x, z, 5) || !farFromSights(x, z)) continue;
    const elevation = terrainHeight(x, z);
    const slope = terrainGradient(x, z);
    const rocky = elevation > 175 || Math.hypot(slope.x, slope.z) > 0.9;
    const meadow = elevation < MEADOW_LINE && !rocky;
    const size = 0.7 + random() * (rocky ? 3 : 1.5);
    if (meadow && i % 3 !== 0) {
      const spread = 1.2 + random() * 1.6;
      for (let k = 0; k < 3; k++) {
        const bx = x + (random() - 0.5) * spread * 2, bz = z + (random() - 0.5) * spread * 2, bs = 0.6 + random() * 0.9;
        batch.add("rock", k % 2 ? "#4f7047" : "#5e8452", bx, bs * 0.45, bz, bs * 1.2, bs * 0.75, bs, 0, random() * 6);
      }
      if (i % 5 === 0) batch.add("rock", ["#e5c07b", "#e2dfcd", "#d19a9c"][i % 3], x, 0.9, z, 0.16, 0.16, 0.16, 0, 0, 0, "light");
    } else if (!rocky && (i % 3 === 0 || (z > 30 && z < 235))) {
      const h = 4 + random() * 5;
      batch.add("cylinder", "#62574a", x, h * 0.25, z, 0.22, h * 0.5, 0.22);
      batch.add("cone", "#465f52", x, h * 0.6, z, size * 1.4, h * 0.9, size * 1.4, 0, random() * 6);
      batch.add("cone", "#597363", x, h * 0.85, z, size, h * 0.7, size, 0, random() * 6);
      obstacles.push({ x, z, elevation, radius: 0.55, height: h });
    } else if (rocky || i % 4 === 0) {
      const snowy = elevation > SNOW_LINE;
      batch.add("rock", snowy ? "#b9c0c1" : elevation > 190 ? "#8a8e86" : "#616d68", x, size * 0.4, z, size * 1.3, size * 0.85, size, random(), random(), random());
      if (snowy) batch.add("rock", "#e6ebea", x, size * 0.62, z, size * 1.05, size * 0.35, size * 0.8, random() * 0.3, random(), random() * 0.3);
      if (size >= 1.1) obstacles.push({ x, z, elevation, radius: size * 0.8, height: size * 0.9 });
    } else {
      batch.add("rock", i % 2 ? "#536954" : "#657a5c", x, size * 0.45, z, size, size * 0.6, size * 0.85, 0, random() * 6);
      if (size >= 1.3) obstacles.push({ x, z, elevation, radius: size * 0.7, height: size * 0.6 });
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
      if (CAMPS.some(camp => Math.hypot(px - camp.x, pz - camp.z) < camp.radius + 3)) continue;
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
  const finish = (shape, color, x, y, z, sx, sy, sz, kind = "solid") => {
    const sin = Math.sin(FINISH_LINE.heading), cos = Math.cos(FINISH_LINE.heading);
    batch.absolute(shape, color, FINISH_LINE.x + x * cos - z * sin, FINISH_LINE.elevation + y, FINISH_LINE.z + x * sin + z * cos, sx, sy, sz, 0, -FINISH_LINE.heading, 0, kind);
  };
  for (const x of [-9, 9]) finish("box", "#8c9991", x, 4, 0, 0.35, 8, 0.35);
  finish("box", "#a5ad99", 0, 7.5, 0, 18, 1.3, 0.3);
  for (let i = 0; i < 18; i++) finish("box", i % 2 ? "#303a3c" : "#e2dcc7", i - 8.5, 7.5, 0.17, 0.9, 1.1, 0.06);
  for (const side of [-1, 1]) {
    finish("box", "#e5c07b", side * 9, 7.5, 0, 0.55, 1.5, 0.6, "light");
    finish("cylinder", "#9eaa9f", side * 12, 3, -4, 0.12, 6, 0.12);
    finish("box", side < 0 ? "#98c379" : "#dd735f", side * 12 + 1, 5.4, -4, 2, 1.3, 0.1);
    finish("box", "#303d42", side * 13, 0.5, 2, 1.8, 1, 1.8);
    for (let i = 0; i < 4; i++) finish("cylinder", "#b2c2a6", side * 13 + (i % 2 - 0.5) * 0.6, 1.1, 2 + (Math.floor(i / 2) - 0.5) * 0.6, 0.16, 0.65, 0.16);
  }
  return obstacles;
}

function obstacleIndex(obstacles, cell = 40) {
  const grid = new Map();
  for (const obstacle of obstacles) {
    const key = `${Math.floor(obstacle.x / cell)},${Math.floor(obstacle.z / cell)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(obstacle);
  }
  let lastKey = "", nearby = [];
  return (x, z) => {
    const gx = Math.floor(x / cell), gz = Math.floor(z / cell), key = `${gx},${gz}`;
    if (key === lastKey) return nearby;
    lastKey = key; nearby = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) nearby.push(...(grid.get(`${gx + dx},${gz + dz}`) || []));
    return nearby;
  };
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
  let width = 0, height = 0, elapsed = 0;
  const resize = () => {
    width = window.innerWidth; height = window.innerHeight;
    renderer.setSize(width, height, false);
    cameraRig.resize(width, height);
  };
  resize();
  cameraRig.snap(new THREE.Vector3(SPAWN.x, driveHeightAt(SPAWN.x, SPAWN.z) + 2, SPAWN.z + 10));
  return {
    renderer, routes, isRoad, resize, cameraRig, crashEffect, splashEffect, fireworks, atmosphere, obstacles, obstaclesNear,
    render(state, dt, active, reducedMotion, view = {}) {
      elapsed += dt;
      car.group.visible = !view.crashed;
      car.shadow.visible = !view.crashed;
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
      const cameraHeight = state.grounded ? groundFocus : Math.max(groundFocus, state.y - 6);
      target.set(state.x + lookAhead.x, cameraHeight + 2, state.z + lookAhead.z);
      cameraRig.update(target, dt, { ...view, car: state }, reducedMotion);
      const focus = cameraRig.focus;
      moon.position.set(focus.x - 100, focus.y + 120, focus.z - 65);
      moon.target.position.copy(focus);
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
      projection.set(x, absolute ? y : terrainHeight(x, z) + y, z).project(camera);
      return { x: (projection.x + 1) * width / 2, y: (1 - projection.y) * height / 2, visible: projection.z > -1 && projection.z < 1 && Math.abs(projection.x) < 1.1 && Math.abs(projection.y) < 1.1 };
    },
    snapCamera(state) { lookAhead.set(Math.sin(state.heading) * 10, 0, -Math.cos(state.heading) * 10); target.set(state.x + lookAhead.x, state.y + 2, state.z + lookAhead.z); cameraRig.snap(target); },
  };
}
