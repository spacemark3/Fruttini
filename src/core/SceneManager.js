import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Owns the renderer, the scene, the studio environment map and the viewport.
 * The canvas is transparent: the background colour lives in CSS so it can be
 * blended with the page frame (pastel sky → warm beige).
 */
export class SceneManager {
  constructor(canvas, container) {
    this.canvas = canvas;
    this.container = container;
    this.isMobile = matchMedia('(pointer: coarse)').matches;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 120);
    this.size = { width: 1, height: 1 };
    this.resizeListeners = new Set();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  get layout() {
    return this.size.width / this.size.height < 0.85 ? 'portrait' : 'landscape';
  }

  onResize(fn) {
    this.resizeListeners.add(fn);
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (width === this.size.width && height === this.size.height) return;
    this.size = { width, height };
    const maxDpr = this.isMobile ? 1.75 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.resizeListeners.forEach((fn) => fn(this.size));
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.resizeObserver.disconnect();
    this.envTexture.dispose();
    this.renderer.dispose();
  }
}
