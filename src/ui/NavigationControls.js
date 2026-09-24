import { SCENES } from '../animation/storyConfig.js';

/**
 * Chapter indicators, play/pause, progress bar, language switch and the
 * replay button. Controls only ask for a state change; they never animate the scene.
 */
export class NavigationControls {
  constructor(root, { i18n, onTogglePlay, onReplay }) {
    this.i18n = i18n;
    this.dotsWrap = root.querySelector('#chapter-dots');
    this.bar = root.querySelector('#progress-bar');
    this.playBtn = root.querySelector('#autoplay');
    this.playLabel = this.playBtn.querySelector('.label');
    this.replayBtn = root.querySelector('#replay');
    this.active = -1;

    this.dots = SCENES.map((scene) => {
      const li = document.createElement('li');
      li.className = 'dot';
      li.innerHTML = `<span class="visually-hidden">${scene.num} <span data-i18n="scene.${scene.id}.title"></span></span>`;
      this.dotsWrap.appendChild(li);
      return li;
    });

    this.playBtn.addEventListener('click', onTogglePlay);
    this.replayBtn.addEventListener('click', onReplay);
    root.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => i18n.set(b.dataset.lang)));
  }

  setPlaying(playing) {
    this.playBtn.setAttribute('aria-pressed', String(playing));
    this.playLabel.dataset.i18n = playing ? 'pause' : 'play';
    this.playLabel.textContent = this.i18n.t(this.playLabel.dataset.i18n);
    this.playBtn.classList.toggle('is-playing', playing);
  }

  setProgress(p) {
    this.bar.style.transform = `scaleX(${p.toFixed(4)})`;
    let idx = SCENES.findIndex((s) => p < s.end);
    if (idx < 0) idx = SCENES.length - 1;
    if (idx !== this.active) {
      this.active = idx;
      this.dots.forEach((d, i) => {
        d.classList.toggle('is-active', i === idx);
        d.classList.toggle('is-done', i < idx);
        if (i === idx) d.setAttribute('aria-current', 'step');
        else d.removeAttribute('aria-current');
      });
    }
    // the replay button is only reachable once the story has ended
    this.replayBtn.tabIndex = p > 0.93 ? 0 : -1;
  }
}
