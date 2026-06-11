import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/theme.css'
import App from './App.jsx'

// 첫 페인트 전에 테마 적용 (깜빡임 방지). ?theme= → localStorage → 기본 다크.
try {
  const q = new URLSearchParams(window.location.search).get('theme');
  document.documentElement.dataset.theme = (q === 'light' || q === 'dark') ? q : (localStorage.getItem('mp_theme') || 'dark');
} catch { document.documentElement.dataset.theme = 'dark'; }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
