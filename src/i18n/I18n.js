import { STRINGS, LANGUAGES } from './strings.js';

const STORAGE_KEY = 'fruttino-lang';

function detectLanguage() {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (LANGUAGES.includes(fromUrl)) return fromUrl;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.includes(saved)) return saved;
  } catch { /* storage unavailable: fall through */ }
  return (navigator.language || '').toLowerCase().startsWith('it') ? 'it' : 'en';
}

/**
 * Tiny i18n layer. Switching language only swaps text: the story timeline,
 * which animates the *elements*, keeps playing untouched.
 */
export class I18n {
  constructor(root = document) {
    this.root = root;
    this.lang = detectLanguage();
    this.listeners = new Set();
  }

  t(key) {
    return STRINGS[this.lang][key] ?? STRINGS.it[key] ?? key;
  }

  onChange(fn) {
    this.listeners.add(fn);
  }

  set(lang) {
    if (!LANGUAGES.includes(lang) || lang === this.lang) return;
    this.lang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* not persisted */ }
    this.apply();
    this.listeners.forEach((fn) => fn(lang));
  }

  /** Writes the current language into every tagged element. */
  apply() {
    const r = this.root;
    document.documentElement.lang = this.lang;
    document.title = this.t('doc.title');
    r.querySelector('meta[name="description"]')?.setAttribute('content', this.t('doc.description'));
    r.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = this.t(el.dataset.i18n); });
    r.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', this.t(el.dataset.i18nAria)));
    r.querySelectorAll('[data-i18n-alt]').forEach((el) => el.setAttribute('alt', this.t(el.dataset.i18nAlt)));
    r.querySelectorAll('[data-lang]').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.lang === this.lang)));
  }
}
