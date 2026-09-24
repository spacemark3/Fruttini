import { gsap } from 'gsap';

/**
 * Render-on-demand loop on GSAP's ticker (the same clock that drives the
 * timeline). A frame is drawn only when something invalidated the view.
 */
export class RenderLoop {
  constructor(renderFn) {
    this.renderFn = renderFn;
    this.dirty = true;
    this.tick = () => {
      if (!this.dirty) return;
      this.dirty = false;
      this.renderFn();
    };
    gsap.ticker.add(this.tick);
  }

  invalidate() {
    this.dirty = true;
  }

  stop() {
    gsap.ticker.remove(this.tick);
  }
}
