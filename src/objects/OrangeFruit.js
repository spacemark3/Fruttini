import * as THREE from 'three';
import { Leaves } from './Leaves.js';
import { getTextures } from '../utils/materials.js';
import { easeInOut, fbm3, remap, lerp } from '../utils/math.js';
import { WORLD } from '../animation/choreography.js';
import { FRUTTINO_BOTTOM } from '../utils/geometry.js';

/**
 * The small whole citrus that joins the final still life (Reference 2):
 * behind the Fruttino, slightly to the left, with two green leaves.
 */
export class OrangeFruit {
  constructor() {
    this.group = new THREE.Group();
    const R = WORLD.orangeRadius;
    const geo = new THREE.SphereGeometry(R, 72, 48);
    const pos = geo.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = v.clone().normalize();
      const k = 1 + 0.018 * fbm3(n.x * 2, n.y * 2, n.z * 2, 3);
      // slightly squashed, with a soft dimple at the stem
      const dimple = 1 - 0.07 * Math.pow(Math.max(0, n.y), 12);
      pos.setXYZ(i, v.x * k, v.y * 0.9 * k * dimple, v.z * k);
    }
    geo.computeVertexNormals();
    const tx = getTextures();
    this.body = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
      map: tx.peelMap,
      bumpMap: tx.bumpMap,
      bumpScale: 1.2,
      roughness: 0.42,
      clearcoat: 0.25,
      clearcoatRoughness: 0.5,
      sheen: 0.3,
      sheenColor: new THREE.Color('#ffd7a8'),
      envMapIntensity: 0.9,
    }));
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.spinner = new THREE.Group();
    this.spinner.add(this.body);
    this.leaves = new Leaves();
    this.leaves.group.position.y = R * 0.9 * 0.93;
    this.spinner.add(this.leaves.group);
    this.group.add(this.spinner);
    this.restY = FRUTTINO_BOTTOM + R * 0.9;
    this.group.visible = false;
  }

  update(s) {
    const t = s.orange;
    this.group.visible = t > 0.001;
    if (!this.group.visible) return;
    const e = easeInOut(remap(t, 0, 0.75));
    const f = WORLD.orangeFinal;
    this.group.position.set(lerp(f.x - 2.6, f.x, e), this.restY, lerp(f.z - 2.2, f.z, e));
    // it rolls into place, then rests with its leaves up
    this.spinner.rotation.set(0, lerp(-1.2, 0.35, e), (1 - e) * 2.4);
    this.leaves.update(remap(t, 0.45, 1));
  }
}
