import * as THREE from "../vendor/three/three.module.min.js";
import { CAMPS, COTTAGE, terrainHeight, roadAt } from "./world.js";

const CREAM = "#e7dfc5", DARK = "#28343a", TIMBER = "#9b8061";

// Small props share the scenery batches. Only flags, steam and a few machines
// animate, and only while their part of the mountain is close to the car.
export function createAtmosphere(scene, batch, landmarks) {
  const animated = [], obstacles = [], parkedCars = [];
  const geometries = { box: new THREE.BoxGeometry(1, 1, 1), puff: new THREE.IcosahedronGeometry(1, 0) };
  let elapsed = 0;

  function frame(x, z, heading = 0, base = terrainHeight(x, z)) {
    const sin = Math.sin(heading), cos = Math.cos(heading);
    const point = (px, py, pz) => new THREE.Vector3(x + px * cos - pz * sin, base + py, z + px * sin + pz * cos);
    const add = (shape, color, px, py, pz, sx, sy, sz, rx = 0, ry = 0, rz = 0, kind = "solid") => {
      const p = point(px, py, pz);
      batch.absolute(shape, color, p.x, p.y, p.z, sx, sy, sz, rx, ry - heading, rz, kind);
    };
    return { x, z, base, heading, point, add };
  }
  function at(camp, across, along, turn = 0) {
    return frame(camp.x + Math.cos(camp.heading) * across + Math.sin(camp.heading) * along,
      camp.z + Math.sin(camp.heading) * across - Math.cos(camp.heading) * along, camp.heading + turn, camp.elevation);
  }
  function solid(f, radius, height) {
    const road = roadAt(f.x, f.z);
    if (road && road.distance < road.width / 2 + radius + 1) return;
    if (landmarks.some(s => Math.hypot(f.x - s.marker[0], f.z - s.marker[1]) < radius + 9)) return;
    obstacles.push({ x: f.x, z: f.z, elevation: f.base, radius, height });
  }
  function sign(f, text, x, y, z, width = 5.5, accent = CREAM) {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 112;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#253137"; ctx.fillRect(0, 0, 512, 112);
    ctx.fillStyle = accent; ctx.fillRect(0, 0, 6, 112);
    ctx.font = "600 40px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 58, 464);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
    sprite.position.copy(f.point(x, y, z)); sprite.scale.set(width, width * 112 / 512, 1); scene.add(sprite);
  }
  function planter(f, x, z, color = "#75866a") {
    f.add("box", "#636d68", x, 0.45, z, 1.6, 0.9, 1.4);
    f.add("rock", color, x, 1.3, z, 1, 1.1, 0.9);
    for (const dx of [-0.4, 0.25]) f.add("rock", "#b9b592", x + dx, 1.9, z, 0.18, 0.16, 0.18);
  }
  function tyres(f, x, z, rows = 3) {
    for (let i = 0; i < rows; i++) {
      f.add("cylinder", "#20292e", x, 0.23 + i * 0.42, z, 0.62, 0.4, 0.62);
      f.add("cylinder", "#747d7a", x, 0.44 + i * 0.42, z, 0.3, 0.03, 0.3);
    }
  }
  function picnic(f) {
    f.add("box", TIMBER, 0, 1.2, 0, 3.8, 0.18, 1.6);
    for (const x of [-1.3, 1.3]) f.add("box", "#63726e", x, 0.6, 0, 0.16, 1.15, 1.4);
    for (const z of [-1.4, 1.4]) {
      f.add("box", TIMBER, 0, 0.68, z, 3.8, 0.16, 0.65);
      for (const x of [-1.3, 1.3]) f.add("box", "#63726e", x, 0.3, z, 0.16, 0.6, 0.55);
    }
    for (const x of [-0.8, 0.7]) f.add("cylinder", CREAM, x, 1.4, 0.3, 0.14, 0.25, 0.14);
    f.add("box", "#c68867", 0, 1.32, -0.2, 0.7, 0.08, 0.5);
  }
  function flag(f, color, height = 5) {
    f.add("cylinder", "#a8b5a4", 0, height / 2, 0, 0.08, height, 0.08);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.1, 8, 1), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.9 }));
    mesh.position.copy(f.point(1.2, height - 0.75, 0)); mesh.rotation.y = -f.heading;
    scene.add(mesh);
    animated.push({ object: mesh, tick(time) {
      const vertices = mesh.geometry.attributes.position;
      for (let i = 0; i < vertices.count; i++) { const reach = (vertices.getX(i) + 1.2) / 2.4; vertices.setZ(i, Math.sin(time * 1.6 + reach * 4 + f.x) * reach * 0.24); }
      vertices.needsUpdate = true; mesh.geometry.computeVertexNormals();
    } });
  }
  function steam(f, x, y, z) {
    const group = new THREE.Group(); group.position.copy(f.point(x, y, z));
    const puffs = Array.from({ length: 6 }, () => {
      const puff = new THREE.Mesh(geometries.puff, new THREE.MeshBasicMaterial({ color: "#c9d0bc", transparent: true, opacity: 0.12, depthWrite: false }));
      group.add(puff); return puff;
    });
    scene.add(group);
    animated.push({ object: group, tick(time, still) {
      puffs.forEach((puff, i) => {
        const life = ((still ? 0 : time * 0.22) + i / 6) % 1;
        puff.position.set(life * 1.1, life * 4.5, Math.sin(life * 3) * 0.5);
        puff.scale.setScalar(0.25 + life * 0.65); puff.material.opacity = (1 - life) * 0.14;
      });
    } });
  }
  function rotor(f, x, y, z, color = "#9ab4aa", radius = 1.4) {
    const group = new THREE.Group(); group.position.copy(f.point(x, y, z));
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(geometries.box, material);
      blade.rotation.y = i * Math.PI * 2 / 3; blade.position.set(Math.sin(blade.rotation.y) * radius / 2, 0, Math.cos(blade.rotation.y) * radius / 2);
      blade.scale.set(0.28, 0.12, radius); group.add(blade);
    }
    scene.add(group); animated.push({ object: group, tick(time) { group.rotation.y = time * 0.8; } });
  }
  function beacon(f, x, y, z, color) {
    const material = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), material);
    mesh.position.copy(f.point(x, y, z)); scene.add(mesh);
    const base = new THREE.Color(color);
    animated.push({ object: mesh, tick(time) { material.color.copy(base).multiplyScalar(0.72 + Math.sin(time * 1.5 + x) * 0.22); } });
  }
  function lights(a, b) {
    const samples = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, p = a.clone().lerp(b, t); p.y -= Math.sin(Math.PI * t) * 1.2; samples.push(p);
      if (i % 2) batch.absolute("dome", "#e5d5a0", p.x, p.y - 0.12, p.z, 0.16, 0.25, 0.16, Math.PI, 0, 0, "light");
    }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(samples), new THREE.LineBasicMaterial({ color: "#677469" })));
    for (const p of [a, b]) batch.absolute("cylinder", "#7c8a80", p.x, p.y - 3.5, p.z, 0.1, 7, 0.1);
  }
  function stall(f, title, accent) {
    f.add("box", TIMBER, 0, 1.35, 0, 5.8, 2.6, 3.7);
    f.add("box", DARK, 0, 2.35, 1.9, 5, 1.8, 0.08);
    f.add("box", CREAM, 0, 1.45, 2.4, 6.1, 0.2, 1.1);
    for (const x of [-2.7, 2.7]) f.add("box", "#a8b5a4", x, 2.5, 1.85, 0.14, 4.8, 0.14);
    for (let i = 0; i < 8; i++) f.add("box", i % 2 ? CREAM : accent, (i - 3.5) * 0.82, 4.2, 0.8, 0.84, 0.18, 5.3, 0.08);
    f.add("cylinder", "#73857f", -1.5, 3.4, -0.8, 0.3, 3.5, 0.3);
    for (const x of [-1.5, -0.8, 0.9, 1.5]) f.add("cylinder", x < 0 ? "#ddaa70" : CREAM, x, 1.72, 2.35, 0.19, 0.34, 0.19);
    f.add("box", "#708b87", 1.5, 1.9, 0.9, 1, 1.1, 0.8);
    sign(f, title, 0, 4.85, 1.5, 6.2, accent);
    steam(f, -1.5, 5.1, -0.8); solid(f, 3.4, 4.5);
  }
  function rallyCar(f, color, stripe, number, type = "coupe") {
    const length = type === "sedan" ? 5.7 : type === "hatch" ? 4.6 : 5.2;
    f.add("box", DARK, 0, 0.68, 0, 2.7, 0.6, length);
    f.add("box", color, 0, 1.15, 0, 2.8, 0.7, length);
    f.add("box", "#445d69", 0, 1.9, 0.3, 2.3, 1, type === "hatch" ? 2.7 : 2.4);
    f.add("box", color, 0, 2.44, 0.4, 2.4, 0.15, 2.05);
    for (const x of [-0.72, 0.72]) f.add("box", stripe, x, 1.52, -length * 0.35, 0.38, 0.05, length * 0.28);
    f.add("box", stripe, 0, 2.54, 0.4, 0.5, 0.04, 2.05);
    for (const x of [-1.4, 1.4]) for (const z of [-length * 0.31, length * 0.32]) {
      f.add("cylinder", "#19242a", x, 0.62, z, 0.59, 0.44, 0.59, 0, 0, Math.PI / 2);
      f.add("cylinder", type === "sedan" ? "#c4a267" : "#bac1b0", x * 1.17, 0.62, z, 0.34, 0.035, 0.34, 0, 0, Math.PI / 2);
      f.add("box", color, x * 0.88, 1.25, z, 0.6, 0.4, 1.35);
    }
    for (const x of [-0.9, 0.9]) {
      f.add("box", CREAM, x, 1.14, -length / 2 - 0.04, 0.65, 0.35, 0.08, 0, 0, 0, "light");
      f.add("box", "#bf6d59", x, 1.14, length / 2 + 0.04, 0.65, 0.24, 0.08, 0, 0, 0, "light");
      f.add("box", DARK, x, 1.9, length / 2 - 0.25, 0.13, 0.65, 0.2);
    }
    f.add("box", type === "sedan" ? color : DARK, 0, 2.25, length / 2 - 0.25, 3.1, 0.14, 0.55);
    if (type === "sedan") f.add("box", DARK, 0, 1.68, -1.8, 0.95, 0.22, 0.65);
    else for (const x of [-0.55, 0, 0.55]) f.add("cylinder", "#e8d89b", x, 1.15, -length / 2 - 0.17, 0.24, 0.16, 0.24, Math.PI / 2, 0, 0, "light");
    sign(f, number, 0, 2.55, 0.1, 0.75, stripe);
    solid(f, 2.6, 2.7); parkedCars.push({ x: f.x, z: f.z, type, number });
  }
  function service(f, accent) {
    for (const x of [-4.5, 4.5]) for (const z of [-3.5, 3.5]) f.add("box", "#adbbad", x, 2.5, z, 0.15, 5, 0.15);
    for (const side of [-1, 1]) f.add("box", side < 0 ? accent : CREAM, side * 2.35, 5.25, 0, 4.9, 0.16, 8, 0, 0, side * -0.15);
    f.add("box", "#697671", 0, 0.05, 0, 8.8, 0.1, 6.5);
    f.add("box", "#b77860", -3, 0.9, -2.5, 1.6, 1.8, 1);
    for (const y of [0.5, 0.9, 1.3]) f.add("box", CREAM, -3, y, -1.95, 1.3, 0.07, 0.04);
    tyres(f, 3, -2); tyres(f, 3, 0);
    f.add("cylinder", "#bb8065", -3.3, 1, 1.3, 0.45, 1.8, 0.45);
    sign(f, "SERVICE", 0, 5.8, 3, 6, accent);
    rotor(f, 0, 5.6, 0, "#85958d", 0.7);
  }

  const start = CAMPS[0], finish = CAMPS[1];
  stall(at(start, 23, -17, Math.PI), "SUMMIT COFFEE", "#d5ab76");
  picnic(at(start, 23, -5, Math.PI / 2));
  service(at(start, -20, -21), "#778f99");
  rallyCar(at(start, -5, -24), "#e1ddc8", "#aa7064", "07");
  rallyCar(at(start, 3, -24), "#8ca187", "#e4d8b6", "12", "hatch");
  flag(at(start, -28, -9), "#d8b07b"); flag(at(start, 15, -27), "#98c379");
  lights(at(start, -13, -16).point(0, 7, 0), at(start, 17, -19).point(0, 7, 0));

  stall(at(finish, -24, 0, -Math.PI / 2), "THE FINISH GRILL", "#c57b60");
  stall(at(finish, -24, 14, -Math.PI / 2), "COFFEE & WAFFLES", "#b9ad80");
  picnic(at(finish, -14, 8, Math.PI / 2)); picnic(at(finish, -14, 20, Math.PI / 2));
  service(at(finish, 19, -24, Math.PI), "#859c90");
  const liveries = [["#436f9f", "#d8bd75", "05", "sedan"], ["#e0dfce", "#72958a", "11", "coupe"], ["#ba705e", "#f0dbbc", "23", "hatch"], ["#bba37b", "#545f68", "46", "coupe"]];
  liveries.forEach(([color, stripe, number, type], i) => {
    const f = at(finish, 24, -10 + i * 8, -Math.PI / 2);
    f.add("box", "#4c5853", 0, 0.025, 0, 4.8, 0.05, 7.7);
    for (const x of [-2.2, 2.2]) f.add("box", "#bdbd9d", x, 0.065, 0, 0.11, 0.02, 7.3);
    f.add("box", "#bdbd9d", 0, 0.065, 3.6, 4.4, 0.02, 0.1);
    rallyCar(f, color, stripe, number, type);
  });
  sign(at(finish, 24, 25), "PARC FERMÉ", 0, 3.1, 0, 8, "#a8c5a0");
  for (const [x, z, color] of [[-33, -8, "#dd9477"], [-33, 24, "#cbb789"], [34, -12, "#85a8b9"], [34, 22, "#a1b993"]]) flag(at(finish, x, z), color, 6);
  lights(at(finish, -17, -10).point(0, 7, 0), at(finish, -17, 27).point(0, 7, 0));
  lights(at(finish, 32, -17).point(0, 7, 0), at(finish, 32, 24).point(0, 7, 0));

  for (const sight of landmarks) {
    const f = frame(sight.x, sight.z), a = f.add;
    planter(f, -9.2, 7.2, sight.type === "salon" ? "#7f86b8" : "#728969");
    planter(f, 9.2, 7.2);
    const pennant = frame(sight.x + 9.3, sight.z - 6.5, 0, f.base);
    flag(pennant, sight.color, 4.2);
    if (sight.type === "bank") {
      for (const x of [-3.8, 3.8]) {
        a("box", "#586e70", x, 1.4, 7.2, 1.6, 2.5, 1);
        a("box", "#a1c69b", x, 1.85, 7.74, 1, 0.75, 0.05, 0, 0, 0, "light");
        beacon(f, x, 2.75, 7.2, sight.color);
      }
      sign(f, "EXCHANGE / 24H", 0, 4.6, 7, 5, sight.color);
      rotor(f, -3.7, 7.2, -2, "#8d9e94", 0.8);
    } else if (sight.type === "hub") {
      for (const x of [3, 5]) {
        for (const z of [6.6, 8]) a("torus", "#89998f", x, 0.7, z, 0.6, 0.6, 0.6, 0, Math.PI / 2);
        a("box", "#a8bcac", x, 1.1, 7.3, 0.1, 0.1, 1.5);
        a("box", "#a8bcac", x, 1.2, 6.6, 0.1, 1.1, 0.1, 0.15);
        a("box", "#a8bcac", x, 1, 7.7, 0.1, 0.7, 0.1, -0.4);
        a("box", DARK, x, 1.5, 7.7, 0.4, 0.1, 0.45);
        a("box", DARK, x, 1.7, 6.6, 0.8, 0.1, 0.1);
      }
      for (const x of [-3.6, 0.4]) {
        a("cylinder", "#636d68", x, 0.55, 9.3, 0.09, 0.9, 0.09);
        a("cylinder", CREAM, x, 1.02, 9.3, 0.8, 0.08, 0.8);
        for (const dx of [-1.1, 1.1]) a("box", "#6f7c78", x + dx, 0.6, 9.3, 0.55, 0.9, 0.55);
      }
      sign(f, "MEET / CONNECT", 0, 5.2, 4.8, 5.6, sight.color);
      for (const x of [-6, 6]) beacon(f, x, 2.4, 9.8, sight.color);
      rotor(f, 3.2, 14.9, -3, "#aab8b6", 0.9);
    } else if (sight.type === "accelerator") {
      a("box", TIMBER, -4, 0.4, 8.2, 6, 0.5, 3);
      a("box", DARK, -4, 2.1, 8, 4.2, 2.6, 0.2);
      sign(f, "DEMO NIGHT", -4, 3.9, 8.1, 4.3, sight.color);
      for (const x of [-6.6, -1.4]) beacon(f, x, 1.1, 9.3, sight.color);
      rotor(f, -3, 6.9, -2.5, "#b2c2ae", 0.8);
    } else if (sight.type === "tower") {
      for (const x of [-7, -3.5, 0]) {
        a("box", "#8a9b8e", x, 0.7, 7.8, 0.16, 1.4, 0.16);
        a("box", "#3b6378", x, 1.6, 7.8, 3, 0.14, 2.8, -0.32);
        for (const dx of [-0.8, 0, 0.8]) a("box", "#91aab3", x + dx, 1.75, 7.8, 0.035, 0.035, 2.7, -0.32);
      }
      rotor(f, 0, 16.8, 0, "#dfe6e4", 1.7); beacon(f, 0, 18.9, 0, "#98c379");
      sign(f, "SIGNAL / ONLINE", 0, 3.5, 6.5, 4.6, sight.color);
    } else if (sight.type === "arcade") {
      for (let i = 0; i < 4; i++) beacon(f, (i - 1.5) * 2.6, 3.2, 5.1, i % 2 ? "#e5c07b" : "#98c379");
      a("box", "#788b90", 7.2, 1.8, 5.5, 1.8, 3.4, 1.6);
      a("box", "#c092a3", 7.2, 2.15, 6.34, 1.3, 1.9, 0.04, 0, 0, 0, "light");
      sign(f, "INSERT COIN", 0, 4.9, 7, 5, sight.color);
      rotor(f, -4.4, 6.8, -2.4, "#9b8ea3", 0.9);
    } else if (sight.type === "showroom") {
      sign(f, "AURUS / SALON", 0, 8.4, -6.6, 7, "#d9c07a");
      sign(f, "BY APPOINTMENT", 6.2, 1.9, 8.2, 3.6, "#d9c07a");
      for (const x of [-3.4, 3.4]) beacon(f, x, 2.3, 6.9, "#f1dc9a");
      for (const x of [-8, 8]) beacon(f, x, 7.4, 9.4, "#d9c07a");
      a("box", "#3b3f47", 6.2, 0.7, 8.2, 2.4, 1.2, 0.9);
    } else if (sight.type === "web3") {
      sign(f, "ADS / ON-CHAIN", 8.6, 7.6, -0.5, 4.6, sight.color);
      sign(f, "NODE 07 / SYNCED", -5.6, 3.3, 7.4, 4.2, sight.color);
      beacon(f, 0, 12.4, 0, "#f0d58a");
      for (const [x, z] of [[-8, -6], [-9.5, 3], [7, -7.5]]) {
        a("cylinder", "#4b4360", x, 3, z, 0.11, 6, 0.11);
        a("box", "#3a2f4f", x, 5.6, z, 0.9, 0.6, 0.3);
        beacon(f, x, 6.3, z, sight.color);
      }
    } else if (sight.type === "salon") {
      const terrace = frame(sight.x + 3.2, sight.z + 8.7, 0, f.base);
      terrace.add("cylinder", "#aebba6", 0, 1.8, 0, 0.08, 3.6, 0.08);
      terrace.add("cone", "#e3e5ea", 0, 3.7, 0, 2.5, 0.8, 2.5, 0, Math.PI / 4);
      terrace.add("cylinder", "#e3e5ea", 0, 1.05, 0, 1.1, 0.14, 1.1);
      for (const x of [-1.7, 1.7]) terrace.add("box", "#8a93b0", x, 0.55, 0, 0.75, 1.1, 0.75);
      sign(f, "THE BEAUTY LAB", 0, 4.9, 7.2, 5.3, sight.color);
      beacon(f, -5.8, 4.6, 4.9, "#a8a2e0");
    } else if (sight.type === "depot") {
      for (let i = 0; i < 3; i++) {
        a("box", TIMBER, 9.5, 0.12 + i * 0.8, -3, 2.6, 0.18, 2.6);
        a("box", i % 2 ? "#7e9a98" : "#b8a183", 9.5, 0.55 + i * 0.8, -3, 2.1, 0.65, 2.1);
      }
      a("box", "#c4a16b", 8, 0.8, 5.5, 1.7, 1.4, 2.2);
      for (const x of [7.1, 8.9]) for (const z of [4.9, 6.2]) a("cylinder", DARK, x, 0.4, z, 0.4, 0.2, 0.4, 0, 0, Math.PI / 2);
      for (const x of [7.4, 8.6]) a("box", "#778981", x, 1.8, 4.3, 0.13, 3.5, 0.13);
      for (const x of [7.4, 8.6]) a("box", "#a5b5a9", x, 0.15, 3.6, 0.18, 0.18, 2);
      beacon(f, 8, 1.7, 5.5, "#e2b66e"); sign(f, "DISPATCH / 24H", -2, 5.2, 8, 6, sight.color);
    }
  }

  if (COTTAGE) {
    const f = frame(COTTAGE.x, COTTAGE.z, COTTAGE.heading), a = f.add;
    const plaster = "#d9cfb8", roofColor = "#7a4f43", skin = "#e8c9ae", hair = "#a98a63";
    a("box", "#5a5f5b", 0, -0.35, 0, 6.4, 1.2, 5.4);
    a("box", plaster, 0, 1.55, 0, 5.4, 2.7, 4.4);
    for (const x of [-2.7, 2.7]) a("box", TIMBER, x, 1.55, 0, 0.18, 2.7, 4.5);
    a("box", TIMBER, 0, 2.95, 0, 5.6, 0.2, 4.6);
    for (const side of [-1, 1]) a("box", roofColor, side * 1.5, 4.1, 0, 3.6, 0.16, 5.2, 0, 0, side * -0.72);
    a("box", "#5a4238", 0, 5.3, 0, 0.3, 0.2, 5.3);
    a("box", "#6b6f6c", 1.6, 4.6, -1.2, 0.7, 2, 0.7);
    steam(f, 1.6, 5.8, -1.2);
    a("box", DARK, 0, 1.05, 2.26, 0.9, 1.9, 0.08);
    a("rock", "#d9c07a", 0.3, 1.05, 2.33, 0.06, 0.06, 0.06, 0, 0, 0, "light");
    for (const x of [-1.7, 1.7]) {
      a("box", "#f2d79a", x, 1.7, 2.26, 0.9, 0.9, 0.06, 0, 0, 0, "light");
      a("box", TIMBER, x, 1.7, 2.3, 0.08, 1, 0.05); a("box", TIMBER, x, 1.7, 2.3, 1, 0.08, 0.05);
    }
    a("box", "#f2d79a", -2.83, 1.7, 0.4, 0.06, 0.8, 0.9, 0, 0, 0, "light");
    a("box", TIMBER, -2.87, 1.7, 0.4, 0.05, 0.9, 0.08); a("box", TIMBER, -2.87, 1.7, 0.4, 0.05, 0.08, 1);
    a("box", TIMBER, 0, 0.3, 3.4, 4.2, 0.14, 2.2);
    for (const x of [-1.9, 1.9]) a("cylinder", TIMBER, x, 0.8, 3.4, 0.08, 1, 0.08);
    a("cylinder", "#565e5c", 2.9, 1.1, 3.9, 0.06, 2.2, 0.06);
    beacon(f, 2.9, 2.3, 3.9, "#f0c979");
    for (let i = 0; i < 3; i++) a("cylinder", "#8a8f86", (i % 2) * 0.5 - 0.25, 0.04, 4.9 + i * 0.75, 0.42, 0.08, 0.34);
    a("box", "#6d5a45", -2.2, 0.55, 3.3, 0.6, 0.5, 0.6);
    a("rock", "#c67a8a", -2.2, 0.95, 3.3, 0.3, 0.25, 0.3);
    a("rock", "#e5c07b", -2, 1.05, 3.15, 0.12, 0.12, 0.12, 0, 0, 0, "light");
    const gx = 0.9, gz = 4.7;
    for (const dx of [-0.13, 0.13]) a("box", "#4a5568", gx + dx, 0.4, gz, 0.2, 0.8, 0.22);
    a("box", "#6f9aa6", gx, 0.72, gz, 0.66, 0.24, 0.42);
    a("box", "#6f9aa6", gx, 1.15, gz, 0.56, 0.7, 0.34);
    for (const dx of [-0.36, 0.36]) a("box", skin, gx + dx, 1.15, gz, 0.14, 0.62, 0.16, 0, 0, dx > 0 ? -0.25 : 0.25);
    a("rock", skin, gx, 1.72, gz, 0.26, 0.28, 0.26);
    a("box", hair, gx, 1.6, gz - 0.17, 0.5, 1, 0.2);
    a("dome", hair, gx, 1.8, gz, 0.29, 0.22, 0.29);
    const cat = (cx, cz, yaw, coat, patch) => {
      const sin = Math.sin(yaw), cos = Math.cos(yaw);
      const part = (shape, color, px, py, pz, sx, sy, sz, rx = 0, rz = 0) => a(shape, color, cx + px * cos - pz * sin, py, cz + px * sin + pz * cos, sx, sy, sz, rx, -yaw, rz);
      part("box", coat, 0, 0.22, 0, 0.28, 0.3, 0.42);
      if (patch) part("box", patch, 0, 0.16, 0.16, 0.2, 0.18, 0.12);
      part("rock", coat, 0, 0.5, 0.18, 0.15, 0.14, 0.15);
      if (patch) part("rock", patch, 0, 0.46, 0.3, 0.08, 0.07, 0.06);
      for (const dx of [-0.08, 0.08]) part("cone", coat, dx, 0.62, 0.18, 0.06, 0.1, 0.06);
      part("box", coat, 0.06, 0.12, -0.22, 0.07, 0.07, 0.12);
      part("box", coat, 0.1, 0.24, -0.36, 0.06, 0.06, 0.42, 0.9, 0);
    };
    const trunk = "#5a4034", blossom = ["#e8a9b8", "#d98ea3", "#f2c4cf", "#e39bb0"];
    a("cylinder", trunk, -6.6, 1.1, 0.8, 0.26, 2.2, 0.26, 0, 0, 0.12);
    a("cylinder", trunk, -7.1, 2.6, 0.9, 0.18, 1.6, 0.18, 0.25, 0, 0.45);
    a("cylinder", trunk, -6.1, 2.7, 0.6, 0.15, 1.5, 0.15, -0.3, 0, -0.5);
    [[-6.6, 3.9, 0.8, 2.3], [-7.9, 3.4, 1.2, 1.6], [-5.3, 3.5, 0.3, 1.5], [-6.9, 4.6, -0.4, 1.4], [-6.1, 3.1, 1.9, 1.2]].forEach(([px, py, pz, size], i) => a("rock", blossom[i % 4], px, py, pz, size, size * 0.75, size, i * 0.7, i * 1.3, 0));
    for (let i = 0; i < 9; i++) a("rock", blossom[i % 4], -6.6 + Math.sin(i * 2.4) * (1.2 + i * 0.22), 0.04, 0.8 + Math.cos(i * 2.4) * (1 + i * 0.2), 0.12, 0.03, 0.12, 0, i, 0);
    const trunkAt = f.point(-6.6, 0, 0.8);
    solid(frame(trunkAt.x, trunkAt.z), 0.5, 5);
    cat(2.1, 5.2, -0.3, "#b3b8c0", "#eceae4");
    cat(-3.6, 4.6, 0.5, "#c98a4b", "#e8c9a0");
    cat(3.9, 5.6, -1.1, "#2e3236", "#e6e6e2");
    solid(f, 3.4, 4);
  }

  return {
    obstacles, parkedCars,
    update(dt, reducedMotion, car) {
      if (!reducedMotion) elapsed += dt;
      for (const animation of animated) {
        const p = animation.object.position;
        animation.object.visible = Math.hypot(car.x - p.x, car.z - p.z) < 165;
        if (animation.object.visible) animation.tick(reducedMotion ? 0 : elapsed, reducedMotion);
      }
    },
  };
}
