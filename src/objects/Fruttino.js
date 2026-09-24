import * as THREE from 'three';
import { OrangeShell } from './OrangeShell.js';
import { CreamLayer } from './CreamLayer.js';
import { PulpMass } from './PulpMass.js';
import { SugarCoating } from './SugarCoating.js';
import { createShellMaterial, createFaceMaterial } from '../utils/materials.js';
import { ASSEMBLED_GAP, DIMS } from '../utils/geometry.js';
import { easeInOut, lerp, remap, smoothstep } from '../utils/math.js';
import { WORLD } from '../animation/choreography.js';

/**
 * The protagonist. Composed of:
 *   1. top cap        (OrangeShell +1, starts as the upper citrus half)
 *   2. bottom cap     (OrangeShell -1, starts as the lower citrus half)
 *   3. creamy heart   (CreamLayer)
 *   4. sugary grain   (SugarCoating ×2) + sugar veil in the shell shader —
 *                     the sugar is mixed into the pulp, never sprinkled on
 *   5. the pulp mass  (PulpMass) that fills the halves during the transformation
 */
export class Fruttino {
  constructor() {
    this.group = new THREE.Group();
    this.surfaceMat = createShellMaterial();
    this.faceMat = createFaceMaterial();
    // each half has its own face material: each carries its own spoon hollows
    this.bottomFaceMat = createFaceMaterial();
    this.top = new OrangeShell(1, this.surfaceMat, this.faceMat);
    this.bottom = new OrangeShell(-1, this.surfaceMat, this.bottomFaceMat);
    this.cream = new CreamLayer();
    this.mass = new PulpMass();
    this.topSugar = new SugarCoating(1, 4200, 901);
    this.bottomSugar = new SugarCoating(-1, 1800, 902);
    this.top.mesh.add(this.topSugar.mesh);
    this.bottom.mesh.add(this.bottomSugar.mesh);
    this.group.add(this.top.mesh, this.bottom.mesh, this.cream.mesh, this.mass.group);
  }

  update(s) {
    // --- vertical choreography of the two halves -------------------------
    const ap = easeInOut(s.approach);
    const c1 = easeInOut(remap(s.compress, 0, 0.72)); // caps travel to the cream
    const c2 = easeInOut(remap(s.compress, 0.66, 1)); // gentle squeeze
    const contact = DIMS.cream.relaxed.h * 1.05;
    let gap = lerp(WORLD.topShellStart.y, WORLD.approachGap, ap);
    let gapB = lerp(-WORLD.bottomShellStart.y, WORLD.approachGap, ap);
    gap = lerp(lerp(gap, contact, c1), ASSEMBLED_GAP, c2);
    gapB = lerp(lerp(gapB, contact, c1), ASSEMBLED_GAP, c2);
    this.top.mesh.position.set(0, gap, 0);
    this.bottom.mesh.position.set(0, -gapB, 0);

    // --- rotation: show the fruit's volume, then realign -------------------
    const tilt = WORLD.shellTilt * (1 - ap);
    const wave = Math.sin(s.spin * Math.PI);
    this.top.mesh.rotation.set(-tilt - wave * 0.32, s.spin * Math.PI, wave * 0.16);
    this.bottom.mesh.rotation.set(tilt + wave * 0.28, -s.spin * Math.PI * 0.8, -wave * 0.14);

    // --- citrus half → Fruttino cap ----------------------------------------
    const morph = easeInOut(s.morph);
    this.top.setMorph(morph);
    this.bottom.setMorph(morph);
    const u = this.surfaceMat.userData.uniforms;
    u.uMorph.value = smoothstep(0.1, 0.9, s.morph);
    // the sugar is already in the pulp: its grain and white veil appear as
    // the pulp takes the shape of the caps (nothing is sprinkled on later)
    const surface = smoothstep(0.72, 1, s.morph);
    u.uVeil.value = surface;
    this.surfaceMat.bumpScale = lerp(1.8, 2.0, u.uMorph.value);
    const pulpFill = smoothstep(0.25, 1, s.absorb);
    this.faceMat.userData.uniforms.uPulp.value = pulpFill;
    this.bottomFaceMat.userData.uniforms.uPulp.value = pulpFill;
    // oily sheen on the lemon peel, none on the sugared cap (never exactly 0: one shader variant)
    this.surfaceMat.clearcoat = Math.max(0.001, 0.3 * (1 - u.uMorph.value));

    // --- cream, mass, sugar ------------------------------------------------
    this.cream.update(s, c2);
    this.mass.update(s, gap, -gapB);
    this.topSugar.update(surface);
    this.bottomSugar.update(surface);

    // --- the whole product: lift during assembly, settle on the surface ---
    const lift = WORLD.productLift * easeInOut(remap(s.compress, 0.3, 1));
    const settle = easeInOut(s.settle);
    this.group.position.y = lift * (1 - settle);
    this.group.rotation.y = 0.55 * easeInOut(s.compress) + 0.35 * settle;
    this.group.rotation.z = 0.05 * Math.sin(Math.PI * s.compress) * (1 - settle);
  }
}
