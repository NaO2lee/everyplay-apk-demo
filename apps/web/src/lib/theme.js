// 테마 모드: 'dark' | 'light' | 'system'. system = 폰(OS) 설정(prefers-color-scheme)을 따라감.
// localStorage 'mp_theme'에 모드 저장. 적용은 <html data-theme="dark|light">.

export function getThemeMode() {
  try { return localStorage.getItem('mp_theme') || 'dark'; } catch { return 'dark'; }
}

export function resolveTheme(mode = getThemeMode()) {
  if (mode === 'system') {
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'dark'; }
  }
  return mode === 'light' ? 'light' : 'dark';
}

export function applyTheme(mode = getThemeMode()) {
  const r = resolveTheme(mode);
  try { document.documentElement.dataset.theme = r; } catch { /* ignore */ }
  return r;
}

export function setThemeMode(mode) {
  try { localStorage.setItem('mp_theme', mode); } catch { /* ignore */ }
  return applyTheme(mode);
}
