import * as THREE from "../vendor/three/three.module.min.js";
import { RIVER, CROSSINGS, crossingPoint, crossingDeckHeight, crossingSections, terrainHeight } from "./world.js";

function stripGeometry(rows) {
  const positions = [], indices = [];
  for (const row of rows) positions.push(...row[0], ...row[1]);
  for (let i = 0; i < rows.length - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function makeWater(scene, batch) {
  const rows = RIVER.map(([x, z, y, width], i) => {
    const a = RIVER[Math.max(0, i - 1)], b = RIVER[Math.min(RIVER.length - 1, i + 1)];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = -(b[1] - a[1]) / length, nz = (b[0] - a[0]) / length;
    return [[x + nx * width, y + 0.08, z + nz * width], [x - nx * width, y + 0.08, z - nz * width]];
  });
  const water = new THREE.Mesh(stripGeometry(rows), new THREE.MeshStandardMaterial({ color: "#367f96", emissive: "#173b46", emissiveIntensity: 0.35, roughness: 0.27, metalness: 0.18, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  water.receiveShadow = true; scene.add(water);
  for (let i = 4; i < RIVER.length - 1; i += 11) {
    for (const side of [0, 1]) {
      const [x, , z] = rows[i][side];
      const size = 0.65 + (i % 5) * 0.24;
      batch.add("rock", i % 3 ? "#5a7274" : "#778b87", x, size * 0.18, z, size * 1.4, size * 0.7, size, 0.2, i * 0.8, 0.2);
    }
  }
  // Small drifting streaks show the flow direction, including on cascades.
  const foam = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: "#c4e4dd", transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }), 180);
  foam.instanceMatrix.setUsage(THREE.DynamicDrawUsage); foam.frustumCulled = false; scene.add(foam);
  const dummy = new THREE.Object3D();
  let flow = 0;
  const update = dt => {
    flow += dt * 4.8;
    for (let i = 0; i < 180; i++) {
      const cursor = (i * (RIVER.length - 2) / 180 + flow) % (RIVER.length - 2), j = Math.floor(cursor), t = cursor - j;
      const a = RIVER[j], b = RIVER[j + 1], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      const side = Math.sin(i * 17.23) * a[3] * 0.78;
      dummy.position.set(a[0] + dx * t - dz / length * side, a[2] + (b[2] - a[2]) * t + 0.15, a[1] + dz * t + dx / length * side);
      dummy.rotation.set(-Math.PI / 2 + Math.atan2(b[2] - a[2], length), Math.atan2(-dx, -dz), 0, "YXZ");
      dummy.scale.set(0.13 + (i % 3) * 0.07, 1.1 + (i % 5) * 0.35, 1);
      dummy.updateMatrix(); foam.setMatrixAt(i, dummy.matrix);
    }
    foam.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return update;
}

export function buildCrossings(scene, batch) {
  const deckMaterial = new THREE.MeshStandardMaterial({ color: "#879288", roughness: 0.9, side: THREE.DoubleSide });
  const rampMaterial = new THREE.MeshStandardMaterial({ color: "#a79062", roughness: 0.88, side: THREE.DoubleSide });
  const timberMaterial = new THREE.MeshStandardMaterial({ color: "#8b6a44", roughness: 0.95, side: THREE.DoubleSide });
  const add = batch.absolute;
  for (const crossing of CROSSINGS) {
    const sections = crossingSections(crossing);
    for (const [from, to] of sections) {
      const count = Math.ceil((to - from) / 0.8), rows = [];
      for (let i = 0; i <= count; i++) {
        const along = from + (to - from) * i / count;
        rows.push([-1, 1].map(side => {
          const across = side * crossing.halfWidth, { x, z } = crossingPoint(crossing, along, across);
          return [x, crossingDeckHeight(crossing, along, across) + 0.035, z];
        }));
      }
      const timber = crossing.style === "timber";
      const deck = new THREE.Mesh(stripGeometry(rows), timber ? timberMaterial : crossing.type === "bridge" ? deckMaterial : rampMaterial);
      deck.castShadow = true; deck.receiveShadow = true; scene.add(deck);
      // Visible abutments and joists make the water below the deck readable.
      for (let i = 0; i <= count; i += 3) {
        const along = from + (to - from) * i / count, { x, z } = crossingPoint(crossing, along);
        const y = crossingDeckHeight(crossing, along);
        const ahead = crossingPoint(crossing, along + 0.4), behind = crossingPoint(crossing, along - 0.4);
        const heading = Math.atan2(ahead.x - behind.x, behind.z - ahead.z);
        const pitch = Math.atan2(crossingDeckHeight(crossing, along + 0.4) - crossingDeckHeight(crossing, along - 0.4), Math.hypot(ahead.x - behind.x, ahead.z - behind.z));
        add("box", timber ? "#5e4630" : "#3f5557", x, y - 0.28, z, crossing.halfWidth * 2 + 0.25, 0.5, 0.55, pitch, -heading, 0);
        for (const side of [-1, 1]) {
          const p = crossingPoint(crossing, along, side * (crossing.halfWidth - 0.1));
          const py = crossingDeckHeight(crossing, along, side * (crossing.halfWidth - 0.1));
          if (timber) {
            add("box", "#6b4f33", p.x, py + 0.14, p.z, 0.32, 0.28, 2.5, pitch, -heading, 0);
          } else if (crossing.type === "bridge") {
            add("box", "#a5b3aa", p.x, py + 0.7, p.z, 0.15, 1.4, 0.15);
            add("box", "#a4b8b4", p.x, py + 1.1, p.z, 0.12, 0.17, 2.65, pitch, -heading, 0);
          } else {
            add("box", i % 2 ? "#e1c78c" : "#303d43", p.x, py + 0.12, p.z, 0.28, 0.25, 2.2, pitch, -heading, 0);
          }
        }
      }
      if (timber) for (let i = 0; i <= count; i++) {
        const along = from + (to - from) * i / count, { x, z } = crossingPoint(crossing, along);
        const ahead = crossingPoint(crossing, along + 0.4), behind = crossingPoint(crossing, along - 0.4);
        add("box", "#6a4d31", x, crossingDeckHeight(crossing, along) + 0.045, z, crossing.halfWidth * 2, 0.03, 0.1, 0, -Math.atan2(ahead.x - behind.x, behind.z - ahead.z), 0);
      }
      for (const along of [from + 1.5, to - 1.5]) for (const side of [-1, 1]) {
        const { x, z } = crossingPoint(crossing, along, side * (crossing.halfWidth - 0.8));
        const top = crossingDeckHeight(crossing, along), bottom = terrainHeight(x, z) - 0.5;
        const height = Math.max(1, top - bottom);
        add("box", "#516469", x, bottom + height / 2, z, 0.65, height, 0.8, 0, -crossing.heading, 0);
      }
    }
    // Three painted chevrons before each lip, and bright flags at the takeoff.
    if (crossing.type === "jump") {
      for (const along of [-crossing.gap - 13, -crossing.gap - 9, -crossing.gap - 5]) {
        for (const side of [-1, 1]) {
          const { x, z } = crossingPoint(crossing, along, side * 0.8), y = crossingDeckHeight(crossing, along, side * 0.8);
          add("box", "#efcf86", x, y + 0.07, z, 0.16, 0.08, 2.2, 0, -crossing.heading + side * 0.65, 0, "light");
        }
      }
      for (const side of [-1, 1]) {
        const { x, z } = crossingPoint(crossing, -crossing.gap, side * (crossing.halfWidth + 0.65)), y = crossingDeckHeight(crossing, -crossing.gap);
        add("cylinder", "#afb7a5", x, y + 1.8, z, 0.1, 3.6, 0.1);
        add("box", "#e5bd73", x + side * 0.7, y + 3.1, z, 1.3, 0.8, 0.08, 0, -crossing.heading, 0, "light");
      }
    }
  }
}
