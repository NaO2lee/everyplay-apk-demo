import { useEffect, useState } from 'react';

// 전역 다크/라이트 토글 — <html data-theme>를 바꾸고 localStorage('mp_theme')에 저장.
// 사용자 앱(/app/*)은 자체 헤더 토글이 있으므로 거기선 숨김.
function getInitialTheme() {
  try {
    const q = new URLSearchParams(window.location.search).get('theme');
    if (q === 'light' || q === 'dark') return q;
    return localStorage.getItem('mp_theme') || 'dark';
  } catch { return 'dark'; }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('mp_theme', theme); } catch { /* ignore */ }
  }, [theme]);

  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app')) return null;

  return (
    <button
      className="themeToggle"
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      aria-label="테마 전환"
      title="다크/라이트 전환"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}

export default ThemeToggle;
