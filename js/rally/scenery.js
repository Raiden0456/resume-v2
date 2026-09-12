import { SPAWN, FINISH_LINE, CAMPS, CROSSINGS, SNOW_LINE, MEADOW_LINE, terrainHeight, terrainGradient, riverAt, WORLD } from "./world.js";
import { COTTAGE, SECRETS, CABLEWAY } from "./secrets.js";

function seededRandom(seed = 42) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

export function buildScenery(batch, landmarks, isRoad, routes) {
  const random = seededRandom(83);
  const obstacles = [];
  const nearPath = (x, z) => COTTAGE.path.some(([px, pz], i) => {
    const [qx, qz] = COTTAGE.path[Math.min(i + 1, COTTAGE.path.length - 1)], dx = qx - px, dz = qz - pz;
    const t = Math.max(0, Math.min(1, ((x - px) * dx + (z - pz) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(x - px - dx * t, z - pz - dz * t) < 4;
  });
  const farFromSights = (x, z) => landmarks.every(sight => Math.hypot(x - sight.x, z - sight.z) > sight.radius + 9 && Math.hypot(x - sight.marker[0], z - sight.marker[1]) > 13);
  for (let i = 0; i < 8000; i++) {
    const x = random() * (WORLD.width - 80) - (WORLD.width - 80) / 2, z = random() * (WORLD.depth - 80) - (WORLD.depth - 80) / 2;
    const water = riverAt(x, z);
    if ((water && water.distance < water.width + 4) || isRoad(x, z, 5) || !farFromSights(x, z)) continue;
    if (nearPath(x, z) || SECRETS.some(secret => Math.hypot(x - secret.x, z - secret.z) < secret.radius + 4)) continue;
    if (CABLEWAY && CABLEWAY.pylons.some(pylon => Math.hypot(x - pylon.x, z - pylon.z) < 5)) continue;
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

export function obstacleIndex(obstacles, cell = 40) {
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
