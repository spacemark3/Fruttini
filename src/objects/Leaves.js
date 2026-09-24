import * as THREE from 'three';
import { createLeafGeometry } from '../utils/geometry.js';
import { PALETTE } from '../utils/materials.js';
import { easeOutBack, remap } from '../utils/math.js';

/** The two small green leaves on the whole fruit of Reference 2. */
export class Leaves {
  constructor() {
    this.group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: PALETTE.leaf, roughness: 0.5, side: THREE.DoubleSide, envMapIntensity: 0.8,
    });
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.028, 0.08, 8),
      new THREE.MeshStandardMaterial({ color: '#5b5a2a', roughness: 0.7 }),
    );
    stem.position.y = 0.03;
    this.group.add(stem);

    // [length, width, rotZ (direction), rotY, rotX]
    const specs = [
      [0.66, 0.29, 2.35, 0.35, 0.25], // big leaf, up-left
      [0.5, 0.24, 0.95, -0.5, -0.2],  // smaller leaf, up-right
    ];
    this.leaves = specs.map(([l, w, rz, ry, rx]) => {
      const pivot = new THREE.Group();
      const leaf = new THREE.Mesh(createLeafGeometry(l, w), mat);
      leaf.castShadow = true;
      pivot.rotation.set(rx, ry, rz);
      pivot.position.y = 0.05;
      pivot.add(leaf);
      this.group.add(pivot);
      return pivot;
    });
  }

  /** @param {number} t 0 = folded, 1 = unfurled */
  update(t) {
    this.leaves.forEach((pivot, i) => {
      const k = easeOutBack(remap(t, i * 0.2, 0.8 + i * 0.2), 1.6);
      pivot.scale.setScalar(Math.max(k, 0.001));
    });
  }
}
