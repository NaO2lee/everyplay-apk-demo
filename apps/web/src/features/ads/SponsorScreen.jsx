import { useNavigate } from 'react-router-dom';
import styles from './SponsorScreen.module.css';

/* 관객이 보는 광고/후원사 화면 (데모) — /sponsors.
   AdminSponsors 데이터(name·logo·banner_image·cta_text·cta_url·kind)를 이 디자인으로 연결 예정. */

const HERO = {
  name: 'NARIA 줄넘기',
  tag: '2026 전국 한마당 공식 줄넘기 · 지금 구매 시 20% 할인 🎉',
  cta: '구매하러 가기 →',
};

const SPONSORS = [
  { logo: 'N', bg: 'var(--grad)', name: 'NARIA', tier: 'gold' },
  { logo: '점', bg: 'linear-gradient(135deg,#5BA8FF,#3a6bc0)', name: '점프코리아', tier: 'gold' },
  { logo: '스', bg: 'linear-gradient(135deg,#34D4A6,#0f8f6c)', name: '스포애니', tier: 'silver' },
  { logo: '헬', bg: 'linear-gradient(135deg,#B49CFF,#7c5cff)', name: '헬스업', tier: 'silver' },
  { logo: '농', bg: 'linear-gradient(135deg,#FFB648,#e0892a)', name: '농협', tier: 'silver' },
  { logo: 'K', bg: 'linear-gradient(135deg,#FF7A66,#e0463b)', name: 'KBSN스포츠', tier: 'silver' },
];

const NATIVE = {
  t: '경기 중 수분 보충, OO이온음료',
  d: '대회장 부스에서 무료 시음 이벤트 진행 중!',
};

export function SponsorScreen() {
  const navigate = useNavigate();
  return (
    <div className={styles.screen}>
      <div className={styles.bar}>
        <button className={styles.back} onClick={() => navigate(-1)} aria-label="뒤로">←</button>
        <span className={styles.barT}>후원사 · 광고</span>
      </div>

      <div className={styles.scr}>
        {/* 히어로 광고 배너 */}
        <div className={styles.hero}>
          <div className={styles.heroImg}>🪅<span className={styles.adtag}>AD</span></div>
          <div className={styles.heroBody}>
            <div className={styles.heroBrand}>
              <span className={styles.heroLogo}>N</span>
              <span className={styles.heroName}>{HERO.name}</span>
            </div>
            <div className={styles.heroTag}>{HERO.tag}</div>
            <a className={styles.cta}>{HERO.cta}</a>
          </div>
        </div>
        <div className={styles.dots}><i className={styles.on} /><i /><i /></div>

        {/* 공식 주관/협회 (KRSA) */}
        <div className={styles.sec}>🏆 공식 주관 · 협회</div>
        <div className={styles.krsa}>
          <img className={styles.krsaLogo} src="/brand/krsa-logo.jpg" alt="대한민국줄넘기협회" />
          <div>
            <div className={styles.krsaName}>대한민국줄넘기협회</div>
            <div className={styles.krsaSub}>KRSA · Korea Rope Skipping Association</div>
          </div>
        </div>

        {/* 공식 후원사 */}
        <div className={styles.sec}>🏅 이 대회 공식 후원사 <span className={styles.more}>전체보기</span></div>
        <div className={styles.sgrid}>
          {SPONSORS.map((s) => (
            <div key={s.name} className={styles.sp}>
              <div className={styles.spLogo} style={{ background: s.bg }}>{s.logo}</div>
              <div className={styles.spName}>{s.name}</div>
              <span className={`${styles.spTier} ${s.tier === 'gold' ? styles.tierGold : styles.tierSilver}`}>
                {s.tier === 'gold' ? '👑 골드' : '실버'}
              </span>
            </div>
          ))}
        </div>

        {/* 네이티브 추천 광고 */}
        <div className={styles.sec}>✨ 추천</div>
        <div className={styles.native}>
          <div className={styles.nativeImg}>🥤</div>
          <div className={styles.nativeBody}>
            <div className={styles.nativeT}>{NATIVE.t}</div>
            <div className={styles.nativeD}>{NATIVE.d}</div>
            <div className={styles.nativeAd}>Sponsored · 광고</div>
          </div>
        </div>

        {/* 후원 참여 CTA */}
        <div className={styles.join}>
          <div className={styles.joinT}>📣 우리 브랜드도 노출하고 싶다면?</div>
          <div className={styles.joinD}>대회 관객에게 우리 브랜드를 보여주세요. 배너·부스·상품 협찬을 도와드려요.</div>
          <button className={styles.joinBtn}>광고 · 후원 문의하기</button>
        </div>
      </div>
    </div>
  );
}

export default SponsorScreen;
