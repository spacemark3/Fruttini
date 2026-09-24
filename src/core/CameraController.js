import * as THREE from 'three';
import { clamp } from '../utils/math.js';

const DEG = Math.PI / 180;

/**
 * Camera "shots" of the story. The timeline animates a single float
 * (`state.shot`) through these keyframes; values are interpolated with a
 * Catmull-Rom spline so the camera glides through them without stopping.
 *
 *   target   point the lens is aimed at
 *   az, el   orbit angles in degrees
 *   fov      vertical field of view (product-photography range, 12°–30°)
 *   fit      half-height of the world area that must stay in frame
 *   fitW     half-width that must stay in frame (governs narrow screens)
 *   roll     optional tilt in degrees around the view axis (0 = level)
 *   anchor   where the target sits on screen, as a fraction of the viewport
 *            from its centre (x → right, y → up). Lets the 3D share the frame
 *            with typography without cropping the scene.
 *   portrait overrides for narrow/phone layouts
 */
export const SHOTS = [
  { // 0 · Scene 1, flat illustration (long lens ≈ orthographic)
    target: [0, -0.22, 0], az: 0, el: 0, fov: 11, fit: 3.3, fitW: 1.95, anchor: [-0.235, 0],
    portrait: { fit: 5.7, fitW: 2.05, anchor: [0, 0.075] },
  },
  { // 1 · Scene 1, the illustration swings round: it was 3D all along
    target: [0, -0.22, 0], az: 24, el: 8, roll: -2, fov: 26, fit: 3.3, fitW: 1.95, anchor: [-0.235, 0],
    portrait: { fit: 5.7, fitW: 2.05, anchor: [0, 0.075] },
  },
  { // 2 · Scene 2, wide orbit around the opening fruit
    target: [0, -0.1, 0], az: -40, el: 14, roll: 3, fov: 24, fit: 3.3, fitW: 2.6, anchor: [0, 0],
    portrait: { fit: 3.4, fitW: 2.1, anchor: [0, 0.06] },
  },
  { // 3 · Scene 3, high angle: the ingredients swirl in like a vortex
    target: [0, 0, 0], az: 20, el: 38, roll: -4, fov: 24, fit: 3.25, fitW: 2.6, anchor: [0, 0],
    portrait: { fit: 3.3, fitW: 2.1, anchor: [0, 0.06] },
  },
  { // 4 · Scene 3, low angle as the mass gathers between the halves
    target: [0, 0, 0], az: -35, el: -6, roll: 3, fov: 24, fit: 2.4, fitW: 2.3, anchor: [0, 0],
    portrait: { fit: 2.8, fitW: 1.95, anchor: [0, 0.06] },
  },
  { // 5 · Scene 3, the mass divides and fills the halves
    target: [0, 0, 0], az: 10, el: 18, fov: 24, fit: 1.95, fitW: 2.0, anchor: [0, 0],
    portrait: { fit: 2.4, fitW: 1.8, anchor: [0, 0.06] },
  },
  { // 6 · Scene 4, close three-quarter view of the creamy heart
    target: [0, 0.02, 0], az: 58, el: 5, roll: -3, fov: 22, fit: 1.85, fitW: 1.6, anchor: [0, 0],
    portrait: { fit: 2.3, fitW: 1.4, anchor: [0, 0.06] },
  },
  { // 7 · Scene 5, from above as the caps close and sugar falls
    target: [0, 0.05, 0], az: -35, el: 24, roll: 2, fov: 22, fit: 1.85, fitW: 1.7, anchor: [0, 0],
    portrait: { fit: 2.0, fitW: 1.45, anchor: [0, 0.05] },
  },
  { // 8 · Scene 5, pull back on the assembled Fruttino
    target: [0, 0.2, 0], az: 22, el: 8, fov: 22, fit: 2.0, fitW: 1.9, anchor: [0, 0],
    portrait: { fit: 2.2, fitW: 1.55, anchor: [0, 0.03] },
  },
  { // 9 · Scene 6, still life (Reference 2)
    target: [-0.5, -0.3, -0.45], az: -3, el: 7, fov: 20, fit: 2.2, fitW: 3.0, anchor: [0.17, -0.04],
    portrait: { fit: 2.2, fitW: 1.85, anchor: [0.03, -0.13] },
  },
  { // 10 · Scene 6, final slow move
    target: [-0.45, -0.32, -0.4], az: 9, el: 9, fov: 20, fit: 2.1, fitW: 2.9, anchor: [0.17, -0.04],
    portrait: { fit: 2.15, fitW: 1.78, anchor: [0.03, -0.13] },
  },
];

function resolve(shot, portrait) {
  const o = portrait && shot.portrait ? { ...shot, ...shot.portrait } : shot;
  return [o.target[0], o.target[1], o.target[2], o.az, o.el, o.fov, o.fit, o.fitW, o.anchor[0], o.anchor[1], o.roll ?? 0];
}

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3();
    this.viewport = { width: 1, height: 1 };
    this.cache = { landscape: SHOTS.map((s) => resolve(s, false)), portrait: SHOTS.map((s) => resolve(s, true)) };
  }

  setViewport({ width, height }) {
    this.viewport = { width, height };
  }

  /** @param {number} shot float index into SHOTS @param {'landscape'|'portrait'} layout */
  apply(shot, layout) {
    const list = this.cache[layout];
    const n = list.length;
    const f = clamp(shot, 0, n - 1);
    const i = Math.min(Math.floor(f), n - 2);
    const t = f - i;
    const a = list[Math.max(i - 1, 0)], b = list[i], c = list[i + 1], d = list[Math.min(i + 2, n - 1)];
    const v = b.map((_, k) => catmull(a[k], b[k], c[k], d[k], t));
    const [tx, ty, tz, az, el, fov, fit, fitW, ax, ay, roll] = v;

    const { width, height } = this.viewport;
    const aspect = width / height;
    const tanH = Math.tan((fov * DEG) / 2);
    const dist = Math.max(fit / tanH, fitW / (tanH * aspect));

    this.target.set(tx, ty, tz);
    const cam = this.camera;
    cam.fov = fov;
    cam.position.set(
      tx + Math.sin(az * DEG) * Math.cos(el * DEG) * dist,
      ty + Math.sin(el * DEG) * dist,
      tz + Math.cos(az * DEG) * Math.cos(el * DEG) * dist,
    );
    cam.near = Math.max(0.1, dist - 12);
    cam.far = dist + 20;
    cam.lookAt(this.target);
    cam.rotateZ(roll * DEG); // a slight dutch tilt on some shots
    // Shift the projection so the target lands on its composition anchor.
    cam.setViewOffset(width, height, -ax * width, ay * height, width, height);
    cam.updateProjectionMatrix();
  }
}
