import { gsap } from 'gsap';
import { CHANNELS, SHOT_TIMES } from './storyConfig.js';

export function createInitialState() {
  const s = { shot: 0 };
  for (const [name] of CHANNELS) s[name] = 0;
  return s;
}

/**
 * The master timeline. A paused GSAP timeline of length 1 whose tweens drive
 * plain numeric "channels" (and the DOM typography). Seeking it with
 * `setProgress(storyProgress)` is the ONLY way the story moves: playback,
 * pause and the replay rewind all end up here, and because every tween is
 * seekable the same progress always yields the same frame, in both directions.
 */
export class StoryTimeline {
  constructor({ onUpdate }) {
    this.state = createInitialState();
    this.onUpdate = onUpdate;
    this.progress = 0;
    this.tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });

    for (const [name, start, end, ease] of CHANNELS) {
      this.tl.to(this.state, { [name]: 1, duration: end - start, ease }, start);
    }

    // camera: shot 0 → 1 → … (the controller smooths between keyframes)
    for (let i = 1; i < SHOT_TIMES.length; i++) {
      const t0 = SHOT_TIMES[i - 1], t1 = SHOT_TIMES[i];
      this.tl.to(this.state, { shot: i, duration: t1 - t0, ease: i === 1 ? 'power2.inOut' : 'none' }, t0);
    }
  }

  /** Lets the UI add its DOM tweens to the same timeline. */
  add(fn) {
    fn(this.tl);
  }

  /** Must be called once all tweens are registered. */
  finalize() {
    // force the timeline to be exactly 1 long, then record every tween's start values
    this.tl.set({}, {}, 1);
    this.tl.progress(1, true).progress(0, true);
    this.setProgress(0, true);
  }

  setProgress(p, force = false) {
    if (!Number.isFinite(p)) return; // never seek to NaN: it would scramble every channel
    const v = Math.min(1, Math.max(0, p));
    if (!force && v === this.progress) return;
    this.progress = v;
    this.tl.progress(v);
    this.onUpdate(this.state, v);
  }

  /** Re-apply the current frame (e.g. after a resize). */
  refresh() {
    this.onUpdate(this.state, this.progress);
  }
}
