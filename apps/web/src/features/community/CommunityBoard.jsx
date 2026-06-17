import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PenLine, Heart, MessageCircle, Eye } from 'lucide-react';
import styles from './Community.module.css';

/* 커뮤니티 게시판 (데모) — /community/demo.
   한 화면에서 목록 → 상세(댓글) → 글쓰기 전환. TODO(backend): GET/POST /community/posts, /posts/{id}/comments */

const CATS = ['전체', '자유', '팁·노하우', '대회후기', '장터', 'Q&A'];

const POSTS = [
  { id: 'b1', cat: '팁·노하우', hot: true, title: '더블언더 처음 성공시키는 3단계 (초등부 코치 정리)', body: '아이들 더블언더 가르칠 때 제일 효과 봤던 순서예요. 1) 높이 점프 먼저 익히기 2) 손목 스냅만 따로 연습 3) 한 번만 성공시키고 칭찬 폭격… 사실 제일 중요한 건 줄 길이예요. 명치~가슴 사이로 맞춰주세요.', author: '점프코치민', av: '민', avc: '#5BA8FF', time: '2시간 전', likes: 47, comments: 12, views: 320 },
  { id: 'b2', cat: '대회후기', hot: true, title: '전국 한마당 줄넘기대회 다녀온 후기 (우리 애 첫 메달 🥉)', body: '화성종합경기타운에서 열린 대회 다녀왔어요. 코트별 라이브 중계가 신기하더라고요. 대기 줄에서도 폰으로 옆 코트 경기 볼 수 있어서 좋았어요. 운영도 깔끔했고…', author: '서연맘', av: '서', avc: '#34D4A6', time: '5시간 전', likes: 63, comments: 21, views: 540 },
  { id: 'b3', cat: '자유', title: '대회 전날 긴장 푸는 본인만의 방법 있나요?', body: '곧 첫 대회 나가는데 애가 너무 긴장해서요. 다들 어떻게 멘탈 잡으시는지 궁금합니다.', author: '울산점프대디', av: '울', avc: '#B49CFF', time: '어제', likes: 18, comments: 15, views: 210 },
  { id: 'b4', cat: '장터', title: '[판매] NARIA 스탠와이어 줄넘기 (새 제품, 길이조절)', body: '대회 준비하면서 두 개 샀는데 하나 안 써서 팝니다. 미개봉 새 제품이고 정가보다 저렴하게 드려요. 직거래/택배 모두 가능.', author: '천안로프', av: '천', avc: '#FFB648', time: '어제', likes: 5, comments: 8, views: 130 },
  { id: 'b5', cat: 'Q&A', title: '스피드 종목이랑 프리스타일 같이 출전 가능한가요?', body: '규정 보니까 중복 출전 된다는데 같은 날 시간 안 겹치는지 아시는 분 계실까요?', author: '제주맘', av: '제', avc: '#33D6D6', time: '2일 전', likes: 9, comments: 6, views: 175 },
  { id: 'b6', cat: '팁·노하우', title: '30초 스피드 5회 더 뛰는 페이스 배분 (실전 팁)', body: '처음부터 풀스피드로 가면 20초쯤 무너져요. 0~10초는 90%, 10~25초 100%, 마지막 5초 스퍼트로 나눠보세요. 이거 하나로 평균 5회는 올랐어요.', author: '스피드러너', av: '스', avc: '#FF7A66', time: '3일 전', likes: 38, comments: 9, views: 290 },
];

const SEED_COMMENTS = {
  b1: [
    { id: 'cm1', nm: '서연맘', av: '서', avc: '#34D4A6', time: '1시간 전', text: '줄 길이 진짜 중요하더라고요. 덕분에 어제 한 번 성공했어요!' },
    { id: 'cm2', nm: '대구코치', av: '대', avc: '#5BA8FF', time: '40분 전', text: '손목 스냅 따로 연습 공감합니다. 저는 줄 없이 박수로 리듬부터 잡아요 👏' },
  ],
};

const CAT_COLORS = { '팁·노하우': '#33D6D6', '대회후기': '#34D4A6', '자유': '#5BA8FF', '장터': '#FFB648', 'Q&A': '#B49CFF' };
function catStyle(cat) {
  const c = CAT_COLORS[cat] || '#5BA8FF';
  return { color: c, background: `color-mix(in srgb, ${c} 14%, transparent)` };
}

export function CommunityBoard() {
  const navigate = useNavigate();
  const [view, setView] = useState('list'); // list | detail | write
  const [cat, setCat] = useState('전체');
  const [open, setOpen] = useState(null);
  const [liked, setLiked] = useState({});
  const [comments, setComments] = useState(SEED_COMMENTS);
  const [cmtText, setCmtText] = useState('');
  const [draft, setDraft] = useState({ cat: '자유', title: '', body: '' });

  const filtered = useMemo(() => (cat === '전체' ? POSTS : POSTS.filter((p) => p.cat === cat)), [cat]);
  const post = POSTS.find((p) => p.id === open);
  const openDetail = (id) => { setOpen(id); setView('detail'); window.scrollTo?.(0, 0); };

  const sendComment = () => {
    if (!cmtText.trim() || !post) return;
    const c = { id: `cm${Date.now()}`, nm: '나', av: '나', avc: '#5BA8FF', time: '방금', text: cmtText.trim() };
    setComments((m) => ({ ...m, [post.id]: [...(m[post.id] || []), c] }));
    setCmtText('');
  };
  const submitPost = () => {
    if (!draft.title.trim() || !draft.body.trim()) return;
    // 데모: 실제 저장 대신 목록 상단 노출 흉내 후 목록으로
    POSTS.unshift({ id: `b${Date.now()}`, cat: draft.cat, title: draft.title, body: draft.body, author: '나', av: '나', avc: '#5BA8FF', time: '방금', likes: 0, comments: 0, views: 1 });
    setDraft({ cat: '자유', title: '', body: '' });
    setCat('전체');
    setView('list');
  };

  // ===== 글쓰기 =====
  if (view === 'write') {
    const ready = draft.title.trim() && draft.body.trim();
    return (
      <div className={styles.screen}>
        <div className={styles.bar}>
          <button className={styles.back} onClick={() => setView('list')} aria-label="취소">←</button>
          <span className={styles.barT}>글쓰기</span>
        </div>
        <div className={styles.scr}>
          <div className={styles.field}>
            <div className={styles.flabel}>게시판 선택</div>
            <div className={styles.catPick}>
              {CATS.filter((c) => c !== '전체').map((c) => (
                <button key={c} className={`${styles.catChip} ${draft.cat === c ? styles.catChipOn : ''}`} onClick={() => setDraft({ ...draft, cat: c })}>{c}</button>
              ))}
            </div>
          </div>
          <div className={styles.field}>
            <div className={styles.flabel}>제목</div>
            <input className={styles.tIn} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="제목을 입력하세요" />
          </div>
          <div className={styles.field}>
            <div className={styles.flabel}>내용</div>
            <textarea className={styles.bIn} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="줄넘기 팁, 대회 후기, 궁금한 점을 자유롭게 나눠요." />
          </div>
          <div className={styles.guide}>서로 존중하는 커뮤니티예요. 광고·비방·개인정보 노출 글은 운영진이 삭제할 수 있어요.</div>
        </div>
        <div className={styles.foot}>
          <button className={`${styles.submit} ${ready ? '' : styles.submitDim}`} onClick={submitPost}>등록하기</button>
        </div>
      </div>
    );
  }

  // ===== 상세 =====
  if (view === 'detail' && post) {
    const cms = comments[post.id] || [];
    const on = !!liked[post.id];
    return (
      <div className={styles.screen}>
        <div className={styles.bar}>
          <button className={styles.back} onClick={() => setView('list')} aria-label="뒤로">←</button>
          <span className={styles.barT}>{post.cat}</span>
        </div>
        <div className={styles.dWrap}>
          <span className={styles.dCat}><span className={styles.cat} style={catStyle(post.cat)}>{post.cat}</span></span>
          <div className={styles.dTitle}>{post.title}</div>
          <div className={styles.dMeta}>
            <span className={styles.dAv} style={{ background: post.avc, color: '#fff' }}>{post.av}</span>
            <div><div className={styles.dAuthor}>{post.author}</div><div className={styles.dSub}>{post.time} · 조회 {post.views}</div></div>
          </div>
          <div className={styles.dBody}>{post.body}</div>

          <button className={`${styles.likeBtn} ${on ? styles.likeBtnOn : ''}`} onClick={() => setLiked((m) => ({ ...m, [post.id]: !m[post.id] }))}>
            <Heart size={18} fill={on ? '#FF5E6C' : 'none'} /> 좋아요 {post.likes + (on ? 1 : 0)}
          </button>

          <div className={styles.cmtHd}>댓글 {cms.length}</div>
          {cms.map((c) => (
            <div key={c.id} className={styles.cmt}>
              <span className={styles.cmtAv} style={{ background: c.avc }}>{c.av}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={styles.cmtTop}><span className={styles.cmtNm}>{c.nm}</span><span className={styles.cmtTime}>{c.time}</span></div>
                <div className={styles.cmtText}>{c.text}</div>
              </div>
            </div>
          ))}
          {cms.length === 0 && <div className={styles.guide} style={{ textAlign: 'left', marginTop: 8 }}>첫 댓글을 남겨보세요 🙂</div>}

          <div className={styles.cmtBar}>
            <input className={styles.cmtIn} value={cmtText} onChange={(e) => setCmtText(e.target.value)} placeholder="따뜻한 댓글을 남겨주세요"
              onKeyDown={(e) => { if (e.key === 'Enter') sendComment(); }} />
            <button className={styles.cmtSend} onClick={sendComment}>등록</button>
          </div>
        </div>
      </div>
    );
  }

  // ===== 목록 =====
  return (
    <div className={styles.screen}>
      <div className={styles.bar}>
        <button className={styles.back} onClick={() => navigate(-1)} aria-label="뒤로">←</button>
        <span className={styles.barT}>커뮤니티</span>
        <button className={styles.write} onClick={() => setView('write')}><PenLine size={15} /> 글쓰기</button>
      </div>
      <div className={styles.tabsWrap}>
        <div className={styles.tabs}>
          {CATS.map((c) => (
            <button key={c} className={`${styles.tab} ${cat === c ? styles.tabOn : ''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
      </div>
      <div className={styles.scr}>
        {filtered.map((p) => {
          const on = !!liked[p.id];
          return (
            <button key={p.id} className={styles.post} onClick={() => openDetail(p.id)}>
              <div className={styles.pTop}>
                <span className={styles.cat} style={catStyle(p.cat)}>{p.cat}</span>
                {p.hot && <span className={styles.hot}>🔥 인기</span>}
                <span className={styles.pTime}>{p.time}</span>
              </div>
              <div className={styles.pTitle}>{p.title}</div>
              <div className={styles.pBody}>{p.body}</div>
              <div className={styles.pFoot}>
                <span className={styles.pAuthor}><span className={styles.pAv} style={{ background: p.avc, color: '#fff' }}>{p.av}</span>{p.author}</span>
                <span className={`${styles.metric} ${on ? styles.metricOn : ''}`}><Heart size={13} fill={on ? '#FF5E6C' : 'none'} /> {p.likes + (on ? 1 : 0)}</span>
                <span className={styles.metric}><MessageCircle size={13} /> {(comments[p.id]?.length) ?? p.comments}</span>
                <span className={styles.metric}><Eye size={13} /> {p.views}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default CommunityBoard;
