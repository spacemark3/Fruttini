import * as THREE from 'three';
import { getTextures } from '../utils/materials.js';
import { FRUTTINO_BOTTOM } from '../utils/geometry.js';
import { WORLD } from '../animation/choreography.js';
import { smoothstep, easeInOut } from '../utils/math.js';

/**
 * The light surface of the final still life: a shadow-catching floor
 * (transparent, so the warm background shows through) plus soft contact
 * shadows under the Fruttino and the fruit.
 */
export class StillLifeStage {
  constructor() {
    this.group = new THREE.Group();
    this.floorMat = new THREE.ShadowMaterial({ color: '#5a3e28', opacity: 0, transparent: true });
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), this.floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = FRUTTINO_BOTTOM - 0.002;
    this.floor.receiveShadow = true;
    this.group.add(this.floor);

    const tx = getTextures();
    const blob = (size) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({ map: tx.shadowMap, transparent: true, depthWrite: false, opacity: 0 }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = FRUTTINO_BOTTOM + 0.002;
      m.renderOrder = 1;
      this.group.add(m);
      return m;
    };
    this.productShadow = blob(2.6);
    this.orangeShadow = blob(1.5);
    this.orangeShadow.position.x = WORLD.orangeFinal.x;
    this.orangeShadow.position.z = WORLD.orangeFinal.z;
  }

  /** @param {object} s story state @param {number} productY current lift of the Fruttino */
  update(s, productY) {
    const w = smoothstep(0.2, 1, s.warm);
    this.floorMat.opacity = 0.14 * w;
    const contact = w * (1 - Math.min(productY / 0.4, 1) * 0.7);
    this.productShadow.material.opacity = 0.55 * contact;
    this.productShadow.scale.setScalar(1 + productY * 0.8);
    const o = easeInOut(smoothstep(0.5, 0.8, s.orange));
    this.orangeShadow.material.opacity = 0.5 * o;
    this.group.visible = w > 0.001;
  }
}
