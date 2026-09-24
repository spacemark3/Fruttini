import * as THREE from 'three';
import { TAU, makeRandom, remap, smoothstep, easeInOut, bezier3 } from '../utils/math.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c1 = new THREE.Vector3();
const _b1 = new THREE.Vector3();

/**
 * Instanced particles with fully precomputed, deterministic trajectories:
 *
 *   A (scene 1 layout)  --emerge-->  B (floating cloud)  --converge-->  C (the mass)
 *
 * Nothing is spawned at runtime; every instance's state is a pure function of
 * the story channels, so running the timeline backwards (the replay rewind)
 * retraces the exact same motion.
 */
export class ParticleSwarm {
  /**
   * @param {object} o
   * @param {THREE.BufferGeometry} o.geometry
   * @param {THREE.Material} o.material
   * @param {number} o.count
   * @param {number} o.seed
   * @param {(i:number, rng:object) => object} o.build  returns { a, b, c, size, visibleAtStart, emergeDelay, convergeDelay }
   */
  constructor({ geometry, material, count, seed, build, swirl = 1, emergeSpan = 0.55, appearSpan = 0.3, arc = 0.45 }) {
    this.emergeSpan = emergeSpan;
    this.appearSpan = appearSpan;
    this.arc = arc;
    this.count = count;
    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const rng = makeRandom(seed);
    this.items = [];
    for (let i = 0; i < count; i++) {
      const d = build(i, rng);
      d.phase = rng.next() * TAU;
      d.spin = new THREE.Vector3(rng.signed(), rng.signed(), rng.signed()).multiplyScalar(6);
      d.rot0 = new THREE.Euler(rng.next() * TAU, rng.next() * TAU, rng.next() * TAU);
      d.emergeDelay ??= rng.range(0, 0.45);
      d.convergeDelay ??= rng.range(0, 0.5);
      // Swirling control points for an organic inflow toward the centre
      const ang = swirl * rng.range(0.7, 1.3);
      d.b1 = d.b.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ang).multiplyScalar(1.15);
      d.b1.y += rng.range(-0.3, 0.5);
      d.c1 = d.c.clone().multiplyScalar(2.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), ang * 1.7);
      this.items.push(d);
    }
    this.last = null;
  }

  update(state, p) {
    const key = `${state.emerge.toFixed(5)}|${state.converge.toFixed(5)}|${p.toFixed(5)}`;
    if (key === this.last) return;
    this.last = key;
    let anyVisible = false;
    for (let i = 0; i < this.count; i++) {
      const d = this.items[i];
      const te = remap(state.emerge, d.emergeDelay, d.emergeDelay + this.emergeSpan);
      const e = easeInOut(te);
      // A → B along an arc
      _mid.addVectors(d.a, d.b).multiplyScalar(0.5);
      _mid.y += this.arc;
      const it = 1 - e;
      _b.set(
        it * it * d.a.x + 2 * it * e * _mid.x + e * e * d.b.x,
        it * it * d.a.y + 2 * it * e * _mid.y + e * e * d.b.y,
        it * it * d.a.z + 2 * it * e * _mid.z + e * e * d.b.z,
      );
      // gentle, deterministic float while suspended
      const drift = e * 0.06;
      _b.x += Math.sin(p * 26 + d.phase) * drift;
      _b.y += Math.cos(p * 21 + d.phase * 1.3) * drift;

      const tc = remap(state.converge, d.convergeDelay, d.convergeDelay + 0.5);
      const c = easeInOut(tc);
      if (c > 0) {
        _b1.copy(d.b1);
        _c1.copy(d.c1);
        bezier3(_p, _b, _b1, _c1, d.c, c);
      } else {
        _p.copy(_b);
      }

      const appear = d.visibleAtStart ? 1 : smoothstep(0, this.appearSpan, te);
      const absorbed = 1 - smoothstep(0.72, 1, tc);
      const sc = d.size * appear * absorbed * (1 + ((d.cloudScale ?? 1) - 1) * e);
      if (sc > 1e-4) anyVisible = true;
      const spinAmt = e + c * 2;
      _e.set(d.rot0.x + d.spin.x * spinAmt * 0.3, d.rot0.y + d.spin.y * spinAmt * 0.3, d.rot0.z + d.spin.z * spinAmt * 0.3);
      _q.setFromEuler(_e);
      _s.set(sc, sc, sc);
      if (d.stretch) _s.y *= 1 + d.stretch * (1 - e);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.visible = anyVisible;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Random point inside the shared "floating cloud" between the fruit halves (scene 2). */
export function cloudPoint(rng, out = new THREE.Vector3()) {
  const u = rng.next() * TAU, v = Math.acos(rng.signed()), r = Math.cbrt(rng.range(0.15, 1));
  return out.set(
    Math.sin(v) * Math.cos(u) * r * 1.75,
    -0.1 + Math.cos(v) * r * 1.05,
    Math.sin(v) * Math.sin(u) * r * 1.1,
  );
}

/** Random point on the forming mass at the centre (scene 3). */
export function massPoint(rng, out = new THREE.Vector3()) {
  const u = rng.next() * TAU, v = Math.acos(rng.signed());
  const r = rng.range(0.2, 0.6);
  return out.set(Math.sin(v) * Math.cos(u) * r, Math.cos(v) * r, Math.sin(v) * Math.sin(u) * r);
}
