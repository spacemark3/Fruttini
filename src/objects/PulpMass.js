import * as THREE from 'three';
import { createBlobGeometry } from '../utils/geometry.js';
import { createPulpMaterial, PALETTE } from '../utils/materials.js';
import { easeInOut, lerp, remap, smoothstep } from '../utils/math.js';

const pulpColor = new THREE.Color(PALETTE.pulp);
const creamyColor = new THREE.Color(PALETTE.creamWhite);

function softPulp() {
  const mat = createPulpMaterial();
  // softer than the single pulp pieces: a smooth, dense mass rather than a glossy toy
  mat.roughness = 0.4;
  mat.clearcoat = 0.25;
  mat.clearcoatRoughness = 0.4;
  return mat;
}

/**
 * The soft orange mass where pulp, water and sugar gather. It grows as the
 * ingredients arrive, then divides into THREE volumes:
 *   - upper / lower flow into the two fruit halves and fill them (the cut
 *     faces turn to pulp) right before the halves reshape into the caps;
 *   - the core stays in the centre and is worked, with the sugar already mixed
 *     in, until it turns from orange to a soft, creamy white; it then spreads
 *     into the white band
 *     (CreamLayer) that sits between the caps.
 */
export class PulpMass {
  constructor() {
    this.group = new THREE.Group();
    const geo = createBlobGeometry(5);
    const mat = softPulp();
    this.upper = new THREE.Mesh(geo, mat);
    this.lower = new THREE.Mesh(geo, mat);
    this.coreMat = softPulp();
    this.core = new THREE.Mesh(geo, this.coreMat);
    for (const m of [this.upper, this.lower, this.core]) {
      m.castShadow = true;
      m.visible = false;
      this.group.add(m);
    }
  }

  /**
   * @param {object} s story state
   * @param {number} topFaceY world y of the top shell's cut face
   * @param {number} bottomFaceY world y of the bottom shell's cut face
   */
  update(s, topFaceY, bottomFaceY) {
    const grow = smoothstep(0.08, 0.95, s.converge);
    const split = easeInOut(s.split);
    const absorb = easeInOut(s.absorb);
    const radius = 0.74 * grow * lerp(1, 0.72, split);
    const breathe = 0.5 + 0.5 * Math.sin(s.converge * 9 + s.split * 5);

    const place = (mesh, side, faceY) => {
      mesh.visible = radius > 0.005 && absorb < 0.999;
      if (!mesh.visible) return;
      mesh.morphTargetInfluences[0] = breathe;
      // split: the outer volumes pull apart from the core
      const splitY = side * 0.62 * split;
      // absorb: each volume flattens against its fruit half's cut face
      const targetY = faceY - side * 0.06;
      mesh.position.set(0, lerp(splitY, targetY, absorb), 0);
      const stretch = 1 + 0.18 * Math.sin(split * Math.PI);
      const flat = lerp(1, 0.08, absorb);
      const wide = lerp(1, 1.45, absorb);
      mesh.scale.set(radius * wide / Math.sqrt(stretch), radius * stretch * flat, radius * wide / Math.sqrt(stretch));
      mesh.rotation.y = s.converge * 2 + side * split;
    };
    place(this.upper, 1, topFaceY);
    place(this.lower, -1, bottomFaceY);
    // before the split there is a single mass
    this.lower.visible &&= split > 0.001;

    // --- the core: the same pulp, worked until white, spread into the band ---
    const churn = easeInOut(s.churn);
    const spread = easeInOut(remap(s.cream, 0, 0.6));
    const core = this.core;
    core.visible = split > 0.001 && s.cream < 0.62;
    if (!core.visible) return;
    const r = 0.74 * grow * lerp(0.98, 0.72, split);
    // churning: a slow turn and a soft wobble while the colour whitens
    const wobble = 1 + 0.06 * Math.sin(churn * Math.PI * 3);
    core.position.set(0, 0, 0);
    core.scale.set(lerp(r * wobble, 0.85, spread), lerp(r / wobble, 0.27, spread), lerp(r * wobble, 0.85, spread));
    core.rotation.y = s.converge * 2 + churn * Math.PI * 1.5;
    core.morphTargetInfluences[0] = 0.5 + 0.5 * Math.sin(churn * 7);
    this.coreMat.color.copy(pulpColor).lerp(creamyColor, churn);
    this.coreMat.emissiveIntensity = 0.22 * (1 - churn);
    this.coreMat.roughness = lerp(0.4, 0.55, churn);
    this.coreMat.clearcoat = lerp(0.25, 0.12, churn);
  }
}
