import { gsap } from 'gsap';

/**
 * Plays the story on its own. A single GSAP tween moves `storyProgress`
 * from its current value to 1 in real time; the story timeline is seeked
 * from it, so play, pause and replay all share the same deterministic state.
 */
export class AutoPlayController {
  constructor({ story, duration, onStateChange = () => {} }) {
    this.story = story;
    this.duration = duration;
    this.onStateChange = onStateChange;
    this.proxy = { value: story.progress };
    this.tween = null;
    this.playing = false;
  }

  setPlaying(v) {
    if (this.playing === v) return;
    this.playing = v;
    this.onStateChange(v);
  }

  kill() {
    this.tween?.kill();
    this.tween = null;
  }

  /** Play from the current position to the end. */
  play() {
    if (this.story.progress >= 0.999) return this.replay();
    this.kill();
    this.proxy.value = this.story.progress;
    this.tween = gsap.to(this.proxy, {
      value: 1,
      duration: (1 - this.proxy.value) * this.duration,
      ease: 'none',
      onUpdate: () => this.story.setProgress(this.proxy.value),
      onComplete: () => this.setPlaying(false),
    });
    this.setPlaying(true);
  }

  pause() {
    this.kill();
    this.setPlaying(false);
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  /**
   * Rewind — the Fruttino visibly comes apart as the timeline runs backwards —
   * then play the story again from the beginning.
   */
  replay({ rewind = true } = {}) {
    this.kill();
    this.setPlaying(true);
    if (!rewind) {
      this.story.setProgress(0);
      this.play();
      return;
    }
    this.proxy.value = this.story.progress;
    this.tween = gsap.to(this.proxy, {
      value: 0,
      duration: 2.6,
      ease: 'power2.inOut',
      onUpdate: () => this.story.setProgress(this.proxy.value),
      onComplete: () => {
        this.tween = gsap.delayedCall(0.8, () => this.play());
      },
    });
  }
}
