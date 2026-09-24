import * as THREE from 'three';
import { capPoint, capNormal, createCrystalGeometry } from '../utils/geometry.js';
import { createSugarMaterial } from '../utils/materials.js';
import { makeRandom, remap, easeOut, TAU } from '../utils/math.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/**
 * The fine sugary grain of a cap's surface. The sugar is not sprinkled on at
 * the end: it is already mixed into the pulp, so the grains simply surface in
 * place, scattered, as the pulp takes the shape of the cap. One InstancedMesh
 * (a single draw call) per cap; grains sit on the exact analytic cap surface,
 * denser toward the top where the reference shows a white, sugary veil.
 */
export class SugarCoating {
  constructor(side, count, seed) {
    this.mesh = new THREE.InstancedMesh(createCrystalGeometry(), createSugarMaterial(), count);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.count = count;
    const rng = makeRandom(seed);
    const n = new THREE.Vector3();
    this.items = [];
    while (this.items.length < count) {
      const th = rng.next() * TAU;
      const a = Math.acos(rng.next()); // area-uniform on the dome
      const density = side > 0 ? 0.3 + 0.7 * Math.cos(a) : 0.25 + 0.75 * Math.sin(a) * 0.8;
      if (rng.next() > density) continue;
      const target = capPoint(side, th, a, new THREE.Vector3());
      capNormal(side, th, a, n);
      target.addScaledVector(n, 0.004);
      const tangent = new THREE.Vector3(-Math.sin(th), 0, Math.cos(th));
      this.items.push({
        target,
        normal: n.clone(),
        tangent,
        dist: rng.range(0.6, 2.2),
        swirl: rng.range(0.2, 0.7),
        delay: rng.range(0, 0.62),
        size: rng.range(0.0045, 0.0095),
        rot: new THREE.Euler(rng.next() * TAU, rng.next() * TAU, rng.next() * TAU),
      });
    }
    this.last = -1;
    this.mesh.visible = false;
  }

  /** @param {number} surface 0 → 1 as the pulp becomes the cap */
  update(surface) {
    if (surface === this.last) return;
    this.last = surface;
    this.mesh.visible = surface > 0.001;
    if (!this.mesh.visible) return;
    for (let i = 0; i < this.count; i++) {
      const d = this.items[i];
      // each grain surfaces where it is, at its own moment: no falling
      const t = remap(surface, d.delay, d.delay + 0.38);
      _p.copy(d.target);
      const sc = d.size * easeOut(t);
      _e.set(d.rot.x, d.rot.y, d.rot.z);
      _q.setFromEuler(_e);
      _s.set(sc, sc * 0.8, sc);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
