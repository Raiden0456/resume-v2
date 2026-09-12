const DARK = "#282e36";

export function buildLandmark(batch, sight) {
  const add = batch.building(sight.x, sight.z);
  const c = sight.color, wall = "#778080", roof = "#3b454d", dark = DARK;
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
