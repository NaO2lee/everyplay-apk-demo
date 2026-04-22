const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const TOKEN_KEY = 'adminToken';

class ApiService {
  constructor() {
    this.baseUrl = API_BASE;
  }

  get token() {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401 && !endpoint.startsWith('/auth/login')) {
      // 자동 재로그인 시도 (장시간 운영 시 토큰 만료 대응)
      const reloginOk = await this._tryRelogin();
      if (reloginOk) {
        // 재로그인 성공 → 원래 요청 재시도
        headers['Authorization'] = `Bearer ${this.token}`;
        const retry = await fetch(url, { ...options, headers });
        const retryData = await retry.json().catch(() => ({}));
        if (retry.ok) return retryData;
      }
      this.clearToken();
      if (typeof window !== 'undefined' && window.location.pathname !== '/admin') {
        window.location.href = '/admin';
      }
    }

    if (!response.ok) {
      throw new Error(data.detail || data.error?.message || 'API request failed');
    }

    return data;
  }

  async _tryRelogin() {
    // 저장된 credentials 로 자동 재로그인
    const creds = sessionStorage.getItem('_creds');
    if (!creds) return false;
    try {
      const { u, p } = JSON.parse(creds);
      const res = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      this.setToken(data.data.token);
      return true;
    } catch { return false; }
  }

  // Auth
  async login(username, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(data.data.token);
    // 자동 재로그인용 credentials 저장 (세션 스토리지 — 탭 닫으면 삭제)
    try { sessionStorage.setItem('_creds', JSON.stringify({ u: username, p: password })); } catch {}
    return data;
  }

  // Public (인증 불필요)
  async getPublicEvents() {
    return this.requestPublic('/public/events');
  }

  async getPublicEventByCode(eventCode) {
    return this.requestPublic(`/public/events/${eventCode}`);
  }

  async requestPublic(endpoint) {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || 'API request failed');
    }
    return data;
  }

  // Events
  async getEvents(status = null) {
    const params = status ? `?status=${status}` : '';
    return this.request(`/events${params}`);
  }

  async getEvent(eventId) {
    return this.request(`/events/${eventId}`);
  }

  async getEventByCode(eventCode) {
    return this.request(`/events/by-code/${eventCode}`);
  }

  async createEvent(eventData) {
    return this.request('/events', {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  }

  async updateEvent(eventId, eventData) {
    return this.request(`/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(eventData),
    });
  }

  // Stations — OBS 설정
  // obsPassword 가 undefined 면 서버에 전송하지 않음 → 서버는 기존 비밀번호 유지
  // 빈 문자열(null/"") 을 명시적으로 넘기면 비밀번호 삭제 의미
  async setStationObsConfig(courtId, { obsHost, obsPort = 4455, obsPassword, youtubeStreamUrl, youtubeStreamKey, youtubeOffsetSeconds }) {
    const body = {
      obs_host: obsHost || null,
      obs_port: obsPort,
      youtube_stream_url: youtubeStreamUrl || null,
    };
    if (obsPassword !== undefined) {
      body.obs_password = obsPassword || null;
    }
    if (youtubeStreamKey !== undefined) {
      body.youtube_stream_key = youtubeStreamKey || null;
    }
    if (youtubeOffsetSeconds !== undefined) {
      body.youtube_offset_seconds = youtubeOffsetSeconds;
    }
    return this.request(`/stations/${courtId}/obs-config`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async getStationStreamKey(stationId) {
    return this.request(`/stations/${stationId}/stream-key`);
  }

  async clearStationObsConfig(courtId) {
    return this.request(`/stations/${courtId}/obs-config`, {
      method: 'DELETE',
    });
  }

  // OBS 제어
  async obsStatus() {
    return this.request('/obs/status');
  }
  async obsReload() {
    return this.request('/obs/reload', { method: 'POST' });
  }
  async obsConnectStation(courtId) {
    return this.request(`/obs/stations/${courtId}/connect`, { method: 'POST' });
  }
  async obsStartEvent(eventId, competitionDate = null) {
    const body = {};
    if (competitionDate) body.competition_date = competitionDate;
    return this.request(`/obs/events/${eventId}/start`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
  async obsStopEvent(eventId) {
    return this.request(`/obs/events/${eventId}/stop`, { method: 'POST' });
  }
  async obsSessions(eventId) {
    return this.request(`/obs/events/${eventId}/sessions`);
  }

  // Heats
  async startHeat(courtId, heatNumber, participantIds = [], competitionDate = null) {
    const body = { heat_number: heatNumber, participant_ids: participantIds };
    if (competitionDate) body.competition_date = competitionDate;
    return this.request(`/stations/${courtId}/heats/start`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async endHeat(heatId) {
    return this.request(`/heats/${heatId}/end`, {
      method: 'POST',
    });
  }

  async getHeats(eventId, options = {}) {
    const params = new URLSearchParams();
    if (options.courtId) params.append('station_id', options.courtId);
    if (options.status) params.append('status', options.status);
    if (options.sessionId) params.append('session_id', options.sessionId);
    if (options.page) params.append('page', options.page);
    if (options.perPage) params.append('per_page', options.perPage);
    return this.request(`/events/${eventId}/heats?${params}`);
  }

  async resetHeats(eventId) {
    return this.request(`/events/${eventId}/heats/reset`, { method: 'DELETE' });
  }

  async extractHeatClip(heatId) {
    return this.request(`/heats/${heatId}/extract`, { method: 'POST' });
  }

  async uploadHeatToYouTube(heatId) {
    return this.request(`/heats/${heatId}/upload-youtube`, { method: 'POST' });
  }

  async updateHeatParticipants(heatId, participantIds) {
    return this.request(`/heats/${heatId}/participants`, {
      method: 'PUT',
      body: JSON.stringify({ participant_ids: participantIds }),
    });
  }

  // Participants
  async getParticipants(eventId, options = {}) {
    const params = new URLSearchParams();
    if (options.search) params.append('q', options.search);
    if (options.team) params.append('team', options.team);
    if (options.skip != null) params.append('skip', options.skip);
    if (options.limit != null) params.append('limit', options.limit);
    return this.request(`/events/${eventId}/participants?${params}`);
  }

  async createParticipant(eventId, participantData) {
    return this.request(`/events/${eventId}/participants`, {
      method: 'POST',
      body: JSON.stringify(participantData),
    });
  }

  async bulkImportParticipants(eventId, csvFile) {
    const formData = new FormData();
    formData.append('file', csvFile);
    const res = await fetch(`${API_BASE}/events/${eventId}/participants/bulk`, {
      method: 'POST',
      headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {},
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  // PDF 대진표 업로드 (백엔드에서 파싱 → 참가자 + 히트 자동 생성)
  // onProgress(percent: 0~100) 콜백 옵션. XHR 기반이라 업로드 진행률 추적 가능.
  importParticipantsPdf(eventId, pdfFile, { onProgress } = {}) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', pdfFile);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/events/${eventId}/participants/import-pdf`);
      if (this.token) xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);

      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable || !onProgress) return;
        onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.upload.onload = () => onProgress && onProgress(100);

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({}); }
        } else {
          reject(new Error(xhr.responseText || `HTTP ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('네트워크 오류'));
      xhr.onabort = () => reject(new Error('업로드 취소됨'));
      xhr.send(formData);
    });
  }

  // Excel import
  async importExcel(eventId, file) {
    const formData = new FormData();
    formData.append('file', file);
    const url = `${this.baseUrl}/events/${eventId}/programs/import-excel`;
    const headers = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  // Programs (대진)
  async getPrograms(eventId) {
    return this.request(`/events/${eventId}/programs`);
  }

  async createProgram(eventId, data) {
    return this.request(`/events/${eventId}/programs`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProgram(eventId, programId, data) {
    return this.request(`/events/${eventId}/programs/${programId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProgram(eventId, programId) {
    return this.request(`/events/${eventId}/programs/${programId}`, {
      method: 'DELETE',
    });
  }

  async updateHeatAssignments(eventId, programId, assignments) {
    return this.request(`/events/${eventId}/programs/${programId}/assignments`, {
      method: 'PUT',
      body: JSON.stringify({ heat_assignments: assignments }),
    });
  }

  // Presets
  async getPresets() {
    return this.request('/presets');
  }

  async savePreset(data) {
    return this.request('/presets', { method: 'POST', body: JSON.stringify(data) });
  }

  async deletePreset(presetId) {
    return this.request(`/presets/${presetId}`, { method: 'DELETE' });
  }

  // Overlay 이미지 업로드 (로고/워터마크)
  async uploadOverlayImage(eventId, file) {
    const formData = new FormData();
    formData.append('file', file);
    const url = `${this.baseUrl}/events/${eventId}/overlay/upload-image`;
    const headers = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const res = await fetch(url, { method: 'POST', headers, body: formData });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  // Notifications
  async notifyHeat(heatId, channel = 'sms') {
    return this.request(`/heats/${heatId}/notify`, {
      method: 'POST',
      body: JSON.stringify({ channel }),
    });
  }

  async notifyAll(eventId, channel = 'sms') {
    return this.request(`/events/${eventId}/notify-all`, {
      method: 'POST',
      body: JSON.stringify({ channel }),
    });
  }

}

export const api = new ApiService();
export default api;
