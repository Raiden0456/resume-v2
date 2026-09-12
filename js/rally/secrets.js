import { WORLD, SNOW_LINE, MEADOW_LINE, ROUTES, SIGHTS, CAMPS, CROSSINGS, TERRACES, CORRIDORS, riverAt, roadAt, terrainHeight, terrainGradient } from "./world.js";

export const COTTAGE_SITE = (() => {
  const x = 89.8, z = 308.2, river = riverAt(x, z), heading = Math.atan2(-50, 85) - 0.3;
  const right = [Math.cos(heading), Math.sin(heading)];
  const porch = { x: x - Math.sin(heading) * 5.5, z: z + Math.cos(heading) * 5.5 };
  const parking = { x: x + right[0] * 8 - Math.sin(heading) * 1.5, z: z + right[1] * 8 + Math.cos(heading) * 1.5, heading };
  const edge = roadAt(16, 307), turn = [86, 296];
  const toTurn = Math.hypot(turn[0] - edge.x, turn[1] - edge.z), shoulder = edge.width / 2 + 2.2;
  const path = [[edge.x + (turn[0] - edge.x) / toTurn * shoulder, edge.z + (turn[1] - edge.z) / toTurn * shoulder], turn, [parking.x, parking.z]];
  const site = { x, z, y: river.y + 4.8, radius: 10, outer: 24, heading, porch, parking, path };
  TERRACES.push(site);
  CORRIDORS.push({ path, startY: edge.y, endY: site.y, width: 5, outer: 13 });
  return site;
})();

export const CAMERA_FACING = Math.atan2(-50, 85);
function findSite({ route: routeName, from = 0.15, to = 0.85, side = 1, gaps = [18, 24, 30, 36], band = [-Infinity, Infinity], maxSlope = 0.25, water = null }) {
  const route = ROUTES.find(route => route.name === routeName), count = route.samples.length;
  const sights = Object.values(SIGHTS);
  for (const slope of [maxSlope, Math.max(maxSlope, 0.4)]) for (const lateral of gaps) for (const flip of [1, -1]) {
    for (let i = Math.floor(from * count); i < Math.min(count - 1, Math.floor(to * count)); i += 3) {
      const [ax, az] = route.samples[i], [bx, bz] = route.samples[i + 1], length = Math.hypot(bx - ax, bz - az) || 1;
      const nx = -(bz - az) / length * side * flip, nz = (bx - ax) / length * side * flip;
      const x = ax + nx * lateral, z = az + nz * lateral;
      if (Math.abs(x) > WORLD.limitX - 20 || Math.abs(z) > WORLD.limitZ - 20) continue;
      const road = roadAt(x, z), river = riverAt(x, z), gradient = terrainGradient(x, z), y = terrainHeight(x, z);
      if (road && road.distance < road.width / 2 + 12) continue;
      if (water ? !river || river.distance - river.width < water[0] || river.distance - river.width > water[1] : river && river.distance < river.width + 8) continue;
      if (y < band[0] || y > band[1] || Math.hypot(gradient.x, gradient.z) > slope) continue;
      if (sights.some(sight => Math.hypot(x - sight.x, z - sight.z) < 32 || Math.hypot(x - sight.marker[0], z - sight.marker[1]) < 32)) continue;
      if (CAMPS.some(camp => Math.hypot(x - camp.x, z - camp.z) < camp.outer + 10)) continue;
      if (CROSSINGS.some(crossing => Math.hypot(x - crossing.x, z - crossing.z) < crossing.gap + 40)) continue;
      if (TERRACES.some(site => Math.hypot(x - site.x, z - site.z) < 45)) continue;
      return { x, z, y };
    }
  }
  return null;
}
const SECRET_SPECS = [
  { id: "grave", name: "A lonely grave", line: "Bro, I told you about those energy drinks...", site: { x: 153, z: -113, y: 116 }, radius: 5, outer: 11, turn: 0.4 },
  { id: "cablecar", name: "The old cable car", line: "Last lift went up in 2019. Nobody came back for it.", find: { route: "SUMMIT LEDGE", band: [SNOW_LINE, 400], side: -1 }, radius: 6, outer: 14 },
  { id: "snowman", name: "Somebody's snowman", line: "Someone had time to kill at 250 metres. Respect.", find: { route: "SLATE HAIRPINS", band: [SNOW_LINE, 400], side: -1, from: 0.05, to: 0.6, gaps: [16, 20, 26, 32, 40], maxSlope: 0.7 }, radius: 4, outer: 10, turn: -0.3 },
  { id: "weather", name: "Weather station", line: "Forecast: gravel, with a chance of drift.", find: { route: "SLATE HAIRPINS", band: [200, 400], side: 1, maxSlope: 0.6 }, radius: 5, outer: 12 },
  { id: "wreck", name: "Car 03 never made it", line: "Hey! You can't park here!", find: { route: "KNIFE EDGE", band: [150, SNOW_LINE], side: -1 }, radius: 6, outer: 14, turn: 0.6 },
  { id: "campfire", name: "Cave campfire", line: "Somebody's still here. The tea is warm.", find: { route: "QUARRY BOWL", band: [110, SNOW_LINE], side: 1 }, radius: 6, outer: 14, sound: "crackle" },
  { id: "lookout", name: "The old lookout", line: "Stop doomscrolling. Look at that.", find: { route: "THE FAST DESCENT", band: [90, 200], side: -1, from: 0.1, to: 0.5 }, radius: 6, outer: 13 },
  { id: "swing", name: "Rope swing", line: "Not a checkpoint. Just a good afternoon.", find: { route: "THE FAST DESCENT", band: [MEADOW_LINE, 170], side: 1, from: 0.5 }, radius: 5, outer: 12 },
  { id: "owl", name: "Owl tree", line: "It has seen every one of your crashes.", find: { route: "FOREST ESSES", band: [MEADOW_LINE, 170], side: -1, from: 0.1, to: 0.5 }, radius: 4, outer: 10, sound: "hoot" },
  { id: "forager", name: "Mushroom picker", line: "The purple one is not for soup.", find: { route: "FOREST ESSES", band: [30, 170], side: 1, from: 0.5 }, radius: 5, outer: 12, turn: 0.3 },
  { id: "beehives", name: "The apiary", line: "Slow down. They're working.", find: { route: "CREEK CUT", band: [0, 90], side: 1 }, radius: 5, outer: 12 },
  { id: "fisherman", name: "Gone fishing", line: "Hasn't caught anything since 2022.", find: { route: "VALLEY RUN", band: [0, MEADOW_LINE + 10], side: 1, water: [1, 8], gaps: [14, 20, 28, 38, 50, 64, 78], from: 0.05, to: 0.75, maxSlope: 0.5 }, radius: 4, outer: 10 },
  { id: "tractor", name: "Rusty tractor", line: "Retired. The chickens run the place now.", find: { route: "VALLEY RUN", band: [0, MEADOW_LINE + 10], side: -1, from: 0.3, to: 0.9 }, radius: 7, outer: 15, turn: -0.5 },
];
export const SECRETS = [{ id: "cottage", name: "Home by the river", line: "My wife loves cats. All of them. =^.^=", ...COTTAGE_SITE, sound: "meow", approach: 16 }];
for (const spec of SECRET_SPECS) {
  const site = spec.site || findSite(spec.find);
  if (!site) continue;
  const secret = { id: spec.id, name: spec.name, line: spec.line, x: site.x, z: site.z, y: site.y ?? terrainHeight(site.x, site.z), radius: spec.radius, outer: spec.outer, heading: CAMERA_FACING + (spec.turn || 0), sound: spec.sound || "chime", approach: 16 };
  TERRACES.push(secret); SECRETS.push(secret);
}
export const CABLEWAY = (() => {
  const top = SECRETS.find(secret => secret.id === "cablecar");
  if (!top) return null;
  const end = { x: 120, z: 430 }, sights = Object.values(SIGHTS);
  const dx = end.x - top.x, dz = end.z - top.z, total = Math.hypot(dx, dz), ux = dx / total, uz = dz / total;
  const clear = (x, z) => {
    const road = roadAt(x, z), river = riverAt(x, z);
    if (road && road.distance < road.width / 2 + 8) return false;
    if (river && river.distance < river.width + 4) return false;
    if (sights.some(sight => Math.hypot(x - sight.x, z - sight.z) < 26 || Math.hypot(x - sight.marker[0], z - sight.marker[1]) < 22)) return false;
    if (CAMPS.some(camp => Math.hypot(x - camp.x, z - camp.z) < camp.outer + 6)) return false;
    return !TERRACES.some(site => site !== top && Math.hypot(x - site.x, z - site.z) < site.outer + 6);
  };
  const pylons = [];
  for (let d = -216; d < 0; d += 72) { const x = top.x + ux * d, z = top.z + uz * d; pylons.push({ x, z, y: terrainHeight(x, z), height: 9 }); }
  const summitIndex = pylons.length;
  pylons.push({ x: top.x, z: top.z, y: top.y, height: 9 });
  for (let d = 72; d < total + 1; d += 72) {
    const along = Math.min(d, total);
    for (const nudge of [0, 9, -9, 18, -18, 27, -27]) {
      const x = top.x + ux * (along + nudge), z = top.z + uz * (along + nudge);
      if (!clear(x, z)) continue;
      pylons.push({ x, z, y: terrainHeight(x, z), height: 9 }); break;
    }
  }
  top.heading = Math.atan2(ux, -uz);
  for (let pass = 0; pass < 3; pass++) for (let i = 1; i < pylons.length; i++) {
    const a = pylons[i - 1], b = pylons[i];
    let deficit = 0;
    for (let t = 0.05; t < 1; t += 0.05) {
      const cable = (a.y + a.height) * (1 - t) + (b.y + b.height) * t;
      deficit = Math.max(deficit, terrainHeight(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t) + 4 - cable);
    }
    if (deficit > 0) { a.height += deficit; b.height += deficit; }
  }
  return { pylons, heading: top.heading, summitIndex };
})();
if (CABLEWAY) CABLEWAY.pylons.forEach((pylon, i) => { if (i !== CABLEWAY.summitIndex) TERRACES.push({ x: pylon.x, z: pylon.z, y: pylon.y, radius: 2.5, outer: 6 }); });
export const COTTAGE = { x: COTTAGE_SITE.x, z: COTTAGE_SITE.z, heading: COTTAGE_SITE.heading, radius: 12, path: COTTAGE_SITE.path, parking: COTTAGE_SITE.parking };
