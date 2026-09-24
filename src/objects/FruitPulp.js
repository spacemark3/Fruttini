import * as THREE from 'three';
import { createSliceIconGeometries } from '../utils/geometry.js';
import { createGraphicMaterial } from '../utils/materials.js';
import { remap, easeInOut } from '../utils/math.js';
import { WORLD } from '../animation/choreography.js';

const _d = new THREE.Vector3();

/**
 * FRUIT PULP: the graphic lemon slice of Reference 1. As the real fruit comes
 * to life the icon folds away (arc and wedges together, each wedge tumbling
 * off on its own): the actual pulp is scooped out of the citrus by the spoon
 * (ScoopSpoon), so no pulp appears from anywhere else.
 */
export class FruitPulp {
  constructor() {
    this.group = new THREE.Group();
    const { arcGeo, wedges } = createSliceIconGeometries();
    const mat = createGraphicMaterial();

    this.arc = new THREE.Mesh(arcGeo, mat);
    this.arc.position.copy(WORLD.slice);
    this.group.add(this.arc);

    this.wedges = wedges.map((w, k) => {
      const mesh = new THREE.Mesh(w.geometry, mat);
      mesh.position.copy(w.center).add(WORLD.slice);
      mesh.userData = { home: mesh.position.clone(), angle: w.angle, delay: k * 0.04 };
      this.group.add(mesh);
      return mesh;
    });
  }

  update(s) {
    // the arc folds away
    const ea = easeInOut(remap(s.emerge, 0.0, 0.45));
    this.arc.visible = ea < 0.999;
    this.arc.scale.setScalar(Math.max(1 - ea, 0.001));
    this.arc.rotation.set(0, ea * 1.2, -ea * 0.6);
    this.arc.position.copy(WORLD.slice).lerp(WORLD.slice.clone().setY(0.3), ea);

    // the wedges drift outward a little, turn and shrink away
    for (const w of this.wedges) {
      const d = w.userData;
      const e = easeInOut(remap(s.emerge, d.delay, d.delay + 0.4));
      w.visible = e < 0.999;
      _d.set(Math.cos(d.angle), Math.sin(d.angle), 0).multiplyScalar(0.35 * e);
      w.position.copy(d.home).add(_d);
      w.rotation.set(e * 1.4, e * 0.8, e * (d.angle - Math.PI / 2));
      w.scale.setScalar(Math.max(1 - e, 0.001));
    }
  }
}
