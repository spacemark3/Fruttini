import * as THREE from 'three';

/**
 * World-space layout of the story. Scene 1 reproduces the vertical stack of
 * Reference 1 (top half · slice · drops · spoon & sugar · bottom half);
 * later scenes gather everything at the origin, where the Fruttino is built.
 */
export const WORLD = {
  topShellStart: new THREE.Vector3(0, 2.05, 0),
  bottomShellStart: new THREE.Vector3(0, -2.25, 0),
  shellTilt: 0.22,
  approachGap: 0.95, // shells hover here while the mass forms and the cream appears
  slice: new THREE.Vector3(0, 0.66, 0.05),
  drops: [
    new THREE.Vector3(-0.64, -0.3, 0.08),
    new THREE.Vector3(0, -0.3, 0.08),
    new THREE.Vector3(0.64, -0.3, 0.08),
  ],
  dropsFloat: [
    new THREE.Vector3(-0.95, 0.05, 0.45),
    new THREE.Vector3(0.1, -0.45, 0.75),
    new THREE.Vector3(0.95, 0.2, 0.25),
  ],
  spoon: new THREE.Vector3(0.06, -1.36, 0.22),
  // The spoon empties the fruit: four spoonfuls, alternating halves
  // (side -1 = lower, +1 = upper). Per scoop: the hollow it digs in the cut
  // face (uv centre, radius it opens, radius once the half is emptied), where
  // it is poured, where it floats, where it ends up in the central mass.
  scoop: {
    scoops: [
      { side: -1, mark: [0.37, 0.6, 0.14, 0.14] },
      { side: 1, mark: [0.4, 0.42, 0.14, 0.14] },
      { side: -1, mark: [0.6, 0.44, 0.12, 0.62] },  // takes the rest: the half is empty
      { side: 1, mark: [0.6, 0.58, 0.12, 0.62] },
    ],
    release: [
      new THREE.Vector3(-0.3, -0.95, 0.8), new THREE.Vector3(-0.35, 0.75, 0.8),
      new THREE.Vector3(0.4, -0.75, 0.85), new THREE.Vector3(0.45, 0.6, 0.85),
    ],
    cloud: [
      new THREE.Vector3(-0.6, -0.35, 0.65), new THREE.Vector3(-0.55, 0.3, 0.6),
      new THREE.Vector3(0.6, -0.1, 0.55), new THREE.Vector3(0.55, 0.35, 0.5),
    ],
    mass: [
      new THREE.Vector3(0.12, 0.1, 0.2), new THREE.Vector3(-0.15, 0.08, 0.12),
      new THREE.Vector3(-0.1, -0.12, 0.18), new THREE.Vector3(0.14, -0.05, 0.1),
    ],
  },
  productLift: 0.3,
  orangeFinal: new THREE.Vector3(-1.45, 0, -1.05), // y is set from the floor
  orangeRadius: 0.56,
};
