import * as THREE from 'three';
import { createScoopSpoonGeometry, createBlobGeometry, createVesicleGeometry, lemonPoint, SPOON } from '../utils/geometry.js';
import { createPulpMaterial, PALETTE } from '../utils/materials.js';
import { remap, easeInOut, easeOut, smoothstep, lerp, bezier3 } from '../utils/math.js';
import { ParticleSwarm, massPoint } from './ParticleSwarm.js';
import { WORLD } from '../animation/choreography.js';

const flesh = new THREE.Color('#f6cf45');
const pulp = new THREE.Color(PALETTE.pulp);

// scratch objects
const _m = new THREE.Matrix4();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * Timing of the four scoops (fractions of the `scoop` channel), alternating
 * lower and upper half. The last scoop of each half takes all that is left.
 */
const TIMES = [
  { hover: 0.06, dig: 0.11, scoop: 0.16, lift: 0.2, release: 0.25 },
  { hover: 0.3, dig: 0.35, scoop: 0.4, lift: 0.44, release: 0.49 },
  { hover: 0.54, dig: 0.59, scoop: 0.64, lift: 0.68, release: 0.73 },
  { hover: 0.77, dig: 0.81, scoop: 0.85, lift: 0.88, release: 0.92 },
];
const SCOOPS = WORLD.scoop.scoops.map((sc, i) => ({ ...sc, ...TIMES[i], index: i }));

/** Orientation from the handle direction H and the bowl's opening N. */
function orient(out, H, N) {
  _x.copy(H).normalize().negate();            // local +x points to the tip
  _z.copy(N).addScaledVector(_x, -N.dot(_x)).normalize();
  _y.crossVectors(_z, _x);
  _m.makeBasis(_x, _y, _z);
  return out.setFromRotationMatrix(_m);
}

const v3 = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
const H_POUR = v3(-0.5, 0.7, 0.3);
const N_POUR = v3(0.7, 0.3, 0.5); // bowl tipped towards the centre

/**
 * The spoon of Reference 1. In scene 1 it pours sugar (a flat, front-facing
 * silhouette under the flat light); in scene 2 it turns into a real spoon and
 * scoops ALL the pulp out of the citrus: four spoonfuls, alternating the
 * lower and the upper half, until only the peel is left. Every spoonful is
 * poured into the air, spilling juicy vesicles, and joins the ingredients.
 * Every pose is a pure function of the story state (fully reversible).
 */
export class ScoopSpoon {
  constructor() {
    this.group = new THREE.Group();
    this.spoon = new THREE.Mesh(
      createScoopSpoonGeometry(),
      new THREE.MeshStandardMaterial({ color: PALETTE.cream, roughness: 0.55, side: THREE.DoubleSide, envMapIntensity: 0.4 }),
    );
    this.spoon.castShadow = true;
    this.group.add(this.spoon);

    // the spoonfuls
    const blobGeo = createBlobGeometry(3);
    this.blobs = SCOOPS.map((sc, i) => {
      const mat = createPulpMaterial();
      mat.clearcoat = 0.8; // scooped flesh: wet and glossy
      const mesh = new THREE.Mesh(blobGeo, mat);
      mesh.castShadow = true;
      mesh.visible = false;
      this.group.add(mesh);
      return { mesh, mat, cloud: WORLD.scoop.cloud[i], mass: WORLD.scoop.mass[i] };
    });

    // juicy vesicles spilling from the bowl at every pour (all the loose pulp)
    this.vesicles = new ParticleSwarm({
      geometry: createVesicleGeometry(),
      material: createPulpMaterial(),
      count: 128,
      seed: 101,
      emergeSpan: 0.16,
      appearSpan: 0.15,
      arc: 0.2,
      build: (i, r) => {
        const k = SCOOPS[i % SCOOPS.length];
        const rel = WORLD.scoop.release[k.index];
        const cloud = WORLD.scoop.cloud[k.index];
        return {
          a: rel.clone().add(new THREE.Vector3(r.signed() * 0.12, r.signed() * 0.08, r.signed() * 0.1)),
          b: cloud.clone().add(new THREE.Vector3(r.signed() * 0.7, r.signed() * 0.5, r.signed() * 0.45)),
          c: massPoint(r),
          size: r.range(0.05, 0.085),
          visibleAtStart: false,
          emergeDelay: k.release - 0.03 + r.next() * 0.04,
          stretch: 0.6,
        };
      },
    });
    this.group.add(this.vesicles.mesh);
    this.vesicleState = { emerge: 0, converge: 0 };

    // dig points on each cut face (local), from their uv centres
    this.digLocal = SCOOPS.map(({ side, mark: [u, v] }) => {
      const du = u - 0.5, dv = v - 0.5;
      const f = Math.min(0.9, 2 * Math.hypot(du, dv));
      const rim = lemonPoint(side, Math.atan2(dv, du), Math.PI / 2, new THREE.Vector3());
      return new THREE.Vector3(rim.x * f, 0, rim.z * f);
    });
    this.poseAt = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
    this.releasePose = SCOOPS.map(() => ({ pos: new THREE.Vector3(), quat: new THREE.Quaternion() }));
    this.keys = [];
  }

  /** Builds this frame's keyframes (the fruit halves move, so they follow them). */
  buildKeys(s, halves) {
    const pour = easeInOut(remap(s.emerge, 0, 0.3));
    const restPos = WORLD.spoon.clone().setY(WORLD.spoon.y + pour * 0.12);
    const restQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -0.1 - pour * 0.35));
    const key = (t, pos, quat) => ({ t, pos, quat });
    const q = (H, N) => orient(new THREE.Quaternion(), H, N);
    const keys = [key(0, restPos, restQuat)];

    SCOOPS.forEach((k, i) => {
      const half = k.side < 0 ? halves.bottom : halves.top;
      half.mesh.updateWorldMatrix(true, false);
      // N: out of the flesh, away from the fruit; U: the bowl's "up" (always roughly world up)
      const N = new THREE.Vector3(0, -k.side, 0).transformDirection(half.mesh.matrixWorld);
      const U = k.side < 0 ? N.clone() : N.clone().negate();
      const d = this.digLocal[i].clone().applyMatrix4(half.mesh.matrixWorld);
      // the handle always points away from the fruit, up-left or down-left
      const hRest = new THREE.Vector3(-0.8, 0, 0.2).addScaledVector(N, 0.55).normalize();
      const hDig = new THREE.Vector3(-0.55, 0, 0.2).addScaledVector(N, 0.8).normalize();
      const tip = d.clone().addScaledVector(N, -0.06);
      keys.push(
        key(k.hover, d.clone().addScaledVector(N, 0.65).add(_v.set(0.05, 0, 0.1)), q(hRest, _w.copy(U).add(_v.set(0, 0, 0.4)))),
        key(k.dig, tip.clone().addScaledVector(hDig, SPOON.rx), q(hDig, _w.set(0.8, 0, 0.2).addScaledVector(U, 0.45))),
        key(k.scoop, d.clone().addScaledVector(N, SPOON.depth * 0.45).add(_v.set(-0.22, 0, 0)), q(hRest, U)),
        key(k.lift, d.clone().addScaledVector(N, 0.9).add(_v.set(-0.1, 0, 0.2)), q(hRest, _w.copy(U).add(_v.set(0, 0, 0.3)))),
        key(k.release, WORLD.scoop.release[i].clone(), q(H_POUR, N_POUR)),
      );
    });
    const last = keys[keys.length - 1];
    keys.push(key(1, last.pos.clone(), last.quat.clone()));
    this.keys = keys;
  }

  /** Spoon pose at channel value u (eased between keyframes). */
  pose(u, out) {
    const k = this.keys;
    let i = 0;
    while (i < k.length - 2 && u > k[i + 1].t) i++;
    const t = easeInOut(remap(u, k[i].t, k[i + 1].t));
    out.pos.lerpVectors(k[i].pos, k[i + 1].pos, t);
    out.quat.slerpQuaternions(k[i].quat, k[i + 1].quat, t);
    return out;
  }

  /** World position of the pulp sitting in the bowl, for a given spoon pose. */
  inBowl(pose, out) {
    return out.set(0, 0, -SPOON.depth * 0.25).applyQuaternion(pose.quat).add(pose.pos);
  }

  /**
   * @param {object} s story state
   * @param {{top: {mesh, faceMat}, bottom: {mesh, faceMat}}} halves the citrus halves
   * @param {number} p story progress (drives the gentle floating)
   */
  update(s, halves, p) {
    this.buildKeys(s, halves);
    const u = s.scoop;

    // --- the spoon ---------------------------------------------------------
    const pose = this.pose(u, this.poseAt);
    const exit = easeInOut(remap(s.converge, 0.05, 0.35));
    this.spoon.position.copy(pose.pos).add(_v.set(-4.5 * exit, -0.6 * exit, 0.6 * exit));
    this.spoon.quaternion.copy(pose.quat);
    this.spoon.visible = exit < 0.999;

    // --- hollows: the fruit is emptied, then refilled with the pulp mass -----
    const filled = 1 - smoothstep(0.25, 1, s.absorb);
    const slot = { '-1': 0, 1: 0 };
    SCOOPS.forEach((k) => {
      const half = k.side < 0 ? halves.bottom : halves.top;
      const marks = half.faceMat.userData.uniforms.uMarks.value;
      const [mu, mv, r0, r1] = k.mark;
      const dug = smoothstep(k.dig, k.scoop, u);
      // the last scoop of a half sweeps the whole face clean
      const radius = lerp(r0, r1, smoothstep(k.dig + 0.02, k.lift, u));
      marks[slot[k.side]++].set(mu, mv, radius, dug * filled);
    });

    // --- the spoonfuls ------------------------------------------------------
    SCOOPS.forEach((k, i) => {
      const b = this.blobs[i];
      const big = k.mark[3] > k.mark[2] ? 1.25 : 1; // the last scoop of a half is heaped
      const grow = smoothstep(k.dig + 0.02, k.scoop, u);
      const conv = easeInOut(remap(s.converge, 0.05 + i * 0.06, 0.6 + i * 0.06));
      const absorbed = 1 - smoothstep(0.75, 1, conv);
      b.mesh.visible = grow > 0.001 && absorbed > 0.001;
      if (!b.mesh.visible) return;

      if (u < k.release) {
        // resting in the bowl
        this.inBowl(pose, b.mesh.position);
        b.mesh.quaternion.copy(pose.quat);
        b.mesh.scale.set(0.3 * grow * big, 0.18 * grow * big, 0.13 * grow * big);
        b.mat.color.copy(flesh);
      } else {
        // poured out: floats to the cloud, turns to pulp, then joins the mass
        const rp = this.pose(k.release, this.releasePose[i]);
        const start = this.inBowl(rp, _v.set(0, 0, 0));
        const f = easeOut(remap(u, k.release, Math.min(1, k.release + 0.12)));
        b.mesh.position.lerpVectors(start, b.cloud, f);
        b.mesh.position.y += Math.sin(u * 20 + i) * 0.03 * f;
        if (conv > 0) {
          const from = b.mesh.position.clone();
          bezier3(b.mesh.position, from, from.clone().multiplyScalar(1.2).add(_v.set(0, 0.3, 0)), b.mass.clone().multiplyScalar(2), b.mass, conv);
        }
        b.mesh.quaternion.slerpQuaternions(rp.quat, _q.identity(), f);
        b.mesh.rotation.y += conv * 3;
        const r = lerp(0.3, 0.2, f) * absorbed * big;
        b.mesh.scale.set(r, lerp(0.18, 0.19, f) * absorbed * big, lerp(0.13, 0.2, f) * absorbed * big);
        b.mat.color.copy(flesh).lerp(pulp, f);
      }
    });

    // --- vesicles spilling from each pour -----------------------------------
    this.vesicleState.emerge = u;
    this.vesicleState.converge = s.converge;
    this.vesicles.update(this.vesicleState, p);
  }
}
