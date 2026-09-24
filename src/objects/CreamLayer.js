import * as THREE from 'three';
import { createCreamGeometry } from '../utils/geometry.js';
import { createCreamMaterial } from '../utils/materials.js';
import { easeInOut, easeOutBack, lerp, remap, smoothstep } from '../utils/math.js';

/**
 * The creamy heart: it IS the pulp. The core of the pulp mass is worked
 * white (PulpMass) and spreads out into this soft band with irregular edges;
 * the band takes over from the core as it flattens (scene 4), then is gently
 * compressed by the caps, bulging outward (scene 5) — the relaxed and
 * compressed shapes are two morph targets.
 */
export class CreamLayer {
  constructor() {
    this.mesh = new THREE.Mesh(createCreamGeometry(), createCreamMaterial());
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.visible = false;
  }

  /** @param {object} s story state  @param {number} squeeze 0 relaxed → 1 compressed */
  update(s, squeeze) {
    const g = s.cream;
    // appears inside the flattening white core, then grows past it
    this.mesh.visible = g > 0.3;
    if (!this.mesh.visible) return;
    const t = remap(g, 0.3, 1);
    const r = lerp(0.88, 1, easeOutBack(t, 1.4));
    const h = lerp(0.92, 1, easeInOut(t));
    this.mesh.scale.set(r, h, r);
    this.mesh.rotation.y = (1 - smoothstep(0, 1, g)) * 1.4;
    this.mesh.morphTargetInfluences[0] = squeeze;
  }
}
