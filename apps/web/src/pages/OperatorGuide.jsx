import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, ChevronRight } from 'lucide-react';

function Section({ title, children, defaultOpen = true }) {
  return (
    <details open={defaultOpen} className="bg-white rounded-xl border shadow-sm">
      <summary className="cursor-pointer select-none px-5 py-4 font-semibold text-lg flex items-center justify-between">
        <span>{title}</span>
        <ChevronRight className="w-5 h-5 transition-transform group-open:rotate-90" />
      </summary>
      <div className="px-5 pb-5 space-y-3 text-gray-700 leading-relaxed">
        {children}
      </div>
    </details>
  );
}

function Step({ n, title, children }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500 text-white font-bold text-sm flex items-center justify-center">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-gray-800">{title}</h4>
        {children && <div className="text-sm text-gray-600 mt-1 space-y-1">{children}</div>}
      </div>
    </div>
  );
}

function Tip({ children, type = 'info' }) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    warn: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    danger: 'bg-red-50 border-red-200 text-red-900',
  };
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${styles[type] || styles.info}`}>
      {children}
    </div>
  );
}

export default function OperatorGuide() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      <div className="bg-white border-b print:hidden sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/admin/events/${eventId}`)}
              className="p-2 hover:bg-gray-100 rounded-lg"
              aria-label="뒤로"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold">대시보드 사용자 가이드</h1>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm"
          >
            <Printer className="w-4 h-4" />
            인쇄
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4 print:max-w-none print:py-0">
        <header className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">모두의 플레이 운영 가이드</h2>
          <p className="text-sm text-gray-500">
            줄넘기 대회 라이브 스트리밍 + 클립 + 알림 운영 시스템 사용법.
            처음 사용하는 분도 순서대로 따라하면 됩니다.
          </p>
        </header>

        {/* ── 1. 행사 전 준비 ────────────────────────────────────── */}
        <Section title="1. 행사 전 준비 (D-1까지)">
          <p>행사 당일 0시 기준으로 다음 항목이 모두 준비돼야 합니다.</p>

          <Step n="1" title="이벤트 생성">
            <p>관리자 메뉴 → "새 이벤트" → 이벤트명 / 날짜 / 스테이션 수(보통 6) 입력 → 만들기.</p>
          </Step>

          <Step n="2" title="스테이션 설정 — OBS 접속 정보 입력">
            <p>이벤트 상세 → "스테이션 설정" 탭. 각 스테이션마다:</p>
            <ul className="list-disc list-inside ml-2 text-sm">
              <li>OBS Host (PC IP), Port (4455 기본), WebSocket 비밀번호</li>
              <li>YouTube 라이브 URL (시청자가 볼 주소)</li>
              <li>YouTube 스트림 키 (OBS에 설정한 것과 동일)</li>
            </ul>
            <p>저장 → "OBS 테스트" 버튼으로 연결 확인. "OBS 연결 성공" 떠야 통과.</p>
            <Tip>스테이션 설정이 매번 같다면 "프리셋 관리" 사용 → 한 번만 입력하고 다른 스테이션에 "불러오기"</Tip>
          </Step>

          <Step n="3" title="참가자 등록 (CSV 업로드)">
            <p>"참가자" 탭 → "샘플" 다운로드 → 엑셀로 채우기 → "CSV 업로드".</p>
            <p>필수 컬럼: <code>이름, 연락처</code>. 선택: <code>소속, 종별</code>.</p>
            <Tip type="warn">전화번호는 SMS 발송에 필수. 신청서 / 구글폼에서 수집해서 정확히 채울 것.</Tip>
          </Step>

          <Step n="4" title="대진 / 히트 일정 입력">
            <p>"대진" 탭 → 종목별 프로그램 + 히트 등록.</p>
          </Step>

          <Step n="5" title="오버레이 디자인 (선택)">
            <p>"오버레이" 탭 → 텍스트 / 타이머 / 이미지(로고) 요소 배치.</p>
            <p>로고 이미지 업로드 → 우측 상단 등 원하는 위치로 드래그 → 너비 슬라이더로 크기 조절 → "저장".</p>
            <Tip>OBS 브라우저 소스 URL 은 스테이션 설정 화면의 "오버레이 URL 복사" 버튼으로 얻을 수 있음.</Tip>
          </Step>

          <Step n="6" title="OBS 셋업 (각 스테이션 PC)">
            <ul className="list-disc list-inside ml-2 text-sm">
              <li>OBS Studio 설치 → 도구 → WebSocket Server Settings → Enable + Port + Password 위 2단계와 일치</li>
              <li>소스: 카메라(비디오 캡처 장치) + 브라우저 소스(오버레이 URL)</li>
              <li>설정 → 방송 → YouTube RTMPS + 스트림 키 (계정 연결 ❌, 스트림 키 ✅)</li>
            </ul>
          </Step>

          <Step n="7" title="리허설">
            <p>대시보드에서 "운영 시작" → 한두 히트 진행 → 모든 코트 영상이 정상 송출되는지 + 오버레이 표시 확인.</p>
          </Step>
        </Section>

        {/* ── 1.5 장비 / 네트워크 셋업 ────────────────────────────────── */}
        <Section title="2. 장비 / 네트워크 셋업 (현장 도착 직후)">
          <p>현장에 도착해 기자재를 풀고 다음 순서로 셋업합니다. 6코트 기준.</p>

          <Step n="1" title="물리 배치">
            <ul className="list-disc list-inside ml-2 text-sm">
              <li>코트별 카메라 위치 확정 (관중 시야 가리지 않는 각도)</li>
              <li>관제 데스크 위치 확정 (모든 노트북을 한곳에 모음 — 운영자 1명이 통제)</li>
              <li>전원 접근성 확인 → 멀티탭으로 노트북 + 카메라(필요 시) 충전기 연결</li>
            </ul>
          </Step>

          <Step n="2" title="카메라 → 노트북 영상 입력">
            <p>두 가지 방식 중 환경에 맞춰 선택:</p>
            <ul className="list-disc list-inside ml-2 text-sm">
              <li><b>광 HDMI 20m 유선</b>: 카메라 HDMI OUT → 광 HDMI → 노트북 HDMI 캡처카드(USB) → OBS</li>
              <li><b>무선 송수신기 (예: 엑순 시네뷰2)</b>: 카메라 측 송신기 + 노트북 측 수신기 → 캡처카드 → OBS. 거리 50m 이내, 벽 없을 때 안정.</li>
            </ul>
            <Tip type="warn">노트북에 HDMI 입력이 없으면 USB 캡처카드 필수. 사전에 인식 테스트 (윈도우 카메라 앱 / OBS 비디오 캡처 장치).</Tip>
          </Step>

          <Step n="3" title="노트북 사양 점검">
            <p>스테이션마다 다음 최소 사양 권장 (5스트리밍 동시 + 인코딩 부하):</p>
            <ul className="list-disc list-inside ml-2 text-sm">
              <li>CPU: Intel i5-8350U 이상 (또는 동급 AMD)</li>
              <li>RAM: 8GB 이상</li>
              <li>GPU 메모리: 8GB 권장 (4GB는 인코딩 끊김 / 지연 발생 가능)</li>
              <li>SSD 여유 공간 50GB+ (녹화 파일 수십 GB 가능)</li>
              <li>OBS 설치 + 본 시스템 가이드대로 사전 셋업 완료된 PC</li>
            </ul>
            <Tip type="danger">맥북 일부 모델, 구형 i3, GPU 4GB 노트북은 리허설 단계에서 프레임 드롭이 보였음 — 가능하면 교체.</Tip>
          </Step>

          <Step n="4" title="네트워크 (가장 중요)">
            <p>"방송 끊기면 폭망" — 네트워크 안정성을 최우선으로 점검.</p>
            <ul className="list-disc list-inside ml-2 text-sm">
              <li>대회장 전용선(이더넷) 확보 (가능하면 2회선 이상)</li>
              <li>전용선 → <b>스위칭 허브</b> → 랜선으로 각 노트북 직결</li>
              <li>모든 스테이션 PC 는 <b>유선</b> 권장. 무선은 사람 많으면 간섭으로 끊김 위험</li>
              <li>업로드 속도 측정 (각 스테이션 5~10Mbps 정도 필요. 6코트면 합 60Mbps+)</li>
              <li>전용선이 1개뿐이면 → 3대씩 나눠서 외부망 백업 회선 활용 (LTE 라우터 등) 검토</li>
            </ul>
            <Tip>"본딩"(다중 회선 묶음)은 장비 추가 필요. 이번 대회에서는 기본 유선 + 백업 회선 정도가 현실적.</Tip>
          </Step>

          <Step n="5" title="장비 체크리스트 (당일 아침 마지막 점검)">
            <ul className="list-disc list-inside ml-2 text-sm">
              <li>☐ 카메라 N대 + 배터리 완충 + SD 카드 (예비 1장씩)</li>
              <li>☐ HDMI/광HDMI 케이블 N개 + 무선 송수신기 (필요 시)</li>
              <li>☐ HDMI 캡처카드 N개</li>
              <li>☐ 노트북 N대 + 충전기 + 마우스</li>
              <li>☐ 스위칭 허브 + 랜선 (3m × 노트북 수만큼)</li>
              <li>☐ 멀티탭 + 연장선</li>
              <li>☐ 삼각대 또는 짐벌 (카메라 안정용)</li>
              <li>☐ 협회 로고 / 워터마크 PNG (오버레이용 — USB로 백업)</li>
              <li>☐ 참가자 명단 인쇄본 (전산 장애 대비)</li>
            </ul>
          </Step>

          <Step n="6" title="셋업 완료 후 자가 점검">
            <ul className="list-disc list-inside ml-2 text-sm">
              <li>각 노트북 OBS 실행 → 카메라 영상 미리보기 OK</li>
              <li>네트워크 속도 실측 (fast.com 등)</li>
              <li>대시보드 → "스테이션 설정" → 모든 스테이션 OBS 테스트 통과</li>
              <li>유튜브 라이브 한 코트만 1분 시범 송출 → 시청자 화면 정상 확인</li>
            </ul>
          </Step>
        </Section>

        {/* ── 3. 행사 당일 운영 ────────────────────────────────────── */}
        <Section title="3. 행사 당일 운영">
          <Step n="1" title="모든 스테이션 PC + OBS + 카메라 연결">
            <p>각 스테이션 노트북에서 OBS 실행 → 미리보기에서 카메라 영상 확인.</p>
          </Step>

          <Step n="2" title="이벤트 상세 → 스테이션 설정 → 모든 스테이션 OBS 테스트 통과 확인">
            <p>설정됨 + 운영 중 mini 배지에 "OBS 끊김" 같은 거 없어야 함.</p>
          </Step>

          <Step n="3" title='헤더의 "운영 시작" 버튼 클릭'>
            <p>모든 스테이션의 OBS 녹화 + YouTube 스트리밍이 자동으로 시작됩니다.</p>
            <Tip type="warn">YouTube Studio 에서 각 라이브에 대해 "스트리밍 시작" 버튼을 한 번씩 더 눌러야 실제 방송이 송출됩니다 (안 누르면 녹화만 됨).</Tip>
          </Step>

          <Step n="4" title="대시보드에서 히트 컨트롤">
            <p>운영 대시보드(/dashboard) 진입. 각 카드에 OBS 상태 표시. 헤더의 "HIT N 시작" 누르면 모든 코트가 동시에 같은 히트로 시작.</p>
            <p>히트 끝나면 "전체 히트 종료" → 다음 HIT 번호 자동 증가.</p>
            <Tip>실시간 로그 패널(우측 사이드 / 모바일 하단)에서 OBS 끊김, 녹화 실패 등 즉시 확인.</Tip>
          </Step>

          <Step n="5" title="전광판 모니터링 (선택)">
            <p>이벤트 헤더의 "전광판" 버튼 → 6코트 3x2 격자. 영상 더블클릭하면 메인으로 크게, 우측에 다른 코트 5개 썸네일.</p>
            <p>하단 정보바: 현재 메인 영상의 코트 / 종목 / HIT / 선수 자동 표시.</p>
          </Step>

          <Step n="6" title="문제 발생 시">
            <ul className="list-disc list-inside ml-2 text-sm">
              <li>특정 스테이션 OBS 끊김 → 그 PC 의 OBS 다시 시작 → 대시보드에서 "OBS 클라이언트 재로드"</li>
              <li>스트리밍 끊김 → YouTube Studio 에서 송출 상태 확인 (네트워크 문제일 가능성 높음)</li>
              <li>오버레이 멈춤 → 그 OBS 의 브라우저 소스 우클릭 → 새로고침</li>
            </ul>
          </Step>
        </Section>

        {/* ── 4. 행사 후 ───────────────────────────────────────── */}
        <Section title="4. 행사 후 (당일 ~ D+1)">
          <Step n="1" title='헤더 "운영 종료" 클릭'>
            <p>모든 OBS 녹화 + 스트리밍 종료. 파일은 각 스테이션 PC 의 OBS 녹화 폴더에 저장됨.</p>
          </Step>

          <Step n="2" title="YouTube VOD 업로드 대기">
            <p>YouTube 라이브가 끝나면 자동으로 VOD(다시보기) 영상이 채널에 등록됨 (보통 즉시 ~ 수 분).</p>
            <Tip>VOD ID 는 라이브 ID 와 다릅니다. 백엔드(정석님 작업)가 OAuth 로 자동 매칭.</Tip>
          </Step>

          <Step n="3" title="클립 추출 + SMS 발송">
            <p>이벤트 헤더 → "클립" 버튼 → 스테이션별 히트 리스트.</p>
            <ul className="list-disc list-inside ml-2 text-sm">
              <li>"전체 자르기" → 로컬 영상 파일에서 히트 구간 추출</li>
              <li>"YouTube" 버튼 → 클립을 채널에 업로드 (선택)</li>
              <li>"SMS" 버튼 → 그 히트 참가자에게 영상 링크 문자 발송</li>
              <li>"전체 SMS 발송" → 업로드된 모든 히트 일괄</li>
            </ul>
          </Step>

          <Step n="4" title="사용자 페이지 안내 (관객용)">
            <p>관객은 <code>/events/&#123;이벤트코드&#125;</code> 로 접속 (QR 만들어 현장 안내).</p>
            <p>"선수 검색" 버튼으로 본인 출전 영상 링크 조회 가능.</p>
          </Step>
        </Section>

        {/* ── 5. 자주 막히는 문제 ────────────────────────────────── */}
        <Section title="5. 자주 막히는 문제 / FAQ">
          <details className="bg-gray-50 rounded p-3">
            <summary className="cursor-pointer font-medium">OBS 테스트가 "연결 실패"</summary>
            <ul className="list-disc list-inside ml-2 text-sm mt-2">
              <li>OBS 가 실행되어 있는지</li>
              <li>WebSocket 서버가 켜져 있는지 (Port + Password 일치)</li>
              <li>방화벽이 4455 포트 막지 않는지</li>
              <li>같은 네트워크인지 (다른 와이파이면 접근 불가)</li>
            </ul>
          </details>

          <details className="bg-gray-50 rounded p-3">
            <summary className="cursor-pointer font-medium">YouTube 라이브 화면이 검정 / 송출 0초</summary>
            <ul className="list-disc list-inside ml-2 text-sm mt-2">
              <li>YouTube Studio 에서 "스트리밍 시작" 버튼 안 눌렀을 가능성 (가장 흔함)</li>
              <li>OBS 의 스트림 키가 YouTube 의 새 스트림 키와 일치하는지</li>
              <li>네트워크 업로드 속도 부족 (10Mbps 이상 권장)</li>
            </ul>
          </details>

          <details className="bg-gray-50 rounded p-3">
            <summary className="cursor-pointer font-medium">SMS 발송이 안 됨</summary>
            <ul className="list-disc list-inside ml-2 text-sm mt-2">
              <li>참가자 전화번호 형식이 맞는지 (`010-0000-0000` 또는 `01000000000`)</li>
              <li>백엔드 .env 의 NHN Cloud 키가 설정돼 있는지 (정석님 영역)</li>
              <li>"SMS" 버튼은 영상 업로드 완료(`uploaded` 상태) + 클립 URL 있을 때만 활성화</li>
            </ul>
          </details>

          <details className="bg-gray-50 rounded p-3">
            <summary className="cursor-pointer font-medium">전광판이 절반만 차거나 영상이 안 나옴</summary>
            <ul className="list-disc list-inside ml-2 text-sm mt-2">
              <li>YouTube 라이브 URL 이 스테이션 설정에 등록돼 있어야 영상이 임베드됨</li>
              <li>라이브 송출 시작 후 5~10초 지연 발생 정상</li>
              <li>크롬에서 자동재생/소리 정책에 따라 처음엔 음소거 상태</li>
            </ul>
          </details>

          <details className="bg-gray-50 rounded p-3">
            <summary className="cursor-pointer font-medium">오버레이가 옛 데이터로 멈춰있음</summary>
            <ul className="list-disc list-inside ml-2 text-sm mt-2">
              <li>OBS 의 브라우저 소스 우클릭 → 새로고침</li>
              <li>오버레이 설정을 변경했으면 저장 → 자동으로 모든 OBS 에 반영되어야 정상</li>
            </ul>
          </details>
        </Section>

        {/* ── 6. 화면 단축키 ───────────────────────────────────── */}
        <Section title="6. 단축키 / 팁" defaultOpen={false}>
          <ul className="list-disc list-inside ml-2 text-sm">
            <li><b>전광판 메인 모드</b>: 영상 더블클릭 → 메인 / 썸네일 클릭 → 전환 / <kbd>ESC</kbd> → 그리드</li>
            <li><b>오버레이 편집</b>: 미리보기에서 요소 드래그 / 우측 패널에서 폰트·색상·위치 미세조정</li>
            <li><b>대시보드</b>: 히트 번호 입력 칸 직접 수정 가능 (단 진행 중인 히트 있으면 잠김)</li>
          </ul>
        </Section>

        <footer className="text-center text-xs text-gray-400 py-4">
          모두의플레이 줄넘기 대회 시스템 — 운영 가이드 v1
        </footer>
      </main>
    </div>
  );
}
