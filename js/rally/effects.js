import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Group, IcosahedronGeometry, Mesh, MeshBasicMaterial, PointLight, Points, PointsMaterial, RingGeometry, Vector3 } from "../vendor/three/three.module.min.js";

export function createCrashEffect(scene) {
  const group = new Group();
  group.visible = false;
  scene.add(group);
  const geometry = new IcosahedronGeometry(1, 0);
  const smoke = new MeshBasicMaterial({ color: "#646762", transparent: true, depthWrite: false });
  const sparks = new MeshBasicMaterial({ color: "#ffc676", transparent: true, depthWrite: false });
  const core = new Mesh(geometry, new MeshBasicMaterial({ color: "#ee935a", transparent: true, depthWrite: false }));
  const light = new PointLight("#ffad65", 0, 28, 2);
  group.add(core, light);
  const particles = Array.from({ length: 28 }, (_, i) => {
    const mesh = new Mesh(geometry, i < 16 ? smoke : sparks);
    group.add(mesh);
    return { mesh, velocity: new Vector3(), smoke: i < 16 };
  });
  let age = 0, still = false;
  return {
    explode(car, reducedMotion) {
      age = 0; still = reducedMotion;
      group.position.set(car.x, car.y + 1, car.z);
      group.visible = true;
      for (const particle of particles) {
        const angle = Math.random() * Math.PI * 2, speed = particle.smoke ? 4 + Math.random() * 5 : 10 + Math.random() * 7;
        particle.velocity.set(Math.cos(angle) * speed, 2 + Math.random() * 7, Math.sin(angle) * speed);
        particle.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      }
      this.update(0);
    },
    update(dt) {
      if (!group.visible) return;
      age += dt;
      const t = Math.min(age / 0.8, 1), motion = still ? 0.3 : age;
      smoke.opacity = 0.8 * (1 - t);
      sparks.opacity = still ? 0 : 1 - t;
      core.visible = !still && t < 0.45;
      core.scale.setScalar(1 + t * 9);
      core.material.opacity = Math.max(0, 1 - t / 0.45);
      light.intensity = still ? 0 : 45 * Math.max(0, 1 - t * 2);
      for (const particle of particles) {
        particle.mesh.position.copy(particle.velocity).multiplyScalar(motion);
        particle.mesh.position.y -= (particle.smoke ? -1 : 9) * motion * motion;
        particle.mesh.scale.setScalar(particle.smoke ? 0.6 + motion * 2.5 : 0.18 * (1 - t));
      }
      if (t === 1) group.visible = false;
    },
    clear() { group.visible = false; },
  };
}

export function createSplashEffect(scene) {
  const group = new Group(), geometry = new IcosahedronGeometry(1, 0);
  const material = new MeshBasicMaterial({ color: "#b5e4e4", transparent: true, depthWrite: false });
  const droplets = Array.from({ length: 24 }, (_, i) => {
    const mesh = new Mesh(geometry, material), angle = i * Math.PI * 2 / 24;
    group.add(mesh);
    return { mesh, angle, speed: 3 + (i % 5), lift: 5 + (i % 4) * 1.4 };
  });
  const rings = [0, 1, 2].map(() => {
    const mesh = new Mesh(new RingGeometry(0.91, 1, 48), material);
    mesh.rotation.x = -Math.PI / 2; group.add(mesh); return mesh;
  });
  group.visible = false; scene.add(group);
  let age = 0, still = false;
  return {
    splash(car, waterHeight, reducedMotion) {
      age = 0; still = reducedMotion;
      group.position.set(car.x, waterHeight + 0.18, car.z);
      group.visible = true; this.update(0);
    },
    update(dt) {
      if (!group.visible) return;
      age += dt;
      const t = Math.min(age / 0.85, 1), motion = still ? 0.22 : age;
      material.opacity = (1 - t) * 0.85;
      droplets.forEach(({ mesh, angle, speed, lift }, i) => {
        mesh.position.set(Math.cos(angle) * (0.7 + motion * speed), Math.max(0, motion * lift - 8 * motion * motion), Math.sin(angle) * (0.7 + motion * speed));
        mesh.scale.set(0.16 + i % 3 * 0.035, 0.3 + i % 3 * 0.07, 0.16);
      });
      rings.forEach((ring, i) => { ring.scale.setScalar(1.1 + motion * (5 + i * 2)); ring.position.y = i * 0.035; });
      if (t === 1) group.visible = false;
    },
    clear() { group.visible = false; },
  };
}

export function createFireworks(scene) {
  const count = 240, positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  const points = new Points(geometry, new PointsMaterial({ size: 4, transparent: true, vertexColors: true, blending: AdditiveBlending, depthWrite: false }));
  points.frustumCulled = false; points.visible = false; scene.add(points);
  const palette = ["#e5c07b", "#98c379", "#61afef", "#dd735f"].map(color => new Color(color));
  let age = 0, still = false;
  return {
    get active() { return points.visible; },
    launch(line, reducedMotion) {
      age = 0; still = reducedMotion;
      points.position.set(line.x, line.elevation, line.z);
      points.visible = true; this.update(0);
    },
    update(dt) {
      if (!points.visible) return;
      age += dt;
      for (let i = 0; i < count; i++) {
        const burst = Math.floor(i / 60), delay = burst * 0.65, life = age - delay;
        const t = still ? 0.4 : Math.max(0, life), visible = still ? age < 2 : life > 0 && life < 1.8;
        const phi = i * 2.39996, elevation = Math.acos(1 - 2 * ((i % 60 + 0.5) / 60));
        const radius = t * (8 + (i % 4) * 1.1);
        positions[i * 3] = (burst % 2 ? 13 : -13) + Math.cos(phi) * Math.sin(elevation) * radius;
        positions[i * 3 + 1] = 17 + (burst % 2) * 5 + Math.cos(elevation) * radius - t * t * 3.5;
        positions[i * 3 + 2] = (burst < 2 ? -4 : 9) + Math.sin(phi) * Math.sin(elevation) * radius;
        const color = palette[burst], fade = visible ? Math.max(0, 1 - t / 1.8) : 0;
        colors[i * 3] = color.r * fade; colors[i * 3 + 1] = color.g * fade; colors[i * 3 + 2] = color.b * fade;
      }
      geometry.attributes.position.array.set(positions); geometry.attributes.color.array.set(colors);
      geometry.attributes.position.needsUpdate = true; geometry.attributes.color.needsUpdate = true;
      if (age > 4) points.visible = false;
    },
    clear() { points.visible = false; },
  };
}
