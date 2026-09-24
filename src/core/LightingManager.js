import * as THREE from 'three';
import { lerp } from '../utils/math.js';

/**
 * Photographic studio lighting: soft key, delicate fill, rim for the edges,
 * diffuse ambient bounce. At `light = 0` the rig is almost pure ambient, so
 * scene 1 reads as a flat illustration; `light = 1` is the product studio.
 * `warm` shifts the bounce from the pastel sky to the beige still life.
 */
export class LightingManager {
  constructor(scene) {
    this.scene = scene;
    this.hemi = new THREE.HemisphereLight('#ffffff', '#e6e6dc', 2.2);

    this.key = new THREE.DirectionalLight('#fff3e3', 0.2);
    this.key.position.set(-3.5, 5.5, 4.5);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.radius = 7;
    this.key.shadow.blurSamples = 16;
    this.key.shadow.bias = -0.0006;
    this.key.shadow.normalBias = 0.025;
    const sc = this.key.shadow.camera;
    sc.left = -4; sc.right = 4; sc.top = 4; sc.bottom = -4; sc.near = 1; sc.far = 20;

    this.fill = new THREE.DirectionalLight('#e8f2ff', 0);
    this.fill.position.set(4.5, 1.5, 3.5);

    this.rim = new THREE.DirectionalLight('#fff8ef', 0);
    this.rim.position.set(1.5, 3.5, -5.5);

    scene.add(this.hemi, this.key, this.fill, this.rim);
    this.groundSky = new THREE.Color('#e6e6dc');
    this.groundWarm = new THREE.Color('#eadac6');
  }

  update(light, warm) {
    this.hemi.intensity = lerp(2.4, 0.75, light);
    this.key.intensity = lerp(0.15, 2.6, light);
    this.fill.intensity = lerp(0, 0.75, light);
    this.rim.intensity = lerp(0, 1.9, light);
    this.scene.environmentIntensity = lerp(0.18, 0.75, light);
    this.hemi.groundColor.copy(this.groundSky).lerp(this.groundWarm, warm);
    // the still-life key comes a little more from the side, for a longer shadow
    this.key.position.set(lerp(-3.5, -2.2, warm), lerp(5.5, 5.0, warm), lerp(4.5, 3.2, warm));
  }
}
