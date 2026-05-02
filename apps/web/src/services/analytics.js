/**
 * Google Analytics 4 이벤트 헬퍼.
 * gtag 가 index.html 에서 로드되어 있어야 한다.
 */

export function track(eventName, params = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  try {
    window.gtag('event', eventName, params);
  } catch (e) {
    // 분석 실패가 사용자 흐름을 막으면 안 됨
    if (typeof console !== 'undefined') console.warn('[analytics]', e);
  }
}

// === 정의된 이벤트 ===

export function trackCourtClick({ stationId, stationNumber, eventCode, isLive }) {
  track('court_click', {
    station_id: stationId,
    station_number: stationNumber,
    event_code: eventCode,
    is_live: !!isLive,
  });
}

export function trackSearchUse({ eventCode }) {
  track('search_use', {
    event_code: eventCode,
  });
}

export function trackSearchResultClick({ eventCode, stationNumber, heatNumber, participantName }) {
  track('search_result_click', {
    event_code: eventCode,
    station_number: stationNumber,
    heat_number: heatNumber,
    participant_name: participantName,
  });
}

export function trackEventView({ eventCode, eventName }) {
  track('event_view', {
    event_code: eventCode,
    event_name: eventName,
  });
}
