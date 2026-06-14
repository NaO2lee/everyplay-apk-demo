import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { ModalProvider } from './components/Modal';
import ThemeToggle from './components/ThemeToggle';
import AdminLogin from './pages/AdminLogin';
import AdminRoute from './components/AdminRoute';
import EventList from './pages/EventList';
import EventNew from './pages/EventNew';
import EventDetail from './pages/EventDetail';
import Dashboard from './pages/Dashboard';
import ClipManagement from './pages/ClipManagement';
import TimestampVerify from './pages/TimestampVerify';
import Scoreboard from './pages/Scoreboard';
import OperatorGuide from './pages/OperatorGuide';
import Home from './pages/Home';
import ViewerEvent from './pages/ViewerEvent';
import JudgeHome from './pages/JudgeHome';
import PlayerMe from './pages/PlayerMe';
import OperatorPanel from './pages/OperatorPanel';
import AdminMatrix from './pages/AdminMatrix';
import WatchEvent from './pages/WatchEvent';
import AdminCourts from './pages/AdminCourts';
import AdminAwards from './pages/AdminAwards';
import SignUp from './pages/SignUp';
import AdminCsvUpload from './pages/AdminCsvUpload';
import AdminAudit from './pages/AdminAudit';
import AdminHeats from './pages/AdminHeats';
import AdminUsers from './pages/AdminUsers';
import OperatorRunner from './pages/OperatorRunner';
import JudgeGrid from './pages/JudgeGrid';
import Hub from './pages/Hub';
import AdminSponsors from './pages/AdminSponsors';
import ViewerApp from './features/viewer/ViewerApp';
import AdminConsole from './features/admin/AdminConsole';
import EventConsole from './features/admin/EventConsole';
import BroadcastConsole from './features/admin/BroadcastConsole';
import SwitcherConsole from './features/admin/SwitcherConsole';
import OverlayManager from './features/admin/OverlayManager';
import RunnerConsole from './features/admin/RunnerConsole';
import BracketConsole from './features/admin/BracketConsole';
import ParticipantsConsole from './features/admin/ParticipantsConsole';
import StatsConsole from './features/admin/StatsConsole';
import SettingsConsole from './features/admin/SettingsConsole';
import SponsorScreen from './features/ads/SponsorScreen';
import CompetitionDetail from './features/competition/CompetitionDetail';
import ApplyFlow from './features/competition/ApplyFlow';
import JudgeScore from './features/judge/JudgeScore';
import AnnounceConsole from './features/operator/AnnounceConsole';
import ScoreboardScreen from './features/scoreboard/ScoreboardScreen';
import AwardsConsole from './features/admin/AwardsConsole';
import StationConsole from './features/admin/StationConsole';

function App() {
  return (
    <BrowserRouter>
      <ModalProvider>
      <ThemeToggle />
      <Routes>
        {/* 공개 페이지 */}
        <Route path="/" element={<Home />} />
        <Route path="/events/:eventCode" element={<ViewerEvent />} />
        {/* 신규 사용자 앱 (모듈화 v2 — 위플레이 브랜드, 4탭). 기존 ViewerEvent와 비교용 */}
        <Route path="/app/:eventCode" element={<ViewerApp />} />
        {/* 신규 관리자 콘솔 (v3 디자인, 데모 데이터) — 승인 후 실제 페이지 이식 */}
        <Route path="/console" element={<AdminConsole />} />
        <Route path="/console/event" element={<EventConsole />} />
        <Route path="/console/broadcast" element={<BroadcastConsole />} />
        <Route path="/console/switcher" element={<SwitcherConsole />} />
        <Route path="/console/overlay" element={<OverlayManager />} />
        <Route path="/console/runner" element={<RunnerConsole />} />
        <Route path="/console/brackets" element={<BracketConsole />} />
        <Route path="/console/participants" element={<ParticipantsConsole />} />
        <Route path="/console/stats" element={<StatsConsole />} />
        <Route path="/console/settings" element={<SettingsConsole />} />
        {/* 관객용 광고/후원사 화면 (데모) */}
        <Route path="/sponsors" element={<SponsorScreen />} />
        {/* 대회 상세 + 접수 신청 (데모) */}
        <Route path="/competition/demo" element={<CompetitionDetail />} />
        <Route path="/apply/demo" element={<ApplyFlow />} />
        {/* 심판 채점 (앱 디자인) — 5월 /judge-grid 로직 재사용 */}
        <Route path="/judge-app" element={<JudgeScore />} />
        {/* AI 음성 호명 (앱 디자인) — 5월 /operate 로직 재사용 */}
        <Route path="/operate-app" element={<AnnounceConsole />} />
        {/* 전광판 (TV, 앱 디자인 데모) — 5월 Scoreboard SSE 패턴 재사용 예정 */}
        <Route path="/scoreboard-demo" element={<ScoreboardScreen />} />
        {/* 시상 · OBS 스테이션 설정 (앱 디자인 콘솔, 데모) */}
        <Route path="/console/awards" element={<AwardsConsole />} />
        <Route path="/console/stations" element={<StationConsole />} />

        {/* v3.3 — 역할별 페이지 (인증은 페이지 안에서 처리) */}
        <Route path="/judge" element={<JudgeHome />} />
        <Route path="/me" element={<PlayerMe />} />
        <Route path="/operate" element={<OperatorPanel />} />
        <Route path="/admin-matrix" element={<AdminMatrix />} />
        <Route path="/watch" element={<WatchEvent />} />
        <Route path="/admin-courts" element={<AdminCourts />} />
        <Route path="/admin-awards" element={<AdminAwards />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/admin-csv" element={<AdminCsvUpload />} />
        <Route path="/admin-audit" element={<AdminAudit />} />
        <Route path="/admin-heats" element={<AdminHeats />} />
        <Route path="/admin-users" element={<AdminUsers />} />
        <Route path="/operate-runner" element={<OperatorRunner />} />
        <Route path="/judge-grid" element={<JudgeGrid />} />
        <Route path="/hub" element={<Hub />} />
        <Route path="/admin-sponsors" element={<AdminSponsors />} />

        {/* 관리자 로그인 */}
        <Route path="/admin" element={<AdminLogin />} />

        {/* 관리자 전용 */}
        <Route path="/admin/events" element={
          <AdminRoute><EventList /></AdminRoute>
        } />
        <Route path="/admin/events/new" element={
          <AdminRoute><EventNew /></AdminRoute>
        } />
        <Route path="/admin/events/:eventId" element={
          <AdminRoute><EventDetail /></AdminRoute>
        } />
        <Route path="/admin/events/:eventId/dashboard" element={
          <AdminRoute><Dashboard /></AdminRoute>
        } />
        <Route path="/admin/events/:eventId/clips" element={
          <AdminRoute><ClipManagement /></AdminRoute>
        } />
        <Route path="/admin/events/:eventId/timestamps" element={
          <AdminRoute><TimestampVerify /></AdminRoute>
        } />
        <Route path="/admin/events/:eventId/scoreboard" element={
          <AdminRoute><Scoreboard /></AdminRoute>
        } />
        <Route path="/admin/events/:eventId/guide" element={
          <AdminRoute><OperatorGuide /></AdminRoute>
        } />
      </Routes>
      </ModalProvider>
    </BrowserRouter>
  );
}

export default App;
