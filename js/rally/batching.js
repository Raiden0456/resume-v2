import * as THREE from "../vendor/three/three.module.min.js";
import { terrainHeight } from "./world.js";

export function createBatch(scene, cellSize = 128) {
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
    // Spatial buckets let Three.js cull scenery outside the camera and shadow views.
    const key = `${shape}:${kind}:${Math.floor(x / cellSize)}:${Math.floor(z / cellSize)}`;
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
        mesh.computeBoundingSphere();
        mesh.matrixAutoUpdate = false;
        mesh.castShadow = kind === "solid";
        mesh.receiveShadow = kind === "solid";
        scene.add(mesh);
      }
    },
  };
}
