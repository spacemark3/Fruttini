import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TAU, fbm3 } from './math.js';

// ---------------------------------------------------------------------------
// Proportions derived from the two reference images.
//   Reference 1: a citrus cut horizontally, halves ~3.2 wide, top dome ~0.8
//                tall, bottom bowl ~1.05 deep (world units).
//   Reference 2: the Fruttino is ~2.0 wide and ~1.82 tall:
//                top cap 0.60 · cream band 0.54 · bottom cap 0.68.
// ---------------------------------------------------------------------------
export const DIMS = {
  lemon: { rx: 1.5, rz: 1.08, ryTop: 0.8, ryBottom: 1.02 },
  cap: { R: 1.0, hTop: 0.6, hBottom: 0.68 },
  cream: {
    relaxed: { R: 0.9, h: 0.34 },
    compressed: { R: 0.935, h: 0.27 },
  },
};

// The final (assembled) vertical offsets of the caps from the centre.
export const ASSEMBLED_GAP = DIMS.cream.compressed.h;
export const FRUTTINO_BOTTOM = -(ASSEMBLED_GAP + DIMS.cap.hBottom);

/**
 * Point on half a citrus fruit (shape A of the shell morph).
 * side = +1 → top half (dome up, cut face down); side = -1 → bottom half.
 * theta ∈ [0, 2π) around the Y axis; a ∈ [0, π/2] polar angle (0 = pole, π/2 = rim).
 */
export function lemonPoint(side, theta, a, out) {
  const { rx, rz, ryTop, ryBottom } = DIMS.lemon;
  const s = Math.sin(a), c = Math.cos(a);
  const sx = s * Math.cos(theta), sz = s * Math.sin(theta), sy = c;
  let x = sx * rx, z = sz * rz, y = sy * (side > 0 ? ryTop : ryBottom);
  // pointed citrus ends along X (a bigger nub on the right, like the reference)
  const px = Math.max(0, sx), nx = Math.max(0, -sx);
  x += Math.pow(px, 14) * 0.26 - Math.pow(nx, 16) * 0.14;
  y *= 1 - 0.4 * Math.pow(Math.abs(sx), 6);
  // gentle peel lumpiness (periodic in theta → seamless)
  const k = 1 + 0.022 * fbm3(sx * 1.4, sy * 1.4 + (side > 0 ? 0 : 7.3), sz * 1.4, 3);
  return out.set(x * k, y * k * side, z * k);
}

/**
 * Point on one Fruttino cap (shape B of the shell morph): a slightly squashed,
 * softly irregular dome with a vertical wall where it meets the cream.
 */
export function capPoint(side, theta, a, out) {
  const { R, hTop, hBottom } = DIMS.cap;
  const s = Math.sin(a), c = Math.max(0, Math.cos(a));
  const top = side > 0;
  // exponents < 1 give a fuller, softly "pillowed" dome; the bottom is rounder
  const r = Math.pow(s, top ? 0.86 : 0.92);
  const h = Math.pow(c, top ? 0.74 : 0.9);
  const seed = top ? 0 : 11.7;
  const ct = Math.cos(theta), st = Math.sin(theta);
  // noise sampled by 3D direction: continuous everywhere, including the pole
  const dx = s * ct, dy = c, dz = s * st;
  const n1 = fbm3(dx * 1.2 + seed, dy * 1.2, dz * 1.2, 3);
  const n2 = fbm3(dx * 3.4, dy * 3.4 + seed, dz * 3.4, 2);
  // soft rounded lip where the cap meets the cream (the rim tucks in slightly)
  const lip = 1 - 0.075 * Math.pow(Math.max(0, 1 - c * 3.2), 2.2);
  const kr = (1 + 0.032 * n1 + 0.012 * n2) * lip;
  const kh = 1 + 0.07 * n1 + 0.02 * n2;
  return out.set(ct * r * R * kr, h * (top ? hTop : hBottom) * kh * side, st * r * R * kr);
}

/** Outward normal of the cap surface, by finite differences. */
export function capNormal(side, theta, a, out) {
  const p = new THREE.Vector3(), pt = new THREE.Vector3(), pa = new THREE.Vector3();
  const e = 1e-3;
  const aa = Math.min(a, Math.PI / 2 - 2e-3);
  capPoint(side, theta, aa, p);
  capPoint(side, theta + e, aa, pt).sub(p);
  capPoint(side, theta, aa + e, pa).sub(p);
  out.crossVectors(pt, pa).normalize();
  if (out.dot(p.setY(p.y + side * 0.2)) < 0) out.negate();
  return out;
}

function averageNormals(normals, indices) {
  let x = 0, y = 0, z = 0;
  for (const i of indices) { x += normals[i * 3]; y += normals[i * 3 + 1]; z += normals[i * 3 + 2]; }
  const l = Math.hypot(x, y, z) || 1;
  for (const i of indices) { normals[i * 3] = x / l; normals[i * 3 + 1] = y / l; normals[i * 3 + 2] = z / l; }
}

/** Compute normals for a position array + index, then weld seams/poles. */
function normalsFor(positions, index, fixups) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  const n = g.getAttribute('normal').array;
  fixups(n);
  g.dispose();
  return n;
}

/**
 * The shell: one mesh that morphs from a citrus half into a Fruttino cap.
 * Group 0 = outer peel/cap surface, group 1 = the cut face.
 * The morph target keeps exactly the same topology, so the shell literally
 * changes shape instead of being swapped for another model.
 */
export function createShellGeometry(side, { segU = 128, segV = 44, segR = 12 } = {}) {
  const posA = [], posB = [], uv = [], index = [];
  const vA = new THREE.Vector3(), vB = new THREE.Vector3();
  const cols = segU + 1;

  // Outer surface (rim → pole)
  for (let j = 0; j <= segV; j++) {
    const t = j / segV;
    const a = (1 - t) * Math.PI / 2;
    for (let i = 0; i <= segU; i++) {
      const th = (i / segU) * TAU;
      lemonPoint(side, th, a, vA);
      capPoint(side, th, a, vB);
      posA.push(vA.x, vA.y, vA.z);
      posB.push(vB.x, vB.y, vB.z);
      uv.push(i / segU, t);
    }
  }
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * cols + i, b = a + 1, d = a + cols, c = d + 1;
      if (side > 0) index.push(a, d, b, b, d, c);
      else index.push(a, b, d, b, c, d);
    }
  }
  const domeCount = index.length;

  // Cut face (rim → centre). UVs are polar so a round texture maps onto any rim.
  const faceStart = posA.length / 3;
  for (let k = 0; k <= segR; k++) {
    const f = 1 - k / segR;
    for (let i = 0; i <= segU; i++) {
      const th = (i / segU) * TAU;
      lemonPoint(side, th, Math.PI / 2, vA);
      capPoint(side, th, Math.PI / 2, vB);
      posA.push(vA.x * f, 0, vA.z * f);
      posB.push(vB.x * f, 0, vB.z * f);
      uv.push(0.5 + 0.5 * f * Math.cos(th), 0.5 + 0.5 * f * Math.sin(th));
    }
  }
  for (let k = 0; k < segR; k++) {
    for (let i = 0; i < segU; i++) {
      const a = faceStart + k * cols + i, b = a + 1, d = a + cols, c = d + 1;
      if (side > 0) index.push(a, b, d, b, c, d);
      else index.push(a, d, b, b, d, c);
    }
  }
  const faceCount = index.length - domeCount;
  const totalVerts = posA.length / 3;

  const fix = (n) => {
    // seam columns
    for (let j = 0; j <= segV; j++) averageNormals(n, [j * cols, j * cols + segU]);
    // pole ring
    const pole = [];
    for (let i = 0; i <= segU; i++) pole.push(segV * cols + i);
    averageNormals(n, pole);
    // flat face
    for (let v = faceStart; v < totalVerts; v++) {
      n[v * 3] = 0; n[v * 3 + 1] = -side; n[v * 3 + 2] = 0;
    }
  };

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posA, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normalsFor(posA, index, fix), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.morphAttributes.position = [new THREE.Float32BufferAttribute(posB, 3)];
  geo.morphAttributes.normal = [new THREE.Float32BufferAttribute(normalsFor(posB, index, fix), 3)];
  geo.addGroup(0, domeCount, 0);
  geo.addGroup(domeCount, faceCount, 1);
  geo.computeBoundingSphere();
  geo.boundingSphere.radius = 2.4;
  return geo;
}

/** Point on the cream band. phi ∈ [-π/2, π/2] runs bottom-centre → side → top-centre. */
export function creamPoint(theta, phi, compressed, out) {
  const { R, h } = compressed ? DIMS.cream.compressed : DIMS.cream.relaxed;
  const c = Math.max(0, Math.cos(phi)), s = Math.sin(phi);
  const r = Math.pow(c, 0.3);
  const y = Math.sign(s) * Math.pow(Math.abs(s), 0.5);
  const ct = Math.cos(theta), st = Math.sin(theta);
  const n = fbm3(c * ct * 2.2, s * 1.3 + 3.1, c * st * 2.2, 3);
  const n2 = fbm3(c * ct * 6.5 + 2, s * 2.6, c * st * 6.5, 2);
  const bulge = (compressed ? 0.04 : 0.012) * Math.pow(c, 6);
  const kr = 1 + 0.028 * n + 0.012 * n2 + bulge;
  const ky = 1 + 0.06 * n + (compressed ? -0.03 : 0.04) * Math.pow(c, 4);
  return out.set(ct * r * R * kr, y * h * ky, st * r * R * kr);
}

/** The cream band: a soft, irregular filling that morphs from relaxed to compressed. */
export function createCreamGeometry({ segU = 144, segV = 56 } = {}) {
  const posA = [], posB = [], uv = [], index = [];
  const v = new THREE.Vector3();
  const cols = segU + 1;
  for (let j = 0; j <= segV; j++) {
    const phi = -Math.PI / 2 + (j / segV) * Math.PI;
    for (let i = 0; i <= segU; i++) {
      const th = (i / segU) * TAU;
      creamPoint(th, phi, false, v); posA.push(v.x, v.y, v.z);
      creamPoint(th, phi, true, v); posB.push(v.x, v.y, v.z);
      uv.push(i / segU, j / segV);
    }
  }
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * cols + i, b = a + 1, d = a + cols, c = d + 1;
      index.push(a, d, b, b, d, c);
    }
  }
  const fix = (n) => {
    for (let j = 0; j <= segV; j++) averageNormals(n, [j * cols, j * cols + segU]);
    const bottom = [], top = [];
    for (let i = 0; i <= segU; i++) { bottom.push(i); top.push(segV * cols + i); }
    averageNormals(n, bottom);
    averageNormals(n, top);
  };
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posA, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normalsFor(posA, index, fix), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.morphAttributes.position = [new THREE.Float32BufferAttribute(posB, 3)];
  geo.morphAttributes.normal = [new THREE.Float32BufferAttribute(normalsFor(posB, index, fix), 3)];
  geo.computeBoundingSphere();
  return geo;
}

/**
 * A soft blob (the pulp mass). Two lumpy variants are stored as base + morph
 * target so the surface can "breathe" deterministically with the story.
 */
export function createBlobGeometry(detail = 5) {
  let geo = new THREE.IcosahedronGeometry(1, detail);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  const pos = geo.getAttribute('position');
  const a = new Float32Array(pos.count * 3), b = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const ka = 1 + 0.09 * fbm3(v.x * 1.7, v.y * 1.7, v.z * 1.7, 3);
    const kb = 1 + 0.09 * fbm3(v.x * 1.7 + 9.1, v.y * 1.7 - 3.3, v.z * 1.7 + 5.2, 3);
    a.set([v.x * ka, v.y * ka, v.z * ka], i * 3);
    b.set([v.x * kb, v.y * kb, v.z * kb], i * 3);
  }
  const index = Array.from(geo.index.array);
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(a, 3));
  out.setIndex(index);
  out.computeVertexNormals();
  const tmp = new THREE.BufferGeometry();
  tmp.setAttribute('position', new THREE.BufferAttribute(b, 3));
  tmp.setIndex(index);
  tmp.computeVertexNormals();
  out.morphAttributes.position = [new THREE.BufferAttribute(b, 3)];
  out.morphAttributes.normal = [tmp.getAttribute('normal')];
  tmp.dispose();
  geo.dispose();
  out.computeBoundingSphere();
  out.boundingSphere.radius = 1.2;
  return out;
}

/** A 3D teardrop (water drop) via lathe, tip up. Height ≈ 1, width ≈ 0.6. */
export function createDropGeometry(segments = 40, N = 36) {
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N; // 0 = bottom, 1 = tip
    const ang = t * Math.PI;
    // rounded bottom that tapers into a soft point
    const r = 0.3 * Math.sin(ang) * Math.pow(1 - t, 0.55) * 1.18;
    const y = -0.36 + t * 1.0 - 0.14 * Math.sin(ang * 0.5) * (1 - t);
    pts.push(new THREE.Vector2(Math.max(r, 1e-4), y));
  }
  pts[0].x = 0; pts[N].x = 0;
  const geo = new THREE.LatheGeometry(pts, segments);
  geo.computeVertexNormals();
  return geo;
}

/** A small citrus vesicle (pulp piece): elongated teardrop. */
export function createVesicleGeometry() {
  const geo = new THREE.SphereGeometry(1, 18, 12);
  const pos = geo.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const taper = v.y > 0 ? 1 - 0.55 * v.y * v.y : 1 - 0.1 * v.y * v.y;
    pos.setXYZ(i, v.x * 0.55 * taper, v.y * 1.1, v.z * 0.55 * taper);
  }
  geo.computeVertexNormals();
  return geo;
}

/** An irregular sugar crystal. */
export function createCrystalGeometry() {
  const geo = new THREE.OctahedronGeometry(1, 0);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) * 1.0, pos.getY(i) * 0.8, pos.getZ(i) * 0.9);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Flat "graphic" half lemon slice from Reference 1: an arc band + five wedges. */
export function createSliceIconGeometries({ R = 0.84, band = 0.13, gap = 0.06, depth = 0.06 } = {}) {
  const extrude = { depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.016, bevelSegments: 3, curveSegments: 32 };
  const arc = new THREE.Shape();
  arc.absarc(0, 0, R, 0, Math.PI, false);
  arc.lineTo(-(R - band), 0);
  arc.absarc(0, 0, R - band, Math.PI, 0, true);
  arc.lineTo(R, 0);
  const arcGeo = new THREE.ExtrudeGeometry(arc, extrude);
  arcGeo.translate(0, 0, -depth / 2);

  const wedges = [];
  const inner = 0.1, outer = R - band - gap * 0.9;
  for (let k = 0; k < 5; k++) {
    const a0 = (k / 5) * Math.PI + gap * 0.9 / (outer * 0.8);
    const a1 = ((k + 1) / 5) * Math.PI - gap * 0.9 / (outer * 0.8);
    const s = new THREE.Shape();
    const ai0 = (k / 5) * Math.PI + gap * 0.5 / inner * 0.35;
    const ai1 = ((k + 1) / 5) * Math.PI - gap * 0.5 / inner * 0.35;
    s.moveTo(Math.cos(ai0) * inner, Math.sin(ai0) * inner + gap * 0.3);
    s.lineTo(Math.cos(a0) * outer, Math.sin(a0) * outer);
    s.absarc(0, 0, outer, a0, a1, false);
    s.lineTo(Math.cos(ai1) * inner, Math.sin(ai1) * inner + gap * 0.3);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { ...extrude, bevelSize: 0.012, curveSegments: 12 });
    // centre each wedge on its own centroid so it can tumble freely
    const mid = (a0 + a1) / 2, rc = (inner + outer) * 0.52;
    const cx = Math.cos(mid) * rc, cy = Math.sin(mid) * rc;
    g.translate(-cx, -cy, -depth / 2);
    wedges.push({ geometry: g, center: new THREE.Vector3(cx, cy, 0), angle: mid });
  }
  return { arcGeo, wedges };
}

export const SPOON = { rx: 0.5, ry: 0.3, depth: 0.15 };

/**
 * The spoon from Reference 1, now a real 3D spoon: a concave bowl (opening
 * towards local +z, tip at local +x) and a long, flattened handle along -x.
 * Seen front-on in scene 1 its silhouette matches the graphic spoon.
 */
export function createScoopSpoonGeometry() {
  const { rx, ry, depth } = SPOON;
  // bowl: an elliptical cup, z = -depth at the centre, 0 at the rim
  const U = 14, M = 56;
  const pos = [], uv = [], index = [];
  for (let j = 0; j <= U; j++) {
    const u = j / U;
    for (let i = 0; i <= M; i++) {
      const a = (i / M) * TAU;
      pos.push(rx * u * Math.cos(a), ry * u * Math.sin(a), -depth * (1 - u * u));
      uv.push(i / M, u);
    }
  }
  for (let j = 0; j < U; j++) {
    for (let i = 0; i < M; i++) {
      const p0 = j * (M + 1) + i, p1 = p0 + 1, p2 = p0 + M + 1, p3 = p2 + 1;
      index.push(p0, p2, p1, p1, p2, p3);
    }
  }
  const bowl = new THREE.BufferGeometry();
  bowl.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  bowl.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  bowl.setIndex(index);
  bowl.computeVertexNormals();

  // handle: a gently rising, flattened tube with a rounded end
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-rx * 0.94, 0, 0.0),
    new THREE.Vector3(-1.2, 0.015, 0.02),
    new THREE.Vector3(-2.5, 0.045, 0.02),
    new THREE.Vector3(-3.8, 0.08, 0.0),
  ]);
  const handle = new THREE.TubeGeometry(curve, 64, 0.065, 12, false);
  handle.scale(1, 1, 0.45);
  const end = new THREE.SphereGeometry(0.065, 12, 8);
  end.scale(1, 1, 0.45);
  end.translate(-3.8, 0.08, 0);

  const geo = mergeGeometries([bowl, handle, end]);
  bowl.dispose(); handle.dispose(); end.dispose();
  geo.computeBoundingSphere();
  return geo;
}

/** A leaf: shaped outline, folded along the midrib and gently curled. */
export function createLeafGeometry(length = 0.62, width = 0.26) {
  const geo = new THREE.PlaneGeometry(length, width, 24, 8);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i);
    const t = x / length + 0.5; // 0 = base, 1 = tip
    const outline = Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(Math.min(Math.max(t, 0), 1), 0.8))), 0.75);
    y *= outline;
    const fold = Math.abs(y) * 0.35;
    const curl = Math.pow(t, 2) * 0.12;
    pos.setXYZ(i, x + length / 2, y, fold - curl);
  }
  geo.computeVertexNormals();
  return geo;
}
