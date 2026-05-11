"""v3.3 실시간 SSE 라우터.

엔드포인트:
- GET /realtime/event/{event_id}/sse    이벤트 단위 실시간 채널 (관전 + 운영 공통)

이벤트 타입:
- score_submitted     심판이 점수 제출
- award_changed       시상 status 변경
- court_meta_changed  코트 활성/표시명 변경
- no_show_called      안왔음 호출
- appeal_filed        이의 신청

Publish helper: `await event_broker.publish(event_id, {"type": "...", "data": ...})`
"""

import asyncio
import json
from typing import Dict, Set
from uuid import UUID

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/realtime", tags=["realtime"])


class EventBroker:
    """이벤트(대회) 단위 SSE 구독자 관리."""

    def __init__(self):
        self._subscribers: Dict[str, Set[asyncio.Queue]] = {}

    def subscribe(self, event_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        self._subscribers.setdefault(event_id, set()).add(q)
        return q

    def unsubscribe(self, event_id: str, q: asyncio.Queue) -> None:
        s = self._subscribers.get(event_id)
        if s:
            s.discard(q)
            if not s:
                self._subscribers.pop(event_id, None)

    async def publish(self, event_id: str, payload: dict) -> None:
        for q in list(self._subscribers.get(event_id, set())):
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                pass


event_broker = EventBroker()


@router.get("/event/{event_id}/sse")
async def event_sse(event_id: UUID):
    """이벤트 단위 실시간 SSE — /watch, /admin-matrix 등이 구독.

    이벤트 발생 즉시 클라이언트에 푸시. 폴링 대체.
    """
    eid = str(event_id)

    async def gen():
        queue = event_broker.subscribe(eid)
        try:
            yield f"event: connected\ndata: {json.dumps({'event_id': eid})}\n\n"
            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=25)
                    etype = payload.get("type", "update")
                    yield f"event: {etype}\ndata: {json.dumps(payload, ensure_ascii=False, default=str)}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            event_broker.unsubscribe(eid, queue)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )
