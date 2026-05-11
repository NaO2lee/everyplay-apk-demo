"""대규모 heat 시뮬레이션 — 50명 1 heat 부하 테스트.

실행:
  python seed_v33_bigheat.py

생성:
  - Event "Big Heat Stress Test" (event_code='STRESS-50')
  - Court 1 (활성)
  - 50명 selene
  - Heat 1 (50명 모두 배정)

확인:
  - 매트릭스 expected_count = 50
  - 50개 score 일괄 제출 후 submitted_count = 50, status='done'
"""

import asyncio
import uuid
from datetime import date, datetime

from sqlalchemy import select

from app.core.database import async_session
from app.models import (
    Event, EventStatus, Station, StationStatus,
    Participant, Heat,
)
from app.models.heat import heat_participants


EVENT_CODE = "STRESS-50"
N = 50


async def main():
    async with async_session() as s:
        # Event
        ev_res = await s.execute(select(Event).where(Event.event_code == EVENT_CODE))
        ev = ev_res.scalar_one_or_none()
        if not ev:
            ev = Event(name="Big Heat Stress Test", date=date.today(), status=EventStatus.ACTIVE,
                      event_code=EVENT_CODE, station_count=1)
            s.add(ev)
            await s.flush()
            print(f"  [+] Event: {ev.id}")
        else:
            print(f"  [skip] Event 존재: {ev.id}")

        # Station
        st_res = await s.execute(select(Station).where(Station.event_id == ev.id))
        st = st_res.scalar_one_or_none()
        if not st:
            st = Station(event_id=ev.id, station_number=1, status=StationStatus.IDLE,
                        is_active=True, position_x=0, position_y=0, display_name="Stress Court")
            s.add(st)
            await s.flush()
            print(f"  [+] Station: {st.id}")
        else:
            print(f"  [skip] Station 존재: {st.id}")

        # 50 selene
        p_res = await s.execute(select(Participant).where(Participant.event_id == ev.id))
        existing = p_res.scalars().all()
        if len(existing) >= N:
            parts = list(existing[:N])
            print(f"  [skip] Participant {len(existing)}명 이미 존재")
        else:
            need = N - len(existing)
            parts = list(existing)
            for i in range(len(existing), N):
                p = Participant(event_id=ev.id, name=f"Athlete-{i+1:02}",
                              phone=f"010-9000-{i+1:04}", country_code="KR")
                s.add(p)
                parts.append(p)
            await s.flush()
            print(f"  [+] Participant {need}명 추가 (총 {N}명)")

        # Heat with all 50
        h_res = await s.execute(select(Heat).where(Heat.station_id == st.id))
        h = h_res.scalar_one_or_none()
        if not h:
            h = Heat(station_id=st.id, heat_number=1, started_at=datetime.utcnow())
            s.add(h)
            await s.flush()
            for p in parts:
                await s.execute(heat_participants.insert().values(heat_id=h.id, participant_id=p.id))
            print(f"  [+] Heat 50명 배정: {h.id}")
        else:
            print(f"  [skip] Heat 존재: {h.id}")

        await s.commit()

        print()
        print("=" * 60)
        print(f"event_id:  {ev.id}")
        print(f"heat_id:   {h.id}")
        print(f"selene:    {len(parts)} (expected_count 매트릭스 = {len(parts)})")
        print()
        print("다음 명령으로 50개 score 일괄 제출 가능:")
        print(f"  bash test_50score.sh {h.id}")


if __name__ == "__main__":
    asyncio.run(main())
