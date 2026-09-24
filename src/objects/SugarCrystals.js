import * as THREE from 'three';
import { ParticleSwarm, cloudPoint, massPoint } from './ParticleSwarm.js';
import { createCrystalGeometry } from '../utils/geometry.js';
import { createSugarMaterial } from '../utils/materials.js';
import { WORLD } from '../animation/choreography.js';

/**
 * SUGAR: the pile of sugar in the spoon of Reference 1 and the stream of
 * grains falling into the lower half of the fruit. The pile lifts off first,
 * freeing the spoon for the scooping (ScoopSpoon); every grain then joins the
 * floating ingredients.
 */
export class SugarCrystals {
  constructor() {
    this.group = new THREE.Group();
    const bowl = WORLD.spoon;
    this.swarm = new ParticleSwarm({
      geometry: createCrystalGeometry(),
      material: createSugarMaterial(),
      count: 340,
      seed: 404,
      build: (i, r) => {
        let a;
        if (i < 190) {
          // mound of sugar resting in the bowl
          const ang = r.next() * Math.PI * 2, rad = Math.sqrt(r.next());
          const hx = Math.cos(ang) * rad * 0.36, hz = Math.sin(ang) * rad * 0.18;
          const height = (1 - rad * rad) * 0.2 * r.range(0.6, 1);
          a = new THREE.Vector3(bowl.x + 0.1 + hx, bowl.y + 0.02 + height, bowl.z + 0.05 + hz);
        } else {
          // stream of grains pouring off the bowl's edge (the dotted trail of the reference)
          const f = r.next();
          const spread = 0.05 + f * 0.22;
          a = new THREE.Vector3(bowl.x + 0.28 + r.signed() * spread, bowl.y - 0.2 - f * 1.0, bowl.z + r.signed() * 0.06);
        }
        return {
          a,
          b: cloudPoint(r),
          c: massPoint(r),
          size: i < 190 ? r.range(0.028, 0.045) : r.range(0.022, 0.034),
          visibleAtStart: true,
          cloudScale: 0.65,
          // the pile leaves the spoon early, before it goes scooping
          emergeDelay: i < 190 ? r.range(0.0, 0.1) : r.range(0.0, 0.25),
        };
      },
    });
    this.group.add(this.swarm.mesh);
  }

  update(s, p) {
    this.swarm.update(s, p);
  }
}
