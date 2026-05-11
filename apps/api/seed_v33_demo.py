"""v3.3 데모 시드 데이터 — 내일 사용자 확인용.

실행:
  cd apps/api
  source venv/Scripts/activate
  python seed_v33_demo.py

생성:
  - Event 1개 (Korea Open Demo)
  - Station 2개 (Court 1, 2 — 활성, position 설정)
  - Participants 8명 (배번 1~8, 한국 + 외국)
  - Heat 4개 (코트당 2 히트, 각 4명씩 배정)

이미 존재하면 skip (event_code 'DEMO-2026-05'로 중복 체크).
출력에 heat_id, participant_id 표시 — /judge wizard에서 그대로 사용 가능.
"""

import asyncio
import uuid
from datetime import date, datetime

from sqlalchemy import select

from app.core.database import async_session
from app.models import (
    Event, EventStatus, Station, StationStatus,
    Participant, Heat, HeatStatus,
)
from app.models.heat import heat_participants


EVENT_CODE = "DEMO-2026-05"

PARTICIPANTS = [
    # (이름, 전화, 팀, 카테고리, 국적은 category에 임시로 저장)
    ("김민수",   "010-1111-0001", "서울 점프스카이", "12세 남자 한국"),
    ("이서연",   "010-1111-0002", "부산 줄넘기클럽", "12세 여자 한국"),
    ("박지훈",   "010-1111-0003", "대구 점프킹",     "14세 남자 한국"),
    ("최예린",   "010-1111-0004", "인천 로프업",     "14세 여자 한국"),
    ("Jordan Smith",  "+1-555-0005", "USA Jump Team",   "14 Boys USA"),
    ("Yuki Tanaka",   "+81-90-0006", "Tokyo JumpAcad",  "14 Girls JPN"),
    ("Wei Chen",      "+86-138-0007","Shanghai Ropes",  "12 Boys CHN"),
    ("Maria Silva",   "+55-11-0008", "Sao Paulo Jump",  "12 Girls BRA"),
]


async def get_or_create_event(s):
    res = await s.execute(select(Event).where(Event.event_code == EVENT_CODE))
    ev = res.scalar_one_or_none()
    if ev:
        print(f"  [skip] Event '{EVENT_CODE}' 이미 존재 (id={ev.id})")
        return ev
    ev = Event(
        name="Korea Open Demo (v3.3)",
        date=date.today(),
        status=EventStatus.ACTIVE,
        event_code=EVENT_CODE,
        station_count=2,
    )
    s.add(ev)
    await s.flush()
    print(f"  [+] Event 생성: {ev.id}  '{ev.name}'")
    return ev


async def get_or_create_stations(s, event_id):
    res = await s.execute(select(Station).where(Station.event_id == event_id))
    existing = res.scalars().all()
    if existing:
        print(f"  [skip] Station {len(existing)}개 이미 존재")
        return list(existing)
    stations = []
    for i in (1, 2):
        st = Station(
            event_id=event_id,
            station_number=i,
            status=StationStatus.IDLE,
            is_active=True,
            position_x=(i - 1) * 800,  # 좌(0) / 우(800)
            position_y=0,
            display_name=f"Court {i}",
        )
        s.add(st)
        stations.append(st)
    await s.flush()
    for st in stations:
        print(f"  [+] Station {st.station_number}: {st.id}  '{st.display_name}'")
    return stations


async def get_or_create_participants(s, event_id):
    res = await s.execute(select(Participant).where(Participant.event_id == event_id))
    existing = res.scalars().all()
    if existing:
        print(f"  [skip] Participant {len(existing)}명 이미 존재")
        return list(existing)
    parts = []
    for name, phone, team, cat in PARTICIPANTS:
        p = Participant(
            event_id=event_id,
            name=name,
            phone=phone,
            team=team,
            category=cat,
        )
        s.add(p)
        parts.append(p)
    await s.flush()
    for i, p in enumerate(parts, 1):
        print(f"  [+] Participant {i:2}: {p.id}  {p.name:14} ({p.team})")
    return parts


async def get_or_create_heats(s, stations, parts):
    # 코트당 2 히트, 각 히트에 4명씩
    res = await s.execute(select(Heat).where(Heat.station_id.in_([st.id for st in stations])))
    existing = res.scalars().all()
    if existing:
        print(f"  [skip] Heat {len(existing)}개 이미 존재")
        return list(existing)
    heats = []
    for st_idx, st in enumerate(stations):
        for h_num in (1, 2):
            h = Heat(
                station_id=st.id,
                heat_number=h_num,
                started_at=datetime.utcnow(),
            )
            s.add(h)
            heats.append((h, st_idx, h_num))
    await s.flush()

    # heat_participants 매핑: 히트당 4명, station_index/heat_number로 참가자 분배
    # st0 h1: parts[0..3], st0 h2: parts[4..7], st1 h1: parts[0..3] 다시, st1 h2: parts[4..7] 다시
    for h, st_idx, h_num in heats:
        offset = 0 if h_num == 1 else 4
        for p in parts[offset:offset + 4]:
            await s.execute(
                heat_participants.insert().values(heat_id=h.id, participant_id=p.id)
            )
        print(f"  [+] Heat: station={stations[st_idx].station_number} no={h_num} id={h.id}  (참가자 {offset+1}~{offset+4})")
    return [h for h, _, _ in heats]


async def main():
    print("=" * 70)
    print(f"v3.3 demo seed — event_code={EVENT_CODE}")
    print("=" * 70)
    async with async_session() as s:
        ev = await get_or_create_event(s)
        stations = await get_or_create_stations(s, ev.id)
        parts = await get_or_create_participants(s, ev.id)
        heats = await get_or_create_heats(s, stations, parts)
        await s.commit()

    print()
    print("=" * 70)
    print("✓ Seed 완료. /judge wizard 테스트용 IDs:")
    print("=" * 70)
    print("\n다음 정보를 /judge 4-step wizard에서 사용:")
    if heats:
        print(f"\n  Step 1 heat_id (예시):       {heats[0].id}")
    if parts:
        print(f"  Step 2 participant_id (예시): {parts[0].id}")
    print(f"  Step 4 event_code:            SRSS / SRIF / DDSS / DDPF / SRTU 중")
    print()
    print("관리자 매트릭스: /admin/matrix 또는 /admin/events/{event_id}/matrix")
    print(f"이벤트 ID: {ev.id}")


if __name__ == "__main__":
    asyncio.run(main())
