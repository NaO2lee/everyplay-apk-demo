/**
 * 국기 표시 — v3.3.
 * ISO 3166 코드 (KR, US, JP, ...) → flag-icons 사각형 SVG.
 *
 * Usage: <Flag code="KR" size={20} /> 또는 <Flag code="us" />
 *
 * 알 수 없는 코드 → 회색 박스로 폴백.
 */
export default function Flag({ code, size = 18, style: extraStyle }) {
  const cls = (code || '').toLowerCase();
  const valid = /^[a-z]{2}$/.test(cls);
  const baseStyle = {
    display: 'inline-block',
    width: size * 1.4,
    height: size,
    borderRadius: 2,
    verticalAlign: 'middle',
    boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
    ...extraStyle,
  };
  if (!valid) {
    return <span title={code || ''} style={{ ...baseStyle, background: '#cbd5e1', fontSize: size * 0.5, color: '#64748b', textAlign: 'center', lineHeight: `${size}px` }}>?</span>;
  }
  return <span className={`fi fi-${cls}`} title={cls.toUpperCase()} style={baseStyle} />;
}
