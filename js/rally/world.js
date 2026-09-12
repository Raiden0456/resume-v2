import { CatmullRomCurve3, Vector3 } from "../vendor/three/three.module.min.js";

export const WORLD = { width: 1320, depth: 1480, limitX: 400, limitZ: 465, summit: 300 };
export const SNOW_LINE = 238;
export const MEADOW_LINE = 45;
export const SPAWN = { x: -110, z: -351, heading: Math.PI };
export const START_LINE = { x: SPAWN.x, z: SPAWN.z + 6.6, heading: SPAWN.heading, elevation: 300, halfWidth: 7 };

// Authored stages, newest to oldest. The route doubles back around separate
// ridges, opens into a quarry, then trades exposed ledges for forest and valley.
// Coordinates are [x, z, elevation]; one continuous spline joins every stage.
export const STAGES = [
  { name: "SUMMIT LEDGE", width: 8.5, tint: "#827c6b", points: [[-110,-351,300],[-110,-326,300],[-131,-301,298],[-185,-308,284],[-232,-289,274],[-242,-251,266],[-208,-221,258]] },
  { name: "SLATE HAIRPINS", width: 9, tint: "#7c7466", points: [[-164,-203,250],[-120,-183,242],[-79,-173,237],[-43,-194,233],[-31,-174,230],[-71,-146,226]] },
  { name: "KNIFE EDGE", width: 8, tint: "#847b68", points: [[-24,-123,220],[33,-139,210],[63,-191,200],[104,-237,190],[157,-256,182]] },
  { name: "QUARRY BOWL", width: 12, tint: "#8c7861", points: [[202,-247,177],[218,-209,169],[193,-169,160],[214,-123,152],[256,-134,149],[285,-109,143],[257,-68,137]] },
  { name: "THE FAST DESCENT", width: 11, tint: "#7b7059", points: [[227,-35,133],[177,-16,125],[143,25,113],[148,70,104],[112,107,96]] },
  { name: "FOREST ESSES", width: 10, tint: "#716950", points: [[66,124,94],[16,104,89],[-20,120,86],[-67,113,81],[-88,73,78],[-138,65,73],[-179,87,69]] },
  { name: "CREEK CUT", width: 9, tint: "#776953", points: [[-188,139,65],[-239,171,57],[-264,203,49],[-251,245,43],[-205,260,38]] },
  { name: "VALLEY RUN", width: 13, tint: "#7d7059", points: [[-155,244,35],[-109,265,31],[-64,251,27],[-24,285,21],[20,321,14],[83,350,8],[150,337,6],[190,367,3],[230,390,0]] },
];
const nodes = STAGES.flatMap(stage => stage.points);
const curve = new CatmullRomCurve3(nodes.map(([x, z, y]) => new Vector3(x, y, z)), false, "centripetal");
let nodeIndex = 0;
export const ROUTES = STAGES.map((stage, index) => {
  const start = index ? nodeIndex - 1 : 0;
  nodeIndex += stage.points.length;
  const end = nodeIndex - 1;
  const samples = [];
  // Sampling per control segment keeps the same centreline for painting,
  // traction, road grading, markers and the map, including every stage join.
  for (let node = start; node < end; node++) {
    const a = nodes[node], b = nodes[node + 1];
    const count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.1);
    for (let i = 0; i < count; i++) {
      const point = curve.getPoint((node + i / count) / (nodes.length - 1));
      samples.push([point.x, point.z, point.y]);
    }
  }
  samples.push(nodes[end]);
  return { ...stage, closed: false, samples };
});

export const SIGHTS = {
  "Rowte.io": { id: "rowte", stage: 8, type: "bank", label: "THE SUMMIT EXCHANGE", color: "#df8b74", x: -133, z: -331, marker: [-110,-326], altitude: 300 },
  "NextStreet": { id: "nextstreet", stage: 7, type: "hub", label: "THE BUSINESS HUB", color: "#dfae5a", x: -206, z: -247, marker: [-208,-221], altitude: 258 },
  "Supplier Success Accelerator": { id: "supplier", stage: 6, type: "accelerator", label: "THE BUSINESS ACCELERATOR", color: "#dfae5a", x: -89, z: -130, marker: [-71,-146], altitude: 226 },
  "OkVPN": { id: "okvpn", stage: 5, type: "tower", label: "SIGNAL RIDGE", color: "#8fc48e", x: 159, z: -278, marker: [157,-256], altitude: 182 },
  "RedNeck Studio": { id: "redneck", stage: 4, type: "arcade", label: "THE QUARRY ARCADE", color: "#e06c75", x: 282, z: -69, marker: [257,-68], altitude: 137 },
  "AURUS": { id: "aurus", stage: 3, type: "showroom", label: "THE GRAND SHOWROOM", color: "#e5c07b", x: 131, z: 123, marker: [112,107], altitude: 96 },
  "CROSSNETICS": { id: "crossnetics", stage: 2, type: "web3", label: "THE FOREST NODE", color: "#7a86d6", x: -202, z: 76, marker: [-179,87], altitude: 69 },
  "FaceStellar": { id: "facestellar", stage: 1, type: "salon", label: "THE BEAUTY SALON", color: "#8f86cf", x: -212, z: 282, marker: [-205,260], altitude: 38, summary: "A CRM system for a beauty salon, built with Node.js, Express, and React to support customer service." },
  "Highway Logistic Group": { id: "highway", stage: 0, type: "depot", label: "THE VALLEY DEPOT", color: "#c9926b", x: 170, z: 322, marker: [150,337], altitude: 6 },
};
const smoothstep = (min, max, value) => {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return t * t * (3 - 2 * t);
};

// Unequal rocky masses, rather than an extrusion of a north/south profile.
// Steep flanks and two carved gullies expose the elevation beside the road.
const PEAKS = [
  [-121,-368,343,260,250], [-203,-294,318,230,220], [-72,-235,352,260,235],
  [45,-200,276,215,200], [156,-258,245,190,190], [290,-188,232,140,185],
  [186,-29,181,190,205], [40,56,156,215,185], [-123,117,134,210,185],
  [-250,213,92,180,180], [-26,283,47,235,170], [148,323,21,180,150],
  [-170,-500,470,300,220], [-165,-590,490,330,260], [-520,-420,300,230,300], [430,-470,230,220,260],
];
function baseHeight(x, z) {
  let height = 0;
  for (const [px, pz, peak, rx, rz] of PEAKS) {
    const distance = Math.hypot((x - px) / rx, (z - pz) / rz);
    height = Math.max(height, peak * Math.max(0, 1 - distance) ** 0.85);
  }
  const crags = Math.sin(x * 0.044 + z * 0.019) * Math.sin(z * 0.057) * 12
    + Math.abs(Math.sin(x * 0.035 - z * 0.031)) * 10 + Math.sin(x * 0.14 + z * 0.087) * 2;
  height += crags * smoothstep(8, 100, height);
  const ravine = Math.exp(-(((x + 25 + z * 0.24) / 24) ** 2)) * Math.exp(-(((z - 5) / 90) ** 4)) * 65;
  const quarry = Math.exp(-(((x - 245) / 26) ** 2) - ((z + 183) / 52) ** 2) * 65;
  const edge = (1 - smoothstep(560, 650, Math.abs(x))) * (1 - smoothstep(640, 730, Math.abs(z)));
  return Math.max(0, height - ravine - quarry) * edge;
}

// A spatial index lets the shared heightfield cut a level-width road into
// rugged rock without testing the entire course for every terrain vertex.
const roadGrid = new Map(), CELL = 32;
const courseSegments = [];
let courseDistance = 0;
for (const route of ROUTES) for (let i = 0; i < route.samples.length - 1; i++) {
  const a = route.samples[i], b = route.samples[i + 1], reach = route.width / 2 + 27;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const segment = { a, b, width: route.width, name: route.name, progress: courseDistance, length };
  courseSegments.push(segment);
  courseDistance += length;
  for (let gx = Math.floor((Math.min(a[0], b[0]) - reach) / CELL); gx <= Math.floor((Math.max(a[0], b[0]) + reach) / CELL); gx++) {
    for (let gz = Math.floor((Math.min(a[1], b[1]) - reach) / CELL); gz <= Math.floor((Math.max(a[1], b[1]) + reach) / CELL); gz++) {
      const key = `${gx},${gz}`;
      if (!roadGrid.has(key)) roadGrid.set(key, []);
      roadGrid.get(key).push(segment);
    }
  }
}
export function roadAt(x, z) {
  let nearest = null, best = Infinity;
  for (const segment of roadGrid.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) || []) {
    const { a, b } = segment, dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    const distance = (x - a[0] - dx * t) ** 2 + (z - a[1] - dz * t) ** 2;
    if (distance < best) { best = distance; nearest = { x: a[0] + dx * t, z: a[1] + dz * t, distance: Math.sqrt(distance), y: a[2] + (b[2] - a[2]) * t, heading: Math.atan2(dx, -dz), width: segment.width, name: segment.name, progress: segment.progress + segment.length * t }; }
  }
  return nearest;
}
export const FINISH_LINE = { id: "finish", name: "Finish line", x: 230, z: 390, elevation: 0, heading: roadAt(230, 390).heading, halfWidth: 9 };
export const CAMPS = [
  { id: "start", ...SPAWN, elevation: WORLD.summit, radius: 34, outer: 46 },
  { id: "finish", ...FINISH_LINE, radius: 42, outer: 54 },
];
const PADS = Object.values(SIGHTS).map(sight => ({ x: (sight.x + sight.marker[0]) / 2, z: (sight.z + sight.marker[1]) / 2, y: sight.altitude }));
PADS.push(...CAMPS.map(camp => ({ x: camp.x, z: camp.z, y: camp.elevation, radius: camp.radius, outer: camp.outer })));

export function landHeight(x, z) {
  let height = baseHeight(x, z);
  const road = roadAt(x, z);
  if (road) height += (road.y - height) * (1 - smoothstep(road.width / 2 + 3, road.width / 2 + 27, road.distance));
  for (const pad of PADS) {
    const distance = Math.hypot(x - pad.x, z - pad.z);
    if (distance < (pad.outer || 34)) height += (pad.y - height) * (1 - smoothstep(pad.radius || 22, pad.outer || 34, distance));
  }
  return height;
}

// One continuous stream from the headwaters to the valley. Its five road
// crossings are computed from the same curves that render the road and water.
const riverNodes = [
  [-162,-612,424], [-166,-560,405], [-169,-500,372], [-170,-455,335],
  [-170,-415,319], [-179,-362,298], [-188,-309,273], [-169,-272,260],
  [-108,-251,232], [-30,-239,209], [76,-206,186], [116,-113,162],
  [95,-36,129], [49,24,107], [29,109,79], [-11,159,68], [-121,187,53],
  [-251,199,39], [-269,273,25], [-272,318,21], [-131,352,16], [-2,380,9],
  [108,313,4], [140,272,2], [286,285,1], [371,372,0.6], [358,482,0.3],
];
const riverCurve = new CatmullRomCurve3(riverNodes.map(([x, z, y]) => new Vector3(x, y, z)), false, "centripetal");
let lastWaterHeight = Infinity;
export const RIVER = riverCurve.getPoints(1500).map((point, index) => {
  lastWaterHeight = Math.min(lastWaterHeight, point.y);
  return [point.x, point.z, lastWaterHeight, 4 + index / 1500 * 2];
});
const riverGrid = new Map();
for (let i = 0; i < RIVER.length - 1; i++) {
  const a = RIVER[i], b = RIVER[i + 1], reach = a[3] + 22;
  for (let gx = Math.floor((Math.min(a[0], b[0]) - reach) / CELL); gx <= Math.floor((Math.max(a[0], b[0]) + reach) / CELL); gx++) {
    for (let gz = Math.floor((Math.min(a[1], b[1]) - reach) / CELL); gz <= Math.floor((Math.max(a[1], b[1]) + reach) / CELL); gz++) {
      const key = `${gx},${gz}`;
      if (!riverGrid.has(key)) riverGrid.set(key, []);
      riverGrid.get(key).push({ a, b, index: i });
    }
  }
}
export function riverAt(x, z) {
  let best = Infinity, result = null;
  for (const { a, b, index } of riverGrid.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) || []) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    const distance = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
    if (distance < best) { best = distance; result = { distance, y: a[2] + (b[2] - a[2]) * t, width: a[3] + (b[3] - a[3]) * t, heading: Math.atan2(dx, -dz), index }; }
  }
  return result;
}
export const TERRACES = [];
export const CORRIDORS = [];
function corridorProfile(corridor, x, z) {
  const path = corridor.path;
  let best = Infinity, along = 0, total = 0;
  const lengths = path.slice(1).map(([bx, bz], i) => Math.hypot(bx - path[i][0], bz - path[i][1]));
  lengths.forEach((length, i) => {
    const [ax, az] = path[i], dx = path[i + 1][0] - ax, dz = path[i + 1][1] - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    const distance = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (distance < best) { best = distance; along = total + t * length; }
    total += length;
  });
  return { distance: best, fraction: total ? along / total : 0 };
}
export const CROSSINGS = [];
for (const route of ROUTES) for (let i = 1; i < route.samples.length; i++) {
  const a = route.samples[i - 1], b = route.samples[i], dx = b[0] - a[0], dz = b[1] - a[1];
  for (const { a: c, b: d, index } of riverGrid.get(`${Math.floor(a[0] / CELL)},${Math.floor(a[1] / CELL)}`) || []) {
    const ex = d[0] - c[0], ez = d[1] - c[1], denominator = dx * ez - dz * ex;
    if (Math.abs(denominator) < 1e-8) continue;
    const t = ((c[0] - a[0]) * ez - (c[1] - a[1]) * ex) / denominator;
    const u = ((c[0] - a[0]) * dz - (c[1] - a[1]) * dx) / denominator;
    if (t < 0 || t > 1 || u < 0 || u > 1) continue;
    const x = a[0] + dx * t, z = a[1] + dz * t;
    if (CROSSINGS.some(crossing => Math.hypot(x - crossing.x, z - crossing.z) < 4)) continue;
    const angle = Math.abs(denominator) / (Math.hypot(dx, dz) * Math.hypot(ex, ez));
    const type = ["KNIFE EDGE", "VALLEY RUN"].includes(route.name) ? "jump" : "bridge";
    const bridgeIndex = CROSSINGS.filter(crossing => crossing.type === "bridge").length;
    CROSSINGS.push({ id: `crossing-${CROSSINGS.length}`, type, x, z, y: a[2] + (b[2] - a[2]) * t, style: bridgeIndex === 1 ? "timber" : "rail",
      heading: Math.atan2(dx, -dz), grade: (b[2] - a[2]) / Math.hypot(dx, dz), progress: roadAt(x, z).progress,
      halfWidth: route.width / 2 + 0.6, gap: c[3] / Math.max(0.3, angle) + (type === "jump" ? 1 : 2.2),
      rampLength: 17, rise: type === "jump" ? 6 : 0, riverIndex: index,
      label: type === "jump" ? (route.name === "KNIFE EDGE" ? "RIDGE JUMP" : "VALLEY JUMP") : `${["SLATE", "FOREST", "CREEK"][bridgeIndex]} BRIDGE`,
    });
  }
}

export function crossingCoordinates(crossing, x, z) {
  if (crossing.type === "bridge") {
    const road = roadAt(x, z);
    if (road) return { along: road.progress - crossing.progress, across: (x - road.x) * Math.cos(road.heading) + (z - road.z) * Math.sin(road.heading) };
  }
  const dx = x - crossing.x, dz = z - crossing.z;
  return { along: dx * Math.sin(crossing.heading) - dz * Math.cos(crossing.heading), across: dx * Math.cos(crossing.heading) + dz * Math.sin(crossing.heading) };
}
export function crossingPoint(crossing, along, across = 0) {
  if (crossing.type === "bridge") {
    const progress = crossing.progress + along;
    let low = 0, high = courseSegments.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (courseSegments[middle].progress <= progress) low = middle; else high = middle - 1;
    }
    const { a, b, progress: start, length } = courseSegments[low];
    const t = Math.max(0, Math.min(1, (progress - start) / length)), dx = b[0] - a[0], dz = b[1] - a[1];
    return { x: a[0] + dx * t - dz / length * across, z: a[1] + dz * t + dx / length * across };
  }
  return { x: crossing.x + Math.sin(crossing.heading) * along + Math.cos(crossing.heading) * across,
    z: crossing.z - Math.cos(crossing.heading) * along + Math.sin(crossing.heading) * across };
}
export function crossingDeckHeight(crossing, along, across = 0) {
  const { x, z } = crossingPoint(crossing, along);
  const original = landHeight(x, z);
  if (crossing.type === "bridge") {
    return original + 0.14 * smoothstep(0, 4, Math.min(along - crossing.deckStart, crossing.deckEnd - along));
  }
  if (along <= -crossing.gap) {
    const t = Math.max(0, Math.min(1, (along + crossing.gap + crossing.rampLength) / crossing.rampLength));
    return original + crossing.rise * t * t;
  }
  return original + 1.5 * (1 - smoothstep(crossing.gap, crossing.gap + crossing.rampLength, along));
}

// The terrain is the riverbed; a bridge or ramp is a separate driveable surface.
// This leaves real air underneath a jump instead of lifting the car by script.
export function terrainHeight(x, z) {
  let height = landHeight(x, z);
  const river = riverAt(x, z);
  if (river && river.distance < river.width + 19) {
    const bank = river.y - 1.8 + smoothstep(river.width * 0.55, river.width + 7, river.distance) * 6;
    height += (bank - height) * (1 - smoothstep(river.width + 1, river.width + 19, river.distance));
    const road = roadAt(x, z);
    if (road && road.distance < road.width / 2 + 5) {
      const approach = smoothstep(river.width + 0.8, river.width + 3.5, river.distance) * (1 - smoothstep(road.width / 2, road.width / 2 + 5, road.distance));
      height += (landHeight(x, z) - height) * approach;
    }
  }
  const dry = river ? smoothstep(river.width + 0.2, river.width + 1.6, river.distance) : 1;
  for (const corridor of CORRIDORS) {
    const trail = corridorProfile(corridor, x, z);
    if (trail.distance >= corridor.outer) continue;
    const target = corridor.startY + (corridor.endY - corridor.startY) * smoothstep(0, 1, trail.fraction);
    height += (target - height) * (1 - smoothstep(corridor.width, corridor.outer, trail.distance)) * dry * smoothstep(0, 0.08, trail.fraction);
  }
  for (const site of TERRACES) {
    const terrace = Math.hypot(x - site.x, z - site.z);
    if (terrace < site.outer) height += (site.y - height) * (1 - smoothstep(site.radius, site.outer, terrace)) * dry;
  }
  return height;
}
// Curved crossings can run almost parallel to the river at one bank. Extend
// each end until the entire deck width meets dry, level road, then overlap it.
for (const crossing of CROSSINGS.filter(crossing => crossing.type === "bridge")) {
  for (const side of [-1, 1]) {
    let extent = crossing.gap + 7;
    for (; extent < crossing.gap + 70; extent++) {
      const centre = crossingPoint(crossing, side * extent), roadHeight = landHeight(centre.x, centre.z);
      const joined = [-1, -0.5, 0, 0.5, 1].every(offset => {
        const point = crossingPoint(crossing, side * extent, offset * crossing.halfWidth);
        return Math.abs(terrainHeight(point.x, point.z) - roadHeight) < 0.08;
      });
      if (joined) break;
    }
    crossing[side < 0 ? "deckStart" : "deckEnd"] = side * (extent + 2);
  }
}

export function crossingSections(crossing) {
  return crossing.type === "bridge" ? [[crossing.deckStart, crossing.deckEnd]]
    : [[-crossing.gap - crossing.rampLength, -crossing.gap], [crossing.gap, crossing.gap + crossing.rampLength]];
}

export const RAILS = [];
for (const crossing of CROSSINGS.filter(crossing => crossing.style === "rail")) {
  for (const side of [-1, 1]) {
    const across = side * (crossing.halfWidth - 0.1);
    let previous = crossingPoint(crossing, crossing.deckStart, across);
    for (let along = crossing.deckStart + 2; along < crossing.deckEnd + 2; along += 2) {
      const end = Math.min(along, crossing.deckEnd), point = crossingPoint(crossing, end, across);
      RAILS.push({ ax: previous.x, az: previous.z, bx: point.x, bz: point.z, y: crossingDeckHeight(crossing, end - 1, across) });
      previous = point;
    }
  }
}

export function driveHeightAt(x, z, ceiling = Infinity) {
  const ground = terrainHeight(x, z);
  for (const crossing of CROSSINGS) {
    const { along, across } = crossingCoordinates(crossing, x, z);
    if (Math.abs(across) > crossing.halfWidth || !crossingSections(crossing).some(([from, to]) => along >= from && along <= to)) continue;
    const deck = crossingDeckHeight(crossing, along, across);
    if (deck <= ceiling && deck > ground) return deck;
  }
  return ground;
}

export function terrainGradient(x, z, heightAt = terrainHeight) {
  const step = 0.7;
  return { x: (heightAt(x + step, z) - heightAt(x - step, z)) / (step * 2), z: (heightAt(x, z + step) - heightAt(x, z - step)) / (step * 2) };
}
function arrivalAt([x, z]) {
  return { x, z, heading: roadAt(x, z)?.heading ?? Math.PI };
}

export function createLandmarks(resume) {
  const landmarks = [];
  for (const job of resume.experience || []) {
    for (const project of job.projects || [job.project || { name: job.company }]) {
      const index = landmarks.length;
      const fallbackAngle = index * 2.4;
      const design = SIGHTS[project.name] || {
        id: `sight-${index}`, stage: index + 9, type: "town", label: "THE WORKSHOP", color: "#56b6c2",
        x: Math.cos(fallbackAngle) * 180, z: 345,
        marker: [Math.cos(fallbackAngle) * 180, 363],
      };
      const subsections = project.subsections || job.subsections || [];
      landmarks.push({
        ...design, index, name: project.name, company: job.company,
        role: job.role, period: job.period, subsections,
        description: design.summary || project.description || subsections.flatMap(section => section.items || [])[0] || job.role,
        stack: project.stack || job.stack || [],
        url: project.url || job.companyUrl || null,
        radius: { tower: 5.5, hub: 11.5, showroom: 10 }[design.type] ?? 8,
      });
    }
  }
  return landmarks.sort((a, b) => b.stage - a.stage).map((sight, index) => ({ ...sight, index, elevation: terrainHeight(...sight.marker), arrival: arrivalAt(sight.marker), courseDistance: roadAt(...sight.marker)?.progress ?? 0 }));
}

export function loadVisits(storage, landmarks) {
  try {
    const saved = JSON.parse(storage.getItem("resume-rally-visits-v1") || "[]");
    const ids = new Set(landmarks.map(sight => sight.id));
    return new Set(Array.isArray(saved) ? saved.filter(id => ids.has(id)) : []);
  } catch {
    return new Set();
  }
}

export function saveVisits(storage, visits) {
  try { storage.setItem("resume-rally-visits-v1", JSON.stringify([...visits])); } catch { /* Private browsing can disable storage. */ }
}
