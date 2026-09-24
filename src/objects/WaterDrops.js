import * as THREE from 'three';
import { ParticleSwarm, cloudPoint, massPoint } from './ParticleSwarm.js';
import { createDropGeometry } from '../utils/geometry.js';
import { createWaterMaterial, PALETTE } from '../utils/materials.js';
import { remap, easeInOut, smoothstep, lerp, makeRandom, bezier3 } from '../utils/math.js';
import { WORLD } from '../animation/choreography.js';

const cream = new THREE.Color(PALETTE.cream);
const water = new THREE.Color('#e4f4fa');
const _v = new THREE.Vector3();

/**
 * WATER: the three flat drop icons of Reference 1 gain volume and turn into
 * clear water drops; smaller droplets spill out of them and float around.
 */
export class WaterDrops {
  constructor() {
    this.group = new THREE.Group();
    const geo = createDropGeometry();
    this.mat = createWaterMaterial();
    const rng = makeRandom(303);
    this.drops = WORLD.drops.map((a, k) => {
      const mesh = new THREE.Mesh(geo, this.mat);
      const b = WORLD.dropsFloat[k];
      const c = massPoint(rng).multiplyScalar(0.7);
      mesh.userData = {
        a, b, c,
        b1: b.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.9).multiplyScalar(1.1),
        c1: c.clone().multiplyScalar(2.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), 1.5),
        delay: 0.08 + k * 0.08, cDelay: 0.1 + k * 0.1,
      };
      mesh.renderOrder = 2;
      this.group.add(mesh);
      return mesh;
    });

    this.swarm = new ParticleSwarm({
      geometry: createDropGeometry(14, 14), // small droplets: low-poly is plenty
      material: this.mat,
      count: 42,
      seed: 202,
      build: (i, r) => ({
        a: WORLD.drops[i % 3].clone().add(new THREE.Vector3(r.signed() * 0.1, r.signed() * 0.15, 0)),
        b: cloudPoint(r),
        c: massPoint(r),
        size: r.range(0.07, 0.13),
        visibleAtStart: false,
        emergeDelay: r.range(0.15, 0.45),
      }),
    });
    this.swarm.mesh.renderOrder = 2;
    this.group.add(this.swarm.mesh);
  }

  update(s, p) {
    const m = smoothstep(0.05, 0.45, s.emerge);
    this.mat.color.copy(cream).lerp(water, m);
    this.mat.opacity = lerp(1, 0.62, m);
    this.mat.roughness = lerp(0.85, 0.04, m);
    this.mat.clearcoat = Math.max(m, 0.001); // never exactly 0: keeps one shader variant
    this.mat.depthWrite = m < 0.5;

    for (const d of this.drops) {
      const u = d.userData;
      const e = easeInOut(remap(s.emerge, u.delay, u.delay + 0.55));
      const c = easeInOut(remap(s.converge, u.cDelay, u.cDelay + 0.5));
      _v.copy(u.a).lerp(u.b, e);
      _v.y += Math.sin(p * 20 + u.delay * 30) * 0.05 * e;
      if (c > 0) bezier3(_v, _v.clone(), u.b1, u.c1, u.c, c);
      d.position.copy(_v);
      // flat icon (z scale ~0.12) → round 3D drop
      const size = lerp(0.8, 0.46, e) * (1 - smoothstep(0.7, 1, c));
      d.scale.set(size * 0.78, size, size * lerp(0.14, 0.78, e));
      d.rotation.set(Math.sin(e * Math.PI) * 0.4, e * 0.8 + c * 2, c * 1.5);
      d.visible = size > 0.002;
    }
    this.swarm.update(s, p);
  }
}
