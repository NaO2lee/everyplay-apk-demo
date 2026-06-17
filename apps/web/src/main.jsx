import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/theme.css'
import App from './App.jsx'
import { applyTheme, getThemeMode } from './lib/theme'

// 첫 페인트 전에 테마 적용 (깜빡임 방지). ?theme= 강제 → 아니면 모드(다크/라이트/시스템) 해석.
try {
  const q = new URLSearchParams(window.location.search).get('theme');
  if (q === 'light' || q === 'dark') document.documentElement.dataset.theme = q;
  else applyTheme();
  // 시스템 모드일 때 폰 다크/라이트 변경 즉시 반영
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getThemeMode() === 'system') applyTheme();
  });
} catch { document.documentElement.dataset.theme = 'dark'; }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
