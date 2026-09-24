import { gsap } from 'gsap';
import { SCENES, CAPTION_TIMING } from '../animation/storyConfig.js';
import { PALETTE } from '../utils/materials.js';

/**
 * Typography and background of the story. All of it is tweened inside the
 * master timeline, so text is always in sync with the 3D and reverses with it.
 */
export class StoryOverlay {
  constructor(root) {
    this.root = root;
    this.card = root.querySelector('#card');
    this.mark = root.querySelector('#watermark');
    this.ingredients = root.querySelector('#ingredients');
    this.ingLines = [...root.querySelectorAll('#ingredients [data-line]')];
    this.finale = root.querySelector('#finale');
    this.finaleParts = [...root.querySelectorAll('#finale [data-part]')];
    this.chapterWrap = root.querySelector('#chapters');
    this.chapters = SCENES.filter((s) => s.caption).map((scene) => {
      const el = document.createElement('div');
      el.className = 'chapter';
      // text is filled in (and swapped on language change) by I18n.apply()
      el.innerHTML = `<span class="chapter-num">${scene.num}</span><span class="chapter-title" data-i18n="scene.${scene.id}.title"></span><span class="chapter-caption" data-i18n="scene.${scene.id}.caption"></span>`;
      this.chapterWrap.appendChild(el);
      return { el, scene };
    });
  }

  /** @param {gsap.core.Timeline} tl */
  build(tl) {
    gsap.set(this.chapters.map((c) => c.el), { autoAlpha: 0, y: 14 });
    gsap.set(this.finaleParts, { autoAlpha: 0, y: 24 });
    gsap.set(this.card, { '--bg-a': PALETTE.sky, '--bg-b': PALETTE.skyDeep });
    gsap.set(this.mark, { '--mark': 'rgba(255, 255, 255, 0.5)', '--mk': 0, '--rise': 40, autoAlpha: 0 });

    // "INGREDIENTI" panel: leaves line by line as the ingredients come to life
    this.ingLines.forEach((el, i) => {
      tl.to(el, { autoAlpha: 0, x: 36, filter: 'blur(4px)', duration: 0.035, ease: 'power1.in' }, 0.1 + i * 0.008);
    });

    // chapter captions: on screen for (almost) the whole chapter, so each
    // title can be read in the time its part of the animation takes.
    // The first one is already visible on the opening frame.
    const { fade, lead, tail } = CAPTION_TIMING;
    this.chapters.forEach(({ el, scene }, i) => {
      if (i === 0) gsap.set(el, { autoAlpha: 1, y: 0 });
      else tl.to(el, { autoAlpha: 1, y: 0, duration: fade, ease: 'power2.out' }, scene.start + lead);
      tl.to(el, { autoAlpha: 0, y: -14, duration: fade, ease: 'power2.in' }, scene.end - tail - fade);
    });

    // background: pastel sky → warm beige
    // (via a pale ivory, so the blend never passes through a muddy grey-green)
    tl.to(this.card, { '--bg-a': '#f4f2ec', '--bg-b': '#e6ebe8', duration: 0.05, ease: 'sine.in' }, 0.8);
    tl.to(this.card, { '--bg-a': PALETTE.beigeLight, '--bg-b': PALETTE.beige, duration: 0.05, ease: 'sine.out' }, 0.85);
    // the background claim: hidden until chapter 05 (L’Assemblaggio), then it
    // rises in behind the closing Fruttino and stays through the finale
    const assembly = SCENES.find((sc) => sc.id === 'assembly');
    tl.to(this.mark, { autoAlpha: 1, '--rise': 0, duration: 0.04, ease: 'power2.out' }, assembly.start);
    // white on the sky, a soft bordeaux on the beige
    tl.to(this.mark, { '--mark': 'rgba(139, 26, 31, 0.17)', '--mk': 1, duration: 0.1, ease: 'sine.inOut' }, 0.8);

    // finale
    this.finaleParts.forEach((el, i) => {
      tl.to(el, { autoAlpha: 1, y: 0, duration: 0.045, ease: 'power2.out' }, 0.9 + i * 0.022);
    });
  }
}
