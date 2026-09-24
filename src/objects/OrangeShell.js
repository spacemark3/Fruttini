import * as THREE from 'three';
import { createShellGeometry } from '../utils/geometry.js';

/**
 * One half of the story's protagonist. It starts as half of the citrus fruit
 * in Reference 1 and — through a morph target on the very same mesh — becomes
 * a sugared orange cap of the Fruttino in Reference 2.
 */
export class OrangeShell {
  /**
   * @param {1|-1} side  +1 = top, -1 = bottom
   * @param {THREE.Material} surfaceMaterial shared peel/cap material
   * @param {THREE.Material} faceMaterial shared cut-face material
   */
  constructor(side, surfaceMaterial, faceMaterial) {
    this.side = side;
    this.mesh = new THREE.Mesh(createShellGeometry(side), [surfaceMaterial, faceMaterial]);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  /** 0 = citrus half, 1 = Fruttino cap */
  setMorph(v) {
    this.mesh.morphTargetInfluences[0] = v;
  }
}
