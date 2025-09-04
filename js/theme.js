// Gestion du thème: auto (prefers-color-scheme) + bascule manuelle avec persistance.

const THEME_KEY = 'whispr_theme';

export function getSystemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getSavedTheme() {
  return localStorage.getItem(THEME_KEY);
}

export function setTheme(theme) {
  const final = theme === 'auto' ? getSystemTheme() : theme;
  document.documentElement.setAttribute('data-theme', final === 'dark' ? 'dark' : 'light');
  localStorage.setItem(THEME_KEY, theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', final === 'dark' ? '#0b1020' : '#f7f9fc');
}

export function initTheme() {
  const saved = getSavedTheme();
  setTheme(saved || 'auto');
  // Écoute des changements système si on est en auto
  if ((saved || 'auto') === 'auto') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', () => setTheme('auto'));
  }
}
