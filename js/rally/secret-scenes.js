import * as THREE from "../vendor/three/three.module.min.js";
import { RIVER, SNOW_LINE, riverAt, terrainHeight } from "./world.js";
import { SECRETS, CABLEWAY } from "./secrets.js";

export function buildSecretScenes({ scene, batch, geometries, animated, frame, solid, sign, beacon, steam, rotor, palette: { TIMBER, DARK } }) {
  const person = (f, px, pz, yaw, { top = "#5c6b5a", legs = "#3a3f4a", hair = "#4a3a2e", long = false, hat = null } = {}) => {
    const sin = Math.sin(yaw), cos = Math.cos(yaw), skin = "#e0c2a6";
    const part = (shape, color, x, y, z, sx, sy, sz, rx = 0, rz = 0, kind = "solid") => f.add(shape, color, px + x * cos - z * sin, y, pz + x * sin + z * cos, sx, sy, sz, rx, -yaw, rz, kind);
    for (const dx of [-0.13, 0.13]) part("box", legs, dx, 0.42, 0, 0.2, 0.84, 0.24);
    part("box", top, 0, 1.22, 0, 0.6, 0.78, 0.34);
    for (const dx of [-0.38, 0.38]) part("box", top, dx, 1.2, 0, 0.15, 0.66, 0.17, 0, dx > 0 ? -0.2 : 0.2);
    part("rock", skin, 0, 1.8, 0, 0.26, 0.28, 0.26);
    part("dome", hair, 0, 1.86, 0, 0.29, 0.2, 0.29);
    if (long) part("box", hair, 0, 1.6, -0.17, 0.5, 1, 0.2);
    if (hat) { part("cylinder", hat, 0, 2.02, 0, 0.5, 0.05, 0.5); part("cylinder", hat, 0, 2.16, 0, 0.3, 0.26, 0.3); }
    return part;
  };
  const pylon = (f, height) => {
    const a = f.add, steel = "#6f6a62";
    for (const x of [-1.2, 1.2]) { a("box", steel, x, height / 2, 0, 0.3, height, 0.3, 0, 0, x * -0.025); a("box", "#7a4a36", x, 1.4, 0, 0.34, 0.6, 0.34); }
    for (let y = 2.5; y < height - 0.5; y += 2.5) { a("box", steel, 0, y, 0, 2.6, 0.16, 0.16); a("box", steel, 0, y - 1.2, 0, 0.12, 0.12, 0.12, 0, 0, 0.8); }
    a("box", steel, 0, height + 0.1, 0, 3.6, 0.25, 0.5);
    if (f.base > SNOW_LINE) a("box", "#e6ebea", 0, height + 0.3, 0, 3.7, 0.16, 0.6);
    for (const x of [-1.4, 1.4]) a("cylinder", "#3a3f44", x, height - 0.35, 0, 0.35, 0.2, 0.35, Math.PI / 2, 0, 0);
  };
  const hangCabin = (x, y, z, color, lit = false) => {
    const cabin = new THREE.Group(); cabin.position.set(x, y, z); cabin.rotation.y = -CABLEWAY.heading;
    const shell = new THREE.Mesh(geometries.box, new THREE.MeshStandardMaterial({ color, roughness: 0.9 })); shell.scale.set(1.6, 1.7, 1.4); shell.position.y = -3.2;
    const roof = new THREE.Mesh(geometries.box, new THREE.MeshStandardMaterial({ color: "#3a3f44" })); roof.scale.set(1.8, 0.16, 1.6); roof.position.y = -2.3;
    const arm = new THREE.Mesh(geometries.box, new THREE.MeshStandardMaterial({ color: "#5a5f63" })); arm.scale.set(0.12, 2.3, 0.12); arm.position.y = -1.15;
    const glass = new THREE.Mesh(geometries.box, new THREE.MeshBasicMaterial({ color: lit ? "#f0d9a0" : "#3a4550" })); glass.scale.set(1.2, 0.7, 1.45); glass.position.y = -3.1;
    cabin.add(shell, roof, arm, glass);
    if (lit) { const glow = new THREE.PointLight("#f0c979", 6, 9, 1.8); glow.position.y = -3.1; cabin.add(glow); }
    scene.add(cabin);
    return cabin;
  };
  const builders = {
  cottage(f) {
    const a = f.add;
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
  },
  grave(f) {
    const a = f.add;
    const stone = "#7d8484", soil = "#3b332c", skin = "#e0c2a6";
    a("box", soil, 0, 0.12, 0, 1.4, 0.3, 2.4);
    a("dome", "#46403a", 0, 0.2, 0.1, 0.6, 0.35, 1.1);
    a("box", stone, 0, 0.75, -1.35, 1.2, 1.3, 0.22);
    a("dome", stone, 0, 1.4, -1.35, 0.6, 0.35, 0.22);
    a("box", "#59615f", 0, 0.9, -1.22, 0.7, 0.45, 0.03);
    for (const dx of [-0.35, 0.35]) a("box", stone, dx, 0.2, -1.35, 0.3, 0.4, 0.3);
    for (let i = 0; i < 4; i++) a("rock", ["#e5c07b", "#e06c75", "#e2dfcd", "#c678dd"][i], -0.3 + i * 0.2, 0.42, -0.9 + (i % 2) * 0.15, 0.1, 0.1, 0.1, 0, i, 0, "light");
    const canYaw = 1.1, cs = Math.sin(canYaw), cc = Math.cos(canYaw), canX = -1.35, canZ = -0.55, canR = 0.24;
    const along = (shape, color, d, py, sx, sy, sz, kind = "solid") => a(shape, color, canX + cs * d, py, canZ + cc * d, sx, sy, sz, Math.PI / 2, canYaw, 0, kind);
    along("cylinder", "#4fc3c7", -0.2, canR, canR, 0.3, canR, "light");
    along("cylinder", "#3b8fd0", 0.06, canR, canR, 0.24, canR, "light");
    along("cylinder", "#2f3fa8", 0.3, canR, canR, 0.26, canR, "light");
    along("cylinder", "#c9d3d6", -0.36, canR, canR * 0.96, 0.03, canR * 0.96);
    along("cylinder", "#1d2126", 0.45, canR, canR * 0.98, 0.06, canR * 0.98);
    along("cylinder", "#c9d3d6", 0.49, canR, canR * 0.9, 0.025, canR * 0.9);
    for (const [d, w, thick] of [[-0.14, 0.3, 0.11], [0.01, 0.3, 0.11], [0.17, 0.22, 0.05]]) a("box", "#1d2126", canX + cs * d, canR * 2 - 0.02, canZ + cc * d, w, 0.05, thick, 0, canYaw, 0);
    a("cylinder", "#565e5c", -1.6, 1.2, -1.2, 0.06, 2.4, 0.06);
    a("box", "#3b4245", -1.6, 2.45, -1.2, 0.36, 0.3, 0.36);
    beacon(f, -1.6, 2.45, -1.2, "#f0c979");
    const glow = new THREE.PointLight("#ffd9a0", 26, 14, 1.6);
    glow.position.copy(f.point(-1.6, 2.4, -1.2)); scene.add(glow);
    animated.push({ object: glow });
    a("cylinder", "#8a8f86", -1.3, 0.35, 0.9, 0.6, 0.7, 0.55);
    const sitYaw = -1.1, sitSin = Math.sin(sitYaw), sitCos = Math.cos(sitYaw), seat = 0.7;
    const sit = (shape, color, x, y, z, sx, sy, sz, rx = 0, rz = 0) => a(shape, color, -1.3 + x * sitCos - z * sitSin, y, 0.9 + x * sitSin + z * sitCos, sx, sy, sz, rx, -sitYaw, rz);
    for (const dx of [-0.14, 0.14]) { sit("box", "#3a3f4a", dx, seat + 0.1, 0.34, 0.2, 0.2, 0.66); sit("box", "#3a3f4a", dx, seat / 2 + 0.02, 0.64, 0.2, seat + 0.04, 0.2); sit("box", "#2b2f33", dx, 0.06, 0.78, 0.22, 0.12, 0.36); }
    sit("box", "#5c6b5a", 0, seat + 0.6, 0.02, 0.6, 0.8, 0.34);
    for (const dx of [-0.38, 0.38]) sit("box", "#5c6b5a", dx, seat + 0.5, 0.2, 0.15, 0.6, 0.17, -0.7, 0);
    sit("rock", skin, 0, seat + 1.2, 0, 0.26, 0.28, 0.26);
    sit("dome", "#4a3a2e", 0, seat + 1.26, 0, 0.29, 0.2, 0.29);
    const dachshund = (px, pz, yaw, coat, tan, sitting) => {
      const sin = Math.sin(yaw), cos = Math.cos(yaw);
      const part = (shape, color, x, y, z, sx, sy, sz, rx = 0, rz = 0) => a(shape, color, px + x * cos - z * sin, y, pz + x * sin + z * cos, sx, sy, sz, rx, -yaw, rz);
      if (sitting) {
        part("box", coat, 0, 0.34, 0.02, 0.26, 0.24, 0.82, -0.5, 0);
        part("box", tan, 0, 0.44, 0.4, 0.2, 0.2, 0.12);
        part("box", coat, 0, 0.66, 0.5, 0.22, 0.2, 0.32);
        part("box", tan, 0, 0.6, 0.74, 0.14, 0.12, 0.24);
        for (const side of [-1, 1]) part("box", coat, side * 0.13, 0.64, 0.48, 0.06, 0.22, 0.14);
        for (const dx of [-0.06, 0.06]) part("rock", tan, dx, 0.74, 0.62, 0.035, 0.02, 0.03);
        for (const dx of [-0.09, 0.09]) part("box", tan, dx, 0.13, 0.4, 0.07, 0.26, 0.08);
        part("box", coat, 0, 0.12, -0.28, 0.3, 0.24, 0.32);
        for (const dx of [-0.13, 0.13]) part("box", tan, dx, 0.05, -0.1, 0.07, 0.1, 0.16);
        part("box", coat, 0.12, 0.05, -0.5, 0.05, 0.05, 0.3, 0, 0.9);
      } else {
        part("box", coat, 0, 0.3, 0, 0.26, 0.24, 0.85);
        part("box", coat, 0, 0.42, 0.5, 0.22, 0.2, 0.32);
        part("box", tan, 0, 0.36, 0.76, 0.14, 0.12, 0.26);
        for (const side of [-1, 1]) part("box", tan, side * 0.13, 0.4, 0.5, 0.06, 0.2, 0.14);
        for (const px2 of [-0.09, 0.09]) for (const pz2 of [-0.32, 0.3]) part("box", coat, px2, 0.09, pz2, 0.07, 0.18, 0.08);
        part("box", coat, 0, 0.42, -0.5, 0.05, 0.05, 0.3, -0.7, 0);
      }
    };
    dachshund(0.5, 2.1, -0.4, "#6b3f26", "#4a2a18", false);
    dachshund(-2.7, 2.2, -0.9, "#1d1f22", "#a8723a", true);
    a("box", "#c9a26f", -0.4, 0.75, 1.75, 0.025, 0.025, 1.2, 0.5, 0.75, 0);
    const marker = f.point(0, 0, -1.35);
    solid(frame(marker.x, marker.z), 0.7, 1.6);
  },
  cablecar(f) {
    const a = f.add, rust = "#7a4a36";
    const top = CABLEWAY.pylons[CABLEWAY.summitIndex], next = CABLEWAY.pylons[CABLEWAY.summitIndex + 1];
    pylon(f, top.height);
    a("box", rust, 4.2, 0.4, -1.5, 1.2, 0.8, 0.9); a("cylinder", "#3a3f44", 5.1, 0.45, -1.1, 0.45, 0.3, 0.45, Math.PI / 2, 0.4, 0);
    a("rock", "#e6ebea", 2.4, 0.3, 3.4, 1, 0.5, 1); a("rock", "#dfe6e4", -3, 0.25, 2.2, 0.8, 0.4, 0.8);
    const hang = 3.4, span = Math.hypot(next.x - top.x, next.z - top.z), t = hang / span;
    const cabin = hangCabin(top.x + (next.x - top.x) * t - Math.cos(CABLEWAY.heading) * 1.4, (top.y + top.height) * (1 - t) + (next.y + next.height) * t, top.z + (next.z - top.z) * t - Math.sin(CABLEWAY.heading) * 1.4, "#8a4b3c", true);
    animated.push({ object: cabin, tick(time, still) { cabin.rotation.z = still ? 0 : Math.sin(time * 0.9) * 0.16; cabin.rotation.x = still ? 0 : Math.sin(time * 0.6) * 0.05; } });
    solid(f, 1.6, top.height);
  },
  snowman(f) {
    const a = f.add, snow = "#eef1f0", red = "#dd735f";
    a("rock", snow, 0, 0.75, 0, 0.95, 0.8, 0.95, 0.2, 0.4, 0); a("rock", snow, 0, 1.85, 0, 0.72, 0.65, 0.72, 0.5, 1.2, 0); a("rock", snow, 0, 2.7, 0, 0.5, 0.48, 0.5, 0.1, 2, 0);
    a("cone", "#e0955a", 0, 2.72, 0.75, 0.09, 0.55, 0.09, Math.PI / 2, 0, 0);
    for (const dx of [-0.16, 0.16]) a("rock", "#1d2126", dx, 2.88, 0.45, 0.06, 0.06, 0.06);
    for (const i of [0, 1, 2]) a("rock", "#1d2126", 0, 1.6 + i * 0.28, 0.7 - i * 0.02, 0.06, 0.06, 0.06);
    a("box", red, 0, 2.3, 0, 1.2, 0.26, 1.2); a("box", red, 0.35, 1.75, 0.6, 0.26, 0.9, 0.08, 0.1, 0, 0.15);
    for (const side of [-1, 1]) a("box", "#5a4034", side * 1.05, 2.1, 0, 1.2, 0.07, 0.07, 0, 0, side * 0.45);
    a("cylinder", "#3a3f44", 0, 3.1, 0, 0.32, 0.5, 0.32); a("cylinder", "#3a3f44", 0, 2.9, 0, 0.5, 0.06, 0.5);
    a("box", "#61afef", 2, 0.06, 0.6, 0.14, 0.05, 1.7, 0, 0.3, 0); a("box", "#61afef", 2.3, 0.06, -0.9, 0.14, 0.05, 1.6, 0, 0.3, 0);
    a("box", "#61afef", 1.1, 0.2, 1.9, 0.14, 0.05, 0.9, 0.5, -0.4, 0);
    for (const x of [-1.6, -1.3]) a("cylinder", "#8a8f86", x, 0.7, -0.8, 0.03, 1.4, 0.03, 0, 0, x * 0.3);
    solid(f, 0.9, 3);
  },
  weather(f) {
    const a = f.add, steel = "#b7bfb2";
    a("cylinder", steel, 0, 4, 0, 0.1, 8, 0.1);
    for (const y of [2.6, 5.2]) a("box", steel, 0, y, 0, 0.5, 0.08, 0.5);
    for (const angle of [0.6, 2.7, 4.8]) a("box", "#7f8782", Math.sin(angle) * 1.6, 3.9, Math.cos(angle) * 1.6, 0.03, 8, 0.03, Math.cos(angle) * -0.4, 0, Math.sin(angle) * 0.4);
    rotor(f, 0, 8.3, 0, "#dfe6e4", 1.1); beacon(f, 0, 8.7, 0, "#e06c75");
    a("box", steel, 0.9, 7, 0, 1.4, 0.06, 0.06); a("box", "#e06c75", 1.6, 7, 0, 0.35, 0.3, 0.06); a("cone", steel, 0.2, 7, 0, 0.14, 0.4, 0.14, 0, 0, -Math.PI / 2);
    a("box", "#6d7a80", -2.4, 0.9, 0.6, 1.7, 1.8, 1.5); a("box", "#3a3f44", -2.4, 1.9, 0.6, 1.9, 0.12, 1.7); a("box", DARK, -2.4, 0.8, 1.36, 0.6, 1.4, 0.06);
    a("box", "#2b3a58", 2.4, 1.2, -0.4, 2, 0.08, 1.4, -0.6, 0, 0); a("box", "#4c6b9c", 2.4, 1.22, -0.4, 1.8, 0.04, 1.2, -0.6, 0, 0, "light");
    for (const x of [1.7, 3.1]) a("box", steel, x, 0.5, -0.4, 0.08, 1, 0.08);
    a("box", "#dfe6e4", -3.9, 0.7, 0.4, 0.6, 0.6, 0.6); a("cylinder", "#8a8f86", -3.9, 1.2, 0.4, 0.05, 0.5, 0.05);
    sign(f, "WX-07 / ONLINE", -2.4, 2.6, 0.7, 3.4, "#98c379");
    solid(frame(f.point(-2.4, 0, 0.6).x, f.point(-2.4, 0, 0.6).z), 1.1, 2); solid(f, 0.4, 8);
  },
  wreck(f) {
    const a = f.add, paint = "#5b7d8a", rust = "#6b4a35";
    const roll = 1.8, rc = Math.cos(roll), rs = Math.sin(roll), pivot = 1.3;
    const rolled = (shape, color, x, y, z, sx, sy, sz, extra = 0) => a(shape, color, x * rc - (y - pivot) * rs, pivot + x * rs + (y - pivot) * rc, z, sx, sy, sz, 0, 0, roll + extra);
    rolled("box", "#1d2126", 0, 0.5, 0, 2.6, 0.5, 5.2);
    rolled("box", paint, 0, 1, 0, 2.7, 0.75, 5.3); rolled("box", rust, 0.9, 1.05, 1.5, 1, 0.78, 1.4);
    rolled("box", "#243038", 0, 1.75, 0.3, 2.3, 0.85, 2.6); rolled("box", paint, 0, 2.25, 0.3, 2.2, 0.16, 2.3);
    rolled("box", "#e2dfcd", 0.7, 1.4, 0, 0.36, 0.05, 5.2); rolled("box", "#dd735f", -0.7, 1.4, 0, 0.36, 0.05, 5.2);
    for (const x of [-1.4, 1.4]) for (const z of [-1.7, 1.7]) { rolled("cylinder", "#19242a", x, 0.6, z, 0.58, 0.44, 0.58, Math.PI / 2); rolled("cylinder", "#8a8f86", x * 1.17, 0.6, z, 0.32, 0.04, 0.32, Math.PI / 2); }
    rolled("box", "#f3f2ee", 0.85, 1.1, -2.7, 0.55, 0.3, 0.06); rolled("box", "#e06c75", -0.85, 1.1, 2.7, 0.55, 0.22, 0.06);
    a("box", "#3a3f44", 0.9, 0.7, -2.7, 0.9, 0.5, 0.3); a("rock", "#2b2f33", -1.9, 0.25, 2.4, 0.5, 0.3, 0.4); a("rock", paint, 2.4, 0.15, -1.2, 0.5, 0.15, 0.7);
    for (let i = 0; i < 6; i++) a("box", "#20262a", -3 - i * 1.5, 0.02, 3.2 + i * 1.1, 0.22, 0.02, 2.2, 0, 0.6, 0);
    steam(f, -0.6, 1.4, 1.6);
    sign(f, "03", -0.9, 2.55, 0.3, 0.9, "#dd735f");
    solid(f, 2.4, 1.8);
  },
  campfire(f) {
    const a = f.add;
    for (const [x, z, size, yaw] of [[-3.6, -1.2, 2.8, 0.4], [3.4, -1.6, 2.6, 1.3], [-1.2, -3.8, 2.4, 2.1], [2, -3.9, 2.2, 0.8]]) a("rock", "#4d5a58", x, size * 0.45, z, size * 1.2, size, size, 0.2, yaw, 0.1);
    a("rock", "#556361", 0, 3.6, -2.4, 4.6, 1.2, 3.6, 0.1, 0.3, 0.05);
    for (const yaw of [0.3, 1.4, 2.5]) a("cylinder", "#5a4034", 0, 0.16, 0, 0.13, 1.5, 0.13, Math.PI / 2, yaw, 0);
    for (const yaw of [0.5, 1.9]) a("cylinder", "#4a3a2e", 0, 0.32, 0, 0.11, 1.2, 0.11, Math.PI / 2, yaw, 0.6);
    a("cone", "#e5c07b", 0, 0.75, 0, 0.42, 0.9, 0.42, 0, 0, 0, "light"); a("cone", "#dd735f", 0.1, 0.65, 0.05, 0.55, 0.75, 0.55, 0, 0.7, 0, "light");
    const fire = new THREE.PointLight("#ffb060", 14, 12, 1.7); fire.position.copy(f.point(0, 1.1, 0)); scene.add(fire);
    animated.push({ object: fire, tick(time, still) { fire.intensity = still ? 12 : 11 + Math.sin(time * 9) * 2 + Math.sin(time * 23) * 1.2; } });
    steam(f, 0, 1.4, 0);
    a("cylinder", "#7f8782", 0.95, 0.9, 0.9, 0.04, 1.8, 0.04, 0, 0, -0.35); a("cylinder", "#7f8782", -0.95, 0.9, 0.9, 0.04, 1.8, 0.04, 0, 0, 0.35); a("cylinder", "#3a3f44", 0, 0.95, 0.9, 0.3, 0.3, 0.3);
    a("box", "#6d5a45", 2.4, 0.15, 1.6, 2, 0.3, 0.9, 0, 0.3, 0); a("box", "#8a6a4a", 2.6, 0.32, 1.7, 0.6, 0.18, 0.7);
    a("cylinder", "#5a4034", -2.4, 0.3, 1.4, 0.55, 0.6, 0.55);
    for (let i = 0; i < 5; i++) a("cylinder", "#3a3f44", Math.sin(i * 1.3) * 1.1, 0.06, Math.cos(i * 1.3) * 1.1, 0.16, 0.12, 0.16);
    solid(frame(f.point(-3.6, 0, -1.2).x, f.point(-3.6, 0, -1.2).z), 1.6, 3); solid(frame(f.point(3.4, 0, -1.6).x, f.point(3.4, 0, -1.6).z), 1.5, 3);
  },
  lookout(f) {
    const gx = terrainHeight(f.x + 14, f.z) - terrainHeight(f.x - 14, f.z), gz = terrainHeight(f.x, f.z + 14) - terrainHeight(f.x, f.z - 14);
    f = frame(f.x, f.z, Math.atan2(-gx, gz));
    const a = f.add;
    a("box", TIMBER, 0, 0.55, 0, 6.2, 0.18, 4.2);
    for (let i = -2; i <= 2; i++) a("box", "#7d6a4e", i * 1.2, 0.66, 0, 0.06, 0.02, 4.2);
    for (const [x, z] of [[-3, -2], [3, -2], [-3, 2], [3, 2], [0, -2]]) { a("box", "#63726e", x, 0.25, z, 0.3, 0.5, 0.3); a("box", TIMBER, x, 1.15, z, 0.14, 1.2, 0.14); }
    for (const x of [-3, 3]) a("box", TIMBER, x, 1.55, 0, 0.1, 0.1, 4.2);
    a("box", TIMBER, 0, 1.55, -2, 6.2, 0.1, 0.1); a("box", TIMBER, 0, 1.1, -2, 6.2, 0.06, 0.06);
    a("cylinder", "#565e5c", 1.4, 1.25, -1.4, 0.07, 1.3, 0.07); a("box", "#3a3f44", 1.4, 1.95, -1.4, 0.36, 0.22, 0.26); for (const dx of [-0.11, 0.11]) a("cylinder", "#3a3f44", 1.4 + dx, 1.95, -1.6, 0.08, 0.3, 0.08, Math.PI / 2, 0, 0);
    a("box", TIMBER, -1.6, 1.05, 0.9, 2.2, 0.1, 0.5); for (const x of [-2.5, -0.7]) a("box", "#63726e", x, 0.85, 0.9, 0.12, 0.4, 0.4);
    a("cylinder", "#565e5c", 2.8, 1.5, 1.6, 0.06, 1.9, 0.06); beacon(f, 2.8, 2.5, 1.6, "#f0c979");
    sign(f, `LOOKOUT / ${Math.round(f.base)} M`, -1.8, 2.3, -2, 3.6, "#dfae5a");
    for (const x of [-3, 3]) solid(frame(f.point(x, 0, 0).x, f.point(x, 0, 0).z), 0.4, 1.5);
  },
  swing(f) {
    const a = f.add;
    for (const x of [-2.2, 2.2]) { a("cylinder", "#62574a", x, 3.6, -0.5, 0.32, 7.2, 0.32); a("cone", "#465f52", x, 7.6, -0.5, 2.6, 4, 2.6); a("cone", "#597363", x, 9.2, -0.5, 1.8, 3, 1.8); }
    a("cylinder", "#62574a", 0, 6.4, -0.5, 0.16, 4.8, 0.16, 0, 0, Math.PI / 2);
    const rig = new THREE.Group(); rig.position.copy(f.point(0, 6.3, -0.5));
    const ropeMaterial = new THREE.MeshStandardMaterial({ color: "#c9b58a", roughness: 1 });
    for (const x of [-0.45, 0.45]) { const rope = new THREE.Mesh(geometries.box, ropeMaterial); rope.scale.set(0.05, 4.6, 0.05); rope.position.set(x, -2.3, 0); rig.add(rope); }
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.16, 8, 20), new THREE.MeshStandardMaterial({ color: "#20292e", roughness: 0.95 })); tyre.position.y = -4.9; rig.add(tyre);
    scene.add(rig); animated.push({ object: rig, tick(time, still) { rig.rotation.x = still ? 0.1 : Math.sin(time * 1.1) * 0.42; } });
    for (let i = 0; i < 4; i++) a("rock", "#4f7047", -1.5 + i * 1.1, 0.3, 1.6 + Math.sin(i) * 0.6, 0.7, 0.45, 0.7, 0, i, 0);
    for (const x of [-2.2, 2.2]) solid(frame(f.point(x, 0, -0.5).x, f.point(x, 0, -0.5).z), 0.55, 8);
  },
  owl(f) {
    const a = f.add, bark = "#6d655b";
    a("cylinder", bark, 0, 3, 0, 0.42, 6, 0.36, 0, 0, 0.04);
    for (const [y, yaw, tilt] of [[3.4, 0.4, 0.9], [4.6, 2.4, 0.8], [5.3, 4.2, 1]]) a("box", bark, Math.sin(yaw) * 0.9, y, Math.cos(yaw) * 0.9, 0.14, 0.14, 2.2, tilt, yaw, 0);
    a("torus", "#5a4034", 0, 6.05, 0, 0.6, 0.6, 1.4, Math.PI / 2, 0, 0); a("cylinder", "#4a3a2e", 0, 5.98, 0, 0.5, 0.1, 0.5);
    a("rock", "#6b5b4a", 0, 6.45, 0, 0.36, 0.42, 0.34); a("rock", "#7a6a58", 0, 6.95, 0.05, 0.3, 0.28, 0.3);
    for (const dx of [-0.14, 0.14]) a("cone", "#6b5b4a", dx, 7.22, 0, 0.07, 0.2, 0.07);
    a("rock", "#c9c2a8", 0, 6.4, 0.3, 0.16, 0.24, 0.1); a("cone", "#e0955a", 0, 6.88, 0.32, 0.05, 0.12, 0.05, Math.PI / 2, 0, 0);
    for (const dx of [-0.1, 0.1]) beacon(f, dx, 6.98, 0.29, "#e5c07b");
    for (let i = 0; i < 7; i++) a("rock", i % 2 ? "#a8763c" : "#c48a5a", Math.sin(i * 2.1) * 1.6, 0.03, Math.cos(i * 2.1) * 1.4, 0.16, 0.03, 0.12, 0, i, 0);
    solid(f, 0.7, 6);
  },
  forager(f) {
    const a = f.add;
    a("cylinder", "#5a4034", -1.6, 0.4, 0.4, 0.6, 0.8, 0.6); a("cylinder", "#a08a60", -1.6, 0.82, 0.4, 0.5, 0.04, 0.5);
    const part = person(f, 0.4, 0.6, 0.6, { top: "#7a6a4a", legs: "#4a4a3a", hat: "#8a7a5a" });
    part("box", "#c9a26f", 0.55, 0.85, 0.2, 0.5, 0.35, 0.36); part("torus", "#c9a26f", 0.55, 1.1, 0.2, 0.25, 0.25, 1);
    for (const [x, z, color, size] of [[-2.6, 1.6, "#e06c75", 0.3], [-3.1, 0.6, "#e06c75", 0.22], [1.9, 1.9, "#d19a66", 0.26], [2.6, 0.9, "#e06c75", 0.34], [-0.6, 2.4, "#c678dd", 0.3]]) {
      a("cylinder", "#e8e2cd", x, size * 0.6, z, size * 0.35, size * 1.2, size * 0.35);
      a("dome", color, x, size * 1.1, z, size * 1.2, size * 0.7, size * 1.2, 0, 0, 0, color === "#c678dd" ? "light" : "solid");
      if (color === "#e06c75") for (const [dx, dz] of [[-0.3, 0.2], [0.3, -0.1], [0.05, 0.5]]) a("rock", "#f3f2ee", x + dx * size * 1.5, size * 1.6, z + dz * size * 1.5, 0.05, 0.03, 0.05);
    }
    for (let i = 0; i < 3; i++) a("rock", "#4f7047", 1.4 - i * 1.7, 0.25, -1.6, 0.7, 0.4, 0.6, 0, i, 0);
    solid(frame(f.point(-1.6, 0, 0.4).x, f.point(-1.6, 0, 0.4).z), 0.7, 1);
  },
  beehives(f) {
    const a = f.add;
    a("box", TIMBER, 0, 0.42, 0, 5, 0.14, 1.4); for (const x of [-2.2, 2.2]) a("box", "#63726e", x, 0.2, 0, 0.16, 0.4, 1.1);
    [["#e5c07b", -1.7], ["#61afef", 0], ["#98c379", 1.7]].forEach(([lid, x], i) => {
      for (let level = 0; level < 3; level++) a("box", level % 2 ? "#d8d2c0" : "#e8e2cd", x, 0.75 + level * 0.5, 0, 1.15, 0.46, 1.05);
      a("box", lid, x, 2.3, 0, 1.3, 0.18, 1.2); a("box", DARK, x, 0.62, 0.54, 0.6, 0.08, 0.04);
      a("box", "#c9b58a", x, 0.55, 0.62, 0.9, 0.04, 0.2);
    });
    const swarm = new THREE.Group(); swarm.position.copy(f.point(0, 2.6, 0.4));
    const bees = Array.from({ length: 9 }, (_, i) => { const bee = new THREE.Mesh(geometries.puff, new THREE.MeshBasicMaterial({ color: i % 3 ? "#e5c07b" : "#1d2126" })); bee.scale.setScalar(0.07); swarm.add(bee); return bee; });
    scene.add(swarm); animated.push({ object: swarm, tick(time, still) { bees.forEach((bee, i) => { const t = (still ? 0 : time) * (0.9 + i * 0.13) + i; bee.position.set(Math.sin(t) * (1.4 + (i % 3) * 0.6) + Math.sin(t * 3.1) * 0.2, Math.sin(t * 1.7) * 0.5 - (i % 2) * 0.4, Math.cos(t) * (1 + (i % 4) * 0.4)); }); } });
    for (let i = 0; i < 8; i++) a("rock", ["#e5c07b", "#e06c75", "#e2dfcd", "#c678dd"][i % 4], -3.5 + i * 1, 0.2, 1.9 + Math.sin(i * 1.7) * 0.6, 0.12, 0.12, 0.12, 0, 0, 0, "light");
    a("box", "#e8e2cd", 3.6, 0.7, -0.8, 0.5, 1.4, 0.5); a("dome", "#e8e2cd", 3.6, 1.4, -0.8, 0.3, 0.25, 0.3);
    solid(f, 2.6, 2.5);
  },
  fisherman(f) {
    const a = f.add, river = riverAt(f.x, f.z), [rx, rz] = RIVER[river.index];
    const dx = rx - f.x, dz = rz - f.z, length = Math.hypot(dx, dz) || 1, sin = Math.sin(f.heading), cos = Math.cos(f.heading);
    const ux = (dx * cos + dz * sin) / length, uz = (-dx * sin + dz * cos) / length, yaw = Math.atan2(-ux, uz);
    const reach = river.distance - river.width + 3.5, deck = 0.55;
    for (let d = 0; d <= reach; d += 1.2) a("box", TIMBER, ux * d, deck, uz * d, 1.6, 0.12, 1.15, 0, -yaw, 0);
    for (const side of [-0.6, 0.6]) a("box", "#7d6a4e", ux * reach / 2 - uz * side, deck - 0.14, uz * reach / 2 + ux * side, 0.18, 0.16, reach + 1.2, 0, -yaw, 0);
    for (let d = 0.6; d <= reach + 0.3; d += 2.4) for (const side of [-0.65, 0.65]) {
      const px = ux * d - uz * side, pz = uz * d + ux * side, foot = f.point(px, 0, pz);
      const ground = terrainHeight(foot.x, foot.z) - f.base - 0.5, height = deck - 0.1 - ground;
      a("box", "#63726e", px, ground + height / 2, pz, 0.18, height, 0.18);
    }
    const part = person(f, ux * (reach - 1.2), uz * (reach - 1.2), yaw, { top: "#5b7d8a", legs: "#4a4a3a", hat: "#6d5a45" });
    part("cylinder", "#8a8f86", 0.45, 1.6, 0.4, 0.025, 2.4, 0.025, 0.9, 0);
    part("cylinder", "#c9a26f", -0.7, 0.85, -0.2, 0.28, 0.5, 0.28); part("torus", "#8a8f86", -0.7, 1.15, -0.2, 0.2, 0.2, 1);
    const bobber = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: "#e06c75" }));
    const drop = f.point(ux * (reach + 2.4), 0, uz * (reach + 2.4)); bobber.position.set(drop.x, river.y + 0.08, drop.z); scene.add(bobber);
    animated.push({ object: bobber, tick(time, still) { bobber.position.y = river.y + 0.08 + (still ? 0 : Math.sin(time * 2.2) * 0.06); } });
    solid(f, 0.8, 1.2);
  },
  tractor(f) {
    const a = f.add, paint = "#8a4a3a", rust = "#6b4a35", iron = "#3a3f44";
    a("box", iron, 0, 0.75, 0, 1.4, 0.5, 4);
    a("box", paint, 0, 1.25, 1.2, 1.4, 0.8, 1.9); a("box", rust, 0.5, 1.3, 1.6, 0.6, 0.5, 0.9); a("cylinder", "#dfe6e4", 0.4, 1.7, 0.6, 0.13, 1.8, 0.13);
    a("box", paint, 0, 1.15, -0.9, 1.5, 0.6, 1.4); a("box", iron, 0, 1.7, -1.1, 0.7, 0.6, 0.7); a("box", "#5a4034", 0, 1.9, -0.7, 0.6, 0.16, 0.5);
    for (const [x, z] of [[-0.7, -1.7], [0.7, -1.7], [-0.7, 0.2], [0.7, 0.2]]) a("box", iron, x, 2.3, z, 0.1, 1.6, 0.1); a("box", rust, 0, 3.15, -0.75, 1.7, 0.1, 2.3);
    a("cylinder", iron, 0, 1.55, -0.2, 0.32, 0.05, 0.32, Math.PI / 2 - 0.5, 0, 0);
    for (const x of [-1, 1]) { a("cylinder", "#20292e", x, 1.05, -1.5, 1.05, 0.55, 1.05, 0, 0, Math.PI / 2); a("cylinder", "#c48a5a", x * 1.2, 1.05, -1.5, 0.5, 0.06, 0.5, 0, 0, Math.PI / 2); }
    for (const x of [-0.85, 0.85]) { a("cylinder", "#20292e", x, 0.6, 1.5, 0.6, 0.4, 0.6, 0, 0, Math.PI / 2); a("cylinder", "#c48a5a", x * 1.25, 0.6, 1.5, 0.28, 0.05, 0.28, 0, 0, Math.PI / 2); }
    for (const [x, z, yaw] of [[3.6, -1.2, 0.3], [4.2, 1.4, 1.1], [3.2, 3.2, 2]]) { a("cylinder", "#c9a86a", x, 0.75, z, 0.75, 1.4, 0.75, Math.PI / 2, yaw, 0); a("box", "#a8874a", x, 0.75, z, 1.55, 0.06, 0.3, 0, yaw, 0); }
    for (const [x, z, yaw] of [[-2.4, 1.8, 0.4], [-3.1, 0.6, 2.2], [-1.9, 3.1, 1.3]]) {
      a("rock", "#f3f2ee", x, 0.28, z, 0.34, 0.3, 0.42, 0, yaw, 0); a("rock", "#f3f2ee", x + Math.sin(yaw) * 0.25, 0.5, z + Math.cos(yaw) * 0.25, 0.18, 0.18, 0.18);
      a("box", "#e06c75", x + Math.sin(yaw) * 0.25, 0.64, z + Math.cos(yaw) * 0.25, 0.05, 0.1, 0.12, 0, -yaw, 0); a("cone", "#e0955a", x + Math.sin(yaw) * 0.42, 0.5, z + Math.cos(yaw) * 0.42, 0.04, 0.12, 0.04, Math.PI / 2, -yaw, 0);
    }
    for (let i = 0; i < 4; i++) a("box", TIMBER, -4.2, 0.6, -2.5 + i * 1.5, 0.14, 1.2, 0.14); for (const y of [0.5, 1]) a("box", TIMBER, -4.2, y, -0.25, 0.06, 0.1, 5);
    solid(f, 2.2, 3.2);
  },
  };
  for (const secret of SECRETS) builders[secret.id]?.(frame(secret.x, secret.z, secret.heading));
  if (CABLEWAY) {
    const { pylons, heading } = CABLEWAY, nx = -Math.cos(heading), nz = -Math.sin(heading);
    pylons.forEach((tower, i) => {
      if (i === CABLEWAY.summitIndex) return;
      const f = frame(tower.x, tower.z, heading);
      pylon(f, tower.height);
      solid(f, 1.6, tower.height);
      if (i === pylons.length - 1) {
        f.add("box", "#63726e", 0, 0.5, 0, 7, 1, 5); f.add("box", TIMBER, 0, 1.08, 0, 7.2, 0.16, 5.2);
        for (const x of [-3.2, 3.2]) for (const z of [-2.2, 2.2]) f.add("box", "#6f6a62", x, 3, z, 0.2, 4, 0.2);
        f.add("box", "#3a3f44", 0, 5.1, 0, 8, 0.2, 6); f.add("box", "#7a4a36", 0, 5.3, 0, 8.2, 0.14, 6.2);
        f.add("box", DARK, 0, 1.9, 2.55, 2.4, 1.5, 0.1);
        sign(f, "VALLEY STATION / CLOSED", 0, 4.2, 3.1, 5.6, "#dfae5a");
      }
    });
    let travelled = 0;
    for (let i = 1; i < pylons.length; i++) {
      const a = pylons[i - 1], b = pylons[i], dx = b.x - a.x, dz = b.z - a.z, dy = (b.y + b.height) - (a.y + a.height);
      const length = Math.hypot(dx, dy, dz), ry = Math.atan2(dx, dz), rx = -Math.asin(dy / length);
      for (const side of [-1.4, 1.4]) batch.absolute("box", "#2b2f33", (a.x + b.x) / 2 + nx * side, a.y + a.height + 0.05 + dy / 2, (a.z + b.z) / 2 + nz * side, 0.07, 0.07, length, rx, ry, 0);
      const span = Math.hypot(dx, dz);
      for (let d = 90 - travelled % 90; d < span - 12; d += 90) {
        const t = d / span, summit = pylons[CABLEWAY.summitIndex];
        if (Math.hypot(a.x + dx * t - summit.x, a.z + dz * t - summit.z) < 25) continue;
        const order = Math.floor((travelled + d) / 90), side = order % 2 ? 1.4 : -1.4;
        hangCabin(a.x + dx * t + nx * side, a.y + a.height + dy * t, a.z + dz * t + nz * side, ["#8a4b3c", "#5b7d8a", "#dfae5a"][order % 3]);
      }
      travelled += span;
    }
  }
}
