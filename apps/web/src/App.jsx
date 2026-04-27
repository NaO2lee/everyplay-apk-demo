import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { ModalProvider } from './components/Modal';
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

function App() {
  return (
    <BrowserRouter>
      <ModalProvider>
      <Routes>
        {/* 공개 페이지 */}
        <Route path="/" element={<Home />} />
        <Route path="/events/:eventCode" element={<ViewerEvent />} />

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
