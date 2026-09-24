import * as THREE from 'three';
import { makeRandom, noise3 } from './math.js';

// ---------------------------------------------------------------------------
// Palette (sampled from the references)
// ---------------------------------------------------------------------------
export const PALETTE = {
  sky: '#acd8e5',        // Reference 1 background
  skyDeep: '#9fd0df',
  ivory: '#fdf6ee',      // page / graphic elements
  cream: '#fff6e8',      // graphic icons
  beige: '#e7ddd0',      // Reference 2 background
  beigeLight: '#efe7dc',
  bordeaux: '#8b1a1f',
  lemon: '#e8b21f',
  orange: '#f08526',
  gold: '#f6a23a',
  pulp: '#f59a2c',
  creamWhite: '#fbf8f1',
  leaf: '#3f6a34',
};

// ---------------------------------------------------------------------------
// Procedural canvas textures (generated once, deterministic seeds)
// ---------------------------------------------------------------------------
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { srgb = true, repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  else t.wrapS = THREE.RepeatWrapping; // wrap around the dome
  t.needsUpdate = true;
  return t;
}

/**
 * Low-frequency colour mottling (seamless in U). The noise is only
 * low-frequency, so it is computed on a canvas 4× smaller and scaled up with
 * smoothing: same look, ~16× less work at load time.
 */
function mottle(ctx, w, h, base, variation, scale, seed, down = 4) {
  const sw = Math.ceil(w / down), sh = Math.ceil(h / down);
  const [small, sctx] = canvas(sw, sh);
  const img = sctx.createImageData(sw, sh);
  const d = img.data;
  const [r0, g0, b0] = base;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const u = (x / sw) * Math.PI * 2;
      const n = noise3(Math.cos(u) * scale + seed, Math.sin(u) * scale, (y / sh) * scale * 1.2)
        + 0.5 * noise3(Math.cos(u) * scale * 3, Math.sin(u) * scale * 3 + seed, (y / sh) * scale * 3.6);
      const i = (y * sw + x) * 4;
      d[i] = r0 + n * variation[0];
      d[i + 1] = g0 + n * variation[1];
      d[i + 2] = b0 + n * variation[2];
      d[i + 3] = 255;
    }
  }
  sctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, w, h);
}

function dots(ctx, w, h, count, rng, { rMin, rMax, colors, alpha = [0.4, 0.9] }) {
  for (let i = 0; i < count; i++) {
    const x = rng.next() * w, y = rng.next() * h;
    const r = rng.range(rMin, rMax);
    ctx.globalAlpha = rng.range(alpha[0], alpha[1]);
    ctx.fillStyle = rng.pick(colors);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * rng.range(0.7, 1), rng.next() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

let cache = null;

export function getTextures() {
  if (cache) return cache;
  const W = 1024, H = 512;

  // Lemon rind (Reference 1): warm yellow, faint green patches, dense oil pores
  const [lc, lx] = canvas(W, H);
  mottle(lx, W, H, [234, 182, 30], [18, 16, 10], 2.2, 1.7);
  const patches = makeRandom(13);
  for (let i = 0; i < 26; i++) {
    const x = patches.next() * W, y = patches.next() * H, r = patches.range(40, 140);
    const tint = patches.pick(['168,164,40', '214,150,20', '246,206,70']);
    const g = lx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${tint},0.16)`);
    g.addColorStop(1, `rgba(${tint},0)`);
    lx.fillStyle = g;
    lx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  dots(lx, W, H, 22000, makeRandom(11), { rMin: 0.5, rMax: 1.3, colors: ['#c98f0f', '#d9a116', '#b97e08'], alpha: [0.3, 0.6] });
  dots(lx, W, H, 6000, makeRandom(12), { rMin: 0.4, rMax: 0.9, colors: ['#fbe38a', '#fff0b0'], alpha: [0.3, 0.6] });
  const lemonMap = toTexture(lc);

  // Sugared orange cap (Reference 2): orange/golden with fine sugar specks
  const [oc, ox] = canvas(W, H);
  mottle(ox, W, H, [236, 116, 18], [16, 18, 8], 2.6, 5.3);
  // subtle golden gradient toward the pole
  const grad = ox.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(226,98,10,0.25)');
  grad.addColorStop(1, 'rgba(246,150,40,0.25)');
  ox.fillStyle = grad; ox.fillRect(0, 0, W, H);
  dots(ox, W, H, 7000, makeRandom(23), { rMin: 0.5, rMax: 1.5, colors: ['#cf5a10', '#f79a3a'], alpha: [0.25, 0.55] });
  dots(ox, W, H, 16000, makeRandom(29), { rMin: 0.4, rMax: 1.0, colors: ['#ffe7c8', '#ffd6a6', '#fff4e6'], alpha: [0.25, 0.6] });
  const sugarMap = toTexture(oc);

  // Whole orange peel (the fruit in the final still life)
  const [pc, px] = canvas(512, 256);
  mottle(px, 512, 256, [240, 132, 24], [14, 16, 8], 2.4, 9.1);
  dots(px, 512, 256, 5000, makeRandom(41), { rMin: 0.4, rMax: 1.2, colors: ['#d56a10', '#fba44a'], alpha: [0.3, 0.6] });
  const peelMap = toTexture(pc);

  // Shared micro relief: pores (dark) + grains (bright)
  const [bc, bx] = canvas(W, H);
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, W, H);
  dots(bx, W, H, 9000, makeRandom(51), { rMin: 0.8, rMax: 2.0, colors: ['#4a4a4a', '#5a5a5a'], alpha: [0.5, 0.9] });
  dots(bx, W, H, 14000, makeRandom(53), { rMin: 0.5, rMax: 1.4, colors: ['#e8e8e8', '#ffffff'], alpha: [0.6, 1] });
  const bumpMap = toTexture(bc, { srgb: false });

  // Cut face of the citrus: rind edge, white pith (albedo), ten juicy
  // segments full of vesicles, membranes and a pithy core. The same strokes
  // go into a relief map so the flesh catches the light.
  const S = 1024;
  const [fc, fx] = canvas(S, S);
  const [rc, rx] = canvas(S, S);
  const cx = S / 2, R = S / 2;
  const both = (fn) => { fn(fx, true); fn(rx, false); };
  rx.fillStyle = '#707070'; rx.fillRect(0, 0, S, S);
  const rind = fx.createRadialGradient(cx, cx, R * 0.9, cx, cx, R);
  rind.addColorStop(0, '#f0c53a'); rind.addColorStop(1, '#d1900e');
  fx.fillStyle = rind; fx.fillRect(0, 0, S, S);
  both((c, col) => {
    const g = c.createRadialGradient(cx, cx, R * 0.84, cx, cx, R * 0.955);
    g.addColorStop(0, col ? '#f7ecc6' : '#9a9a9a');
    g.addColorStop(1, col ? '#fdf7e2' : '#8a8a8a');
    c.fillStyle = g;
    c.beginPath(); c.arc(cx, cx, R * 0.955, 0, Math.PI * 2); c.fill();
  });
  const seg = makeRandom(61);
  const segs = 10;
  const widths = Array.from({ length: segs }, () => seg.range(0.8, 1.2));
  const total = widths.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let k = 0; k < segs; k++) {
    const a0 = (acc / total) * Math.PI * 2 + 0.028;
    acc += widths[k];
    const a1 = (acc / total) * Math.PI * 2 - 0.028;
    const mid = (a0 + a1) / 2;
    const outer = R * seg.range(0.83, 0.86);
    const wedge = (c) => {
      c.beginPath();
      c.moveTo(cx + Math.cos(mid) * R * 0.075, cx + Math.sin(mid) * R * 0.075);
      c.arc(cx, cx, outer, a0, a1);
      c.closePath();
    };
    const g = fx.createRadialGradient(cx, cx, R * 0.08, cx, cx, outer);
    g.addColorStop(0, '#fbe68e'); g.addColorStop(0.55, '#f6d24c'); g.addColorStop(1, '#efbf2e');
    fx.fillStyle = g; wedge(fx); fx.fill();
    rx.fillStyle = '#6a6a6a'; wedge(rx); rx.fill();
    // vesicles: elongated juice sacs radiating from the centre
    fx.save(); wedge(fx); fx.clip();
    rx.save(); wedge(rx); rx.clip();
    for (let i = 0; i < 420; i++) {
      const ang = seg.range(a0, a1), rad = R * seg.range(0.1, 0.86);
      const x = cx + Math.cos(ang) * rad, y = cx + Math.sin(ang) * rad;
      const len = seg.range(10, 30) * (0.5 + rad / R), wid = seg.range(3, 6.5);
      const rot = ang + seg.signed() * 0.18;
      fx.globalAlpha = seg.range(0.25, 0.65);
      fx.fillStyle = seg.pick(['#fff1a6', '#fbdf6a', '#f2c233', '#fff8cf']);
      fx.beginPath(); fx.ellipse(x, y, len, wid, rot, 0, Math.PI * 2); fx.fill();
      rx.globalAlpha = seg.range(0.4, 0.9);
      rx.fillStyle = seg.pick(['#c8c8c8', '#e6e6e6', '#9c9c9c']);
      rx.beginPath(); rx.ellipse(x, y, len, wid, rot, 0, Math.PI * 2); rx.fill();
    }
    fx.restore(); rx.restore();
    fx.globalAlpha = 1; rx.globalAlpha = 1;
    // a pale seed in a few segments
    if (k % 3 === 0) {
      const sr = R * seg.range(0.2, 0.3);
      const sx = cx + Math.cos(mid) * sr, sy = cx + Math.sin(mid) * sr;
      both((c, col) => {
        c.fillStyle = col ? '#f4ead0' : '#d0d0d0';
        c.beginPath(); c.ellipse(sx, sy, R * 0.045, R * 0.018, mid, 0, Math.PI * 2); c.fill();
      });
    }
  }
  // pithy core
  both((c, col) => {
    c.fillStyle = col ? '#fbf3dc' : '#a8a8a8';
    c.beginPath(); c.arc(cx, cx, R * 0.075, 0, Math.PI * 2); c.fill();
  });
  const fleshMap = new THREE.CanvasTexture(fc);
  fleshMap.colorSpace = THREE.SRGBColorSpace;
  fleshMap.anisotropy = 8;
  const fleshBump = new THREE.CanvasTexture(rc);
  fleshBump.anisotropy = 8;

  // Cream relief: soft, low-contrast swirls
  // (noise computed at half resolution and scaled up: it is soft anyway)
  const [cs, csx] = canvas(256, 128);
  const img = csx.createImageData(256, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) {
    const u = (x / 256) * Math.PI * 2;
    const n = noise3(Math.cos(u) * 5, Math.sin(u) * 5, y / 128 * 6) * 0.6 + noise3(Math.cos(u) * 16, Math.sin(u) * 16, y / 128 * 18) * 0.4;
    const v = 128 + n * 70;
    const i = (y * 256 + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  csx.putImageData(img, 0, 0);
  const [cc, cxx] = canvas(512, 256);
  cxx.imageSmoothingQuality = 'high';
  cxx.drawImage(cs, 0, 0, 512, 256);
  const creamBump = toTexture(cc, { srgb: false });

  // Soft contact shadow
  const [sc, sx] = canvas(256, 256);
  const sg = sx.createRadialGradient(128, 128, 0, 128, 128, 128);
  sg.addColorStop(0, 'rgba(70,45,25,0.85)');
  sg.addColorStop(0.35, 'rgba(70,45,25,0.45)');
  sg.addColorStop(0.7, 'rgba(70,45,25,0.1)');
  sg.addColorStop(1, 'rgba(70,45,25,0)');
  sx.fillStyle = sg; sx.fillRect(0, 0, 256, 256);
  const shadowMap = new THREE.CanvasTexture(sc);
  shadowMap.colorSpace = THREE.SRGBColorSpace;

  cache = { lemonMap, sugarMap, peelMap, bumpMap, fleshMap, fleshBump, creamBump, shadowMap };
  return cache;
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

/**
 * Shell surface: one physical material that blends the lemon rind into the
 * sugared orange cap (uMorph) and adds the white sugar veil on top (uVeil).
 */
export function createShellMaterial() {
  const tx = getTextures();
  const uniforms = {
    uLemonMap: { value: tx.lemonMap },
    uMorph: { value: 0 },
    uVeil: { value: 0 },
    uGrain: { value: tx.bumpMap },
  };
  const mat = new THREE.MeshPhysicalMaterial({
    map: tx.sugarMap,
    bumpMap: tx.bumpMap,
    bumpScale: 1.4,
    roughness: 0.6,
    metalness: 0,
    sheen: 0.25,
    sheenRoughness: 0.8,
    clearcoat: 0.3,
    clearcoatRoughness: 0.35,
    sheenColor: new THREE.Color('#ffd9b0'),
    envMapIntensity: 0.65,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vUpY;')
      .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\nvUpY = normalize(mat3(modelMatrix) * objectNormal).y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vUpY;
        uniform sampler2D uLemonMap;
        uniform sampler2D uGrain;
        uniform float uMorph;
        uniform float uVeil;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 lemonCol = texture2D(uLemonMap, vMapUv).rgb;
        diffuseColor.rgb = mix(lemonCol, diffuseColor.rgb, uMorph);
        float grain = texture2D(uGrain, vMapUv * 1.0).r;
        float veil = smoothstep(0.05, 0.95, vUpY) * uVeil;
        veil *= 0.55 + 0.45 * smoothstep(0.35, 0.75, grain);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.975, 0.94), veil * 0.62);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.42, 0.68, uMorph) + veil * 0.12;`);
  };
  mat.customProgramCacheKey = () => 'fruttino-shell';
  mat.userData.uniforms = uniforms;
  return mat;
}

/**
 * Cut face of the shell: juicy citrus flesh (wet clearcoat + vesicle relief)
 * that fills with orange pulp (uPulp). uMarks holds up to two spoon scoops
 * (uv centre, radius, amount), drawn as shaded hollows in the flesh.
 */
export function createFaceMaterial() {
  const tx = getTextures();
  const uniforms = {
    uPulp: { value: 0 },
    uPulpColor: { value: new THREE.Color('#ec7c20') },
    uMarks: { value: [new THREE.Vector4(0.5, 0.5, 0.1, 0), new THREE.Vector4(0.5, 0.5, 0.1, 0)] },
  };
  const mat = new THREE.MeshPhysicalMaterial({
    map: tx.fleshMap,
    bumpMap: tx.fleshBump,
    bumpScale: 2.2,
    roughness: 0.38,
    clearcoat: 0.85,
    clearcoatRoughness: 0.22,
    envMapIntensity: 0.8,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uPulp;\nuniform vec3 uPulpColor;\nuniform vec4 uMarks[2];')
      .replace('#include <map_fragment>', `#include <map_fragment>
        for (int i = 0; i < 2; i++) {
          vec4 m = uMarks[i];
          vec2 d = (vMapUv - m.xy) / m.z;
          float r = length(d);
          float inside = (1.0 - smoothstep(0.82, 1.0, r)) * m.w;
          // the rind and white pith ring are never scooped away
          float ring = smoothstep(0.405, 0.425, length(vMapUv - 0.5));
          inside *= 1.0 - ring;
          // fake concavity: the far wall is lit, the near wall falls into shade
          float shade = mix(0.3, 1.0, clamp(0.45 + 0.6 * d.y + 0.25 * d.x, 0.0, 1.0));
          shade *= 0.8 + 0.2 * r; // deepest in the middle
          // scooped down to the pale inside of the peel, a few shreds of flesh left
          vec3 empty = mix(diffuseColor.rgb * 0.85, vec3(0.95, 0.88, 0.7), 0.84);
          vec3 dug = empty * shade * vec3(1.0, 0.95, 0.85);
          // the hollow's walls: occlusion deepening towards the peel
          float wall = smoothstep(0.24, 0.415, length(vMapUv - 0.5));
          dug *= 1.0 - 0.45 * wall;
          diffuseColor.rgb = mix(diffuseColor.rgb, dug, inside);
          // torn, glistening edge of the scoop
          float lip = (smoothstep(0.8, 0.97, r) - smoothstep(0.97, 1.16, r)) * m.w * (1.0 - ring);
          diffuseColor.rgb += lip * vec3(0.3, 0.26, 0.12);
        }
        diffuseColor.rgb = mix(diffuseColor.rgb, uPulpColor * (0.92 + 0.12 * diffuseColor.g), uPulp);`)
      // juicy flesh: a little self-illumination (a cheap stand-in for light
      // scattering inside the fruit) so the cut face never goes muddy in shade
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * 0.24 * (1.0 - 0.75 * uPulp);`);
  };
  mat.customProgramCacheKey = () => 'fruttino-face';
  mat.userData.uniforms = uniforms;
  return mat;
}

export function createCreamMaterial() {
  const tx = getTextures();
  return new THREE.MeshPhysicalMaterial({
    color: PALETTE.creamWhite,
    roughness: 0.6, // worked pulp: matte, softly grainy
    bumpMap: tx.creamBump,
    bumpScale: 1.2,
    sheen: 0.8,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color('#ffffff'),
    clearcoat: 0.12,
    clearcoatRoughness: 0.45,
    emissive: new THREE.Color('#2a2016'),
    emissiveIntensity: 0.18,
    envMapIntensity: 0.7,
  });
}

export function createPulpMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: PALETTE.pulp,
    roughness: 0.28,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
    sheen: 0.4,
    sheenColor: new THREE.Color('#ffd49a'),
    emissive: new THREE.Color('#8a3400'),
    emissiveIntensity: 0.22,
    envMapIntensity: 0.9,
  });
}

export function createGraphicMaterial() {
  // Flat "illustration" cream used by the icons of Reference 1
  return new THREE.MeshStandardMaterial({ color: PALETTE.cream, roughness: 0.85, envMapIntensity: 0.3 });
}

export function createWaterMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: PALETTE.cream,
    roughness: 0.8,
    metalness: 0,
    clearcoat: 0,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 1,
    envMapIntensity: 1.4,
    specularIntensity: 1,
  });
}

export function createSugarMaterial() {
  return new THREE.MeshStandardMaterial({
    color: '#fffaf1',
    roughness: 0.42,
    metalness: 0,
    flatShading: true,
    envMapIntensity: 0.7,
    emissive: new THREE.Color('#3a342c'),
    emissiveIntensity: 0.25,
  });
}
