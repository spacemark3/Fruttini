import './styles/main.css';
import { gsap } from 'gsap';

import { SceneManager } from './core/SceneManager.js';
import { CameraController } from './core/CameraController.js';
import { LightingManager } from './core/LightingManager.js';
import { RenderLoop } from './core/RenderLoop.js';
import { StoryWorld } from './objects/StoryWorld.js';
import { StoryTimeline } from './animation/StoryTimeline.js';
import { AutoPlayController } from './animation/AutoPlayController.js';
import { AUTOPLAY_DURATION, AUTOPLAY_START_DELAY } from './animation/storyConfig.js';
import { StoryOverlay } from './ui/StoryOverlay.js';
import { NavigationControls } from './ui/NavigationControls.js';
import { I18n } from './i18n/I18n.js';

// A cheap check only: creating a throwaway WebGL context just to test support
// costs real time. If the renderer can't start, init() throws and the static
// page is shown instead.
const webglAvailable = () => typeof window.WebGL2RenderingContext === 'function';

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The loading screen (styled inline in index.html, so it is painted before
 * anything else). It covers the page until the scene, its shaders and the
 * fonts are ready, then fades out.
 */
const loader = {
  el: document.getElementById('loader'),
  shownAt: performance.now(),
  set(p) {
    this.el?.style.setProperty('--load', String(p));
  },
  async done(i18n) {
    this.set(1);
    // let the bar finish, and never flash the loader for just a few frames
    await wait(Math.max(300, 700 - (performance.now() - this.shownAt)));
    document.documentElement.classList.add('is-ready');
    if (this.el) {
      this.el.setAttribute('aria-busy', 'false');
      const label = this.el.querySelector('[data-i18n]');
      if (label && i18n) label.textContent = i18n.t('loaded');
      setTimeout(() => this.el.remove(), 900);
    }
  },
};

async function init() {
  // language first: the static fallback is translated too
  const i18n = new I18n(document);
  i18n.apply();
  loader.set(0.12);

  if (!webglAvailable()) {
    document.documentElement.classList.add('no-webgl');
    await loader.done(i18n);
    return;
  }
  // wait for a frame between the heavy steps so the loader can repaint
  await nextFrame();

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the 3D viewport sits inside the card, just below the header's curtain
  const viewport = document.getElementById('viewport');
  const canvas = document.getElementById('webgl');

  // --- rendering ------------------------------------------------------------
  const sceneManager = new SceneManager(canvas, viewport);
  const lighting = new LightingManager(sceneManager.scene);
  const cameraController = new CameraController(sceneManager.camera);
  cameraController.setViewport(sceneManager.size);
  loader.set(0.3);
  await nextFrame();
  const world = new StoryWorld(sceneManager.scene); // procedural geometry + textures
  loader.set(0.6);
  await nextFrame();
  const loop = new RenderLoop(() => sceneManager.render());

  // --- UI -------------------------------------------------------------------
  let autoplay;
  const nav = new NavigationControls(document, {
    i18n,
    onTogglePlay: () => autoplay.toggle(),
    onReplay: () => autoplay.replay({ rewind: !reducedMotion }),
  });
  const overlay = new StoryOverlay(document);

  // --- the story: one timeline, one progress value --------------------------
  const story = new StoryTimeline({
    onUpdate: (state, p) => {
      world.update(state, p);
      lighting.update(state.light, state.warm);
      cameraController.apply(state.shot, sceneManager.layout);
      nav.setProgress(p);
      loop.invalidate();
    },
  });
  story.add((tl) => overlay.build(tl));
  i18n.apply(); // fills the chapter captions and indicators just created

  // Compile every shader up front — including objects that only appear later
  // in the story (compile() skips hidden objects) — so no scene hitches.
  // The first story update right after restores each object's real visibility.
  loader.set(0.75);
  await nextFrame();
  const { renderer } = sceneManager;
  sceneManager.scene.traverse((o) => {
    o.visible = true;
    // upload textures now rather than on the frame an object first appears
    [].concat(o.material || []).forEach((m) => Object.values(m).forEach((v) => v?.isTexture && renderer.initTexture(v)));
  });
  // compiled asynchronously (KHR_parallel_shader_compile where available), so
  // the page stays responsive and the loader keeps animating meanwhile
  await renderer.compileAsync(sceneManager.scene, sceneManager.camera);
  loader.set(0.85);
  await nextFrame();
  sceneManager.render(); // one real frame also builds the shadow-pass shader variants
  story.finalize();
  loader.set(0.9);

  // the display fonts, so the titles don't swap typeface mid-story (bounded wait)
  if (document.fonts?.ready) await Promise.race([document.fonts.ready, wait(2500)]);

  autoplay = new AutoPlayController({
    story,
    duration: AUTOPLAY_DURATION,
    onStateChange: (playing) => nav.setPlaying(playing),
  });

  sceneManager.onResize((size) => {
    cameraController.setViewport(size);
    story.refresh();
  });

  if (import.meta.env.DEV) window.__fruttino = { story, autoplay, sceneManager, world, i18n };

  await loader.done(i18n);

  // The story plays by itself after a brief look at the opening composition
  // (counted from when the loader has gone). With reduced motion it waits for
  // the visitor to press "Riproduci".
  if (!reducedMotion) gsap.delayedCall(AUTOPLAY_START_DELAY / 1000, () => autoplay.play());

}

init().catch((err) => {
  // something failed while building the 3D story: show the static page instead
  console.error(err);
  document.documentElement.classList.add('no-webgl');
  loader.done();
});
