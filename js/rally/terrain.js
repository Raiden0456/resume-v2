import * as THREE from "../vendor/three/three.module.min.js";
import { WORLD, SPAWN, terrainHeight, terrainGradient } from "./world.js";

function drawContours(context) {
  const step = 6, columns = Math.ceil(WORLD.width / step), rows = Math.ceil(WORLD.depth / step);
  const heights = new Float32Array((columns + 1) * (rows + 1));
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
    heights[row * (columns + 1) + col] = terrainHeight(col * step - WORLD.width / 2, row * step - WORLD.depth / 2);
  }
  context.beginPath();
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const x = col * step - WORLD.width / 2, z = row * step - WORLD.depth / 2;
    const i = row * (columns + 1) + col;
    const corners = [[x, z, heights[i]], [x + step, z, heights[i + 1]], [x + step, z + step, heights[i + columns + 2]], [x, z + step, heights[i + columns + 1]]];
    const min = Math.min(...corners.map(point => point[2])), max = Math.max(...corners.map(point => point[2]));
    for (let level = Math.max(16, Math.ceil(min / 16) * 16); level < max; level += 16) {
      const intersections = [];
      corners.forEach((a, edge) => {
        const b = corners[(edge + 1) % 4];
        if ((a[2] <= level && b[2] > level) || (a[2] > level && b[2] <= level)) {
          const t = (level - a[2]) / (b[2] - a[2]);
          intersections.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
      });
      for (let p = 0; p < intersections.length - 1; p += 2) {
        context.moveTo(...intersections[p]); context.lineTo(...intersections[p + 1]);
      }
    }
  }
  context.strokeStyle = "#b6beab65";
  context.lineWidth = 0.2;
  context.stroke();
}

export function makeGround(scene, routes, landmarks) {
  const canvas = document.createElement("canvas");
  canvas.width = 3456; canvas.height = 4032;
  const context = canvas.getContext("2d");
  const scale = canvas.width / WORLD.width;
  let seed = 41;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  context.fillStyle = "#282e33";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.scale(scale, scale);
  // Exposed slate and darker forest soil make the actual relief readable.
  for (let z = -WORLD.depth / 2; z < WORLD.depth / 2; z += 6) for (let x = -WORLD.width / 2; x < WORLD.width / 2; x += 6) {
    const y = terrainHeight(x + 3, z + 3), slope = terrainGradient(x + 3, z + 3);
    const steepness = Math.hypot(slope.x, slope.z);
    context.fillStyle = y > 170 ? (steepness > 0.8 ? "#50595b" : "#3d484b") : steepness > 1 ? "#45504e" : y > 45 ? "#303f39" : "#2b3636";
    context.fillRect(x, z, 6.05, 6.05);
  }
  context.strokeStyle = "#48534e70";
  context.lineWidth = 0.1;
  context.beginPath();
  for (let x = -WORLD.width / 2; x <= WORLD.width / 2; x += 6) { context.moveTo(x, -WORLD.depth / 2); context.lineTo(x, WORLD.depth / 2); }
  for (let z = -WORLD.depth / 2; z <= WORLD.depth / 2; z += 6) { context.moveTo(-WORLD.width / 2, z); context.lineTo(WORLD.width / 2, z); }
  context.stroke();
  drawContours(context);
  context.strokeStyle = "#73827960";
  context.lineWidth = 0.12;
  context.beginPath();
  for (let x = -390; x < 400; x += 30) for (let z = -450; z < 460; z += 30) {
    context.moveTo(x - 0.7, z); context.lineTo(x + 0.7, z);
    context.moveTo(x, z - 0.7); context.lineTo(x, z + 0.7);
  }
  context.stroke();
  context.lineCap = "round"; context.lineJoin = "round";
  for (const route of routes) {
    context.beginPath();
    route.samples.forEach(([x, z], index) => index ? context.lineTo(x, z) : context.moveTo(x, z));
    if (route.closed) context.closePath();
    for (const [color, width] of [["#3e423d", route.width + 3], ["#5e5649", route.width], [route.tint, route.width - 1.1], ["#675c4b", route.width * 0.4]]) {
      context.strokeStyle = color; context.lineWidth = width; context.stroke();
    }
    context.strokeStyle = "#242a2440"; context.lineWidth = 0.17;
    for (const offset of [-1.2, 1.2]) {
      context.beginPath();
      route.samples.forEach(([x, z], i) => {
        const next = route.samples[Math.min(i + 1, route.samples.length - 1)];
        const angle = Math.atan2(next[1] - z, next[0] - x);
        const px = x - Math.sin(angle) * offset, pz = z + Math.cos(angle) * offset;
        if (i === 0) context.moveTo(px, pz); else context.lineTo(px, pz);
      });
      context.stroke();
    }
    for (let i = 13; i < route.samples.length - 1; i += 23 + Math.floor(random() * 12)) {
      const [x, z] = route.samples[i], next = route.samples[i + 1];
      context.fillStyle = "#292b2540";
      context.beginPath(); context.ellipse(x + random() - 0.5, z, 1 + random() * 2, 0.4 + random(), Math.atan2(next[1] - z, next[0] - x), 0, Math.PI * 2); context.fill();
    }
  }
  for (const sight of landmarks) {
    const [mx, mz] = sight.marker;
    context.fillStyle = "#505247";
    context.beginPath(); context.arc(mx, mz, 8.5, 0, Math.PI * 2); context.fill();
    context.fillStyle = "#343e40";
    context.fillRect(sight.x - 10, sight.z - 8, 20, 16);
    context.strokeStyle = "#89968765"; context.lineWidth = 0.16;
    context.strokeRect(sight.x - 10, sight.z - 8, 20, 16);
  }
  for (let i = 0; i < 70000; i++) {
    context.fillStyle = random() > 0.5 ? "#d8c29613" : "#080d101a";
    context.fillRect(random() * WORLD.width - WORLD.width / 2, random() * WORLD.depth - WORLD.depth / 2, random() * 0.3 + 0.05, random() * 0.2 + 0.05);
  }
  context.save();
  context.translate(SPAWN.x, SPAWN.z); context.rotate(SPAWN.heading);
  context.fillStyle = "#615a4c"; context.beginPath(); context.ellipse(0, 0, 13, 12, 0, 0, Math.PI * 2); context.fill();
  for (let row = 0; row < 2; row++) for (let col = 0; col < 12; col++) {
    context.fillStyle = (row + col) % 2 ? "#d9d3bd" : "#31363a";
    context.fillRect(-5.4 + col * 0.9, -7.5 + row * 0.9, 0.9, 0.9);
  }
  context.font = "600 1.8px monospace"; context.textAlign = "center"; context.fillStyle = "#bac0ac";
  context.fillText("300 M / THE DESCENT", 0, 16);
  context.font = "500 1.1px monospace"; context.fillStyle = "#879888";
  context.fillText("NOW → 2022 / TAKE YOUR TIME", 0, 20);
  context.strokeStyle = "#20262660"; context.lineWidth = 0.25;
  for (const radius of [4.1, 5.3]) { context.beginPath(); context.ellipse(0, 0, radius, radius * 0.8, -0.4, 0, 5.4); context.stroke(); }
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  const geometry = new THREE.PlaneGeometry(WORLD.width, WORLD.depth, 336, 392);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) positions.setY(i, terrainHeight(positions.getX(i), positions.getZ(i)));
  geometry.computeVertexNormals();
  const mountain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: texture, roughness: 1, flatShading: true }));
  mountain.receiveShadow = true; mountain.castShadow = true; scene.add(mountain);
  const valley = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({ color: "#252c32", roughness: 1 }));
  valley.rotation.x = -Math.PI / 2; valley.position.y = -4; scene.add(valley);
  const grid = new THREE.GridHelper(2400, 400, "#404b4d", "#404b4d");
  grid.position.y = -3.95; grid.material.transparent = true; grid.material.opacity = 0.3; scene.add(grid);
}
