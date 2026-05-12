"""Seed sponsors + event-sponsor links + ad slots + 1 award for /hub demo testing.

Run with: venv/Scripts/python.exe seed_demo_sponsors.py
Idempotent — re-running deletes prior seed rows by name marker '[DEMO]'.
"""
import asyncio
import os
import uuid
from datetime import datetime

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# Load .env
for line in open(os.path.join(os.path.dirname(__file__), ".env")):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        os.environ[k] = v.strip('"').strip("'")

EVENT_ID = "fa40b6f8-a463-4100-9a3e-f89f8214ad57"  # Korea Open Demo (v3.3)

SPONSORS = [
    {
        "name": "[DEMO] 코오롱스포츠",
        "tagline": "줄 하나로 세상을 잇다",
        "kind": "PARTNER",
        "logo_url": None,
        "banner_image_url": "https://placehold.co/1200x300/3b82f6/ffffff/png?text=KOLON+SPORT",
        "banner_position": "center",
        "banner_zoom": 100,
        "cta_text": "공식 사이트",
        "cta_url": "https://kolonsport.com",
    },
    {
        "name": "[DEMO] 위플레이 광고",
        "tagline": "스포츠 라이브를 다시 정의하다",
        "kind": "AD",
        "banner_image_url": "https://placehold.co/1200x300/ea580c/ffffff/png?text=WEPLAY+AD",
        "banner_position": "center",
        "banner_zoom": 100,
        "cta_text": "더 알아보기",
        "cta_url": "https://weplaykorea.com",
    },
    {
        "name": "[DEMO] 점프로프 코리아",
        "tagline": "Pure jump rope, pure performance",
        "kind": "PROMOTION",
        "banner_image_url": "https://placehold.co/1200x300/16a34a/ffffff/png?text=JUMPROPE+KOREA",
        "banner_position": "center",
        "banner_zoom": 100,
    },
]


async def main():
    eng = create_async_engine(os.environ["DATABASE_URL"])
    async with eng.begin() as c:
        # Clean prior [DEMO] seed rows
        await c.execute(text("DELETE FROM ad_slots WHERE sponsor_id IN (SELECT id FROM sponsors WHERE name LIKE '[DEMO]%')"))
        await c.execute(text("DELETE FROM event_sponsors WHERE sponsor_id IN (SELECT id FROM sponsors WHERE name LIKE '[DEMO]%')"))
        await c.execute(text("DELETE FROM sponsors WHERE name LIKE '[DEMO]%'"))
        await c.execute(text("DELETE FROM awards WHERE event_id = :eid AND status::text = 'pending'"), {"eid": EVENT_ID})

        # Insert sponsors
        sponsor_ids = []
        for sp in SPONSORS:
            sid = str(uuid.uuid4())
            sponsor_ids.append(sid)
            await c.execute(
                text("""
                    INSERT INTO sponsors (id, name, tagline, kind, logo_url, banner_image_url,
                                          banner_position, banner_zoom, cta_text, cta_url, created_at)
                    VALUES (:id, :name, :tag, :kind, :logo, :banner, :pos, :zoom, :ctaT, :ctaU, :now)
                """),
                {
                    "id": sid, "name": sp["name"], "tag": sp.get("tagline"),
                    "kind": sp["kind"],
                    "logo": sp.get("logo_url"),
                    "banner": sp.get("banner_image_url"),
                    "pos": sp.get("banner_position", "center"),
                    "zoom": sp.get("banner_zoom", 100),
                    "ctaT": sp.get("cta_text"),
                    "ctaU": sp.get("cta_url"),
                    "now": datetime.utcnow(),
                },
            )

        # Link first 2 sponsors to Korea Open Demo event
        for i, sid in enumerate(sponsor_ids[:2]):
            await c.execute(
                text("""
                    INSERT INTO event_sponsors (id, event_id, sponsor_id, slot_type, weight, active, created_at)
                    VALUES (:id, :eid, :sid, :slot, :w, true, :now)
                """),
                {"id": str(uuid.uuid4()), "eid": EVENT_ID, "sid": sid,
                 "slot": "HERO" if i == 0 else "INLINE", "w": 10 - i,
                 "now": datetime.utcnow()},
            )

        # Ad slot — use 3rd sponsor in global ad grid
        await c.execute(
            text("""
                INSERT INTO ad_slots (id, slot_index, sponsor_id, weight, active, created_at)
                VALUES (:id, :idx, :sid, :w, true, :now)
            """),
            {"id": str(uuid.uuid4()), "idx": 0, "sid": sponsor_ids[2], "w": 5, "now": datetime.utcnow()},
        )

        # 3 pending awards (1·2·3위) — for /admin-awards demo
        r2 = await c.execute(text(
            "SELECT id FROM participants WHERE event_id = :eid ORDER BY name LIMIT 3"
        ), {"eid": EVENT_ID})
        participants = [row[0] for row in r2]
        for rank, pid in enumerate(participants, start=1):
            await c.execute(
                text("""
                    INSERT INTO awards (id, event_id, participant_id, rank, status)
                    VALUES (:id, :eid, :pid, :rank, 'pending')
                """),
                {"id": str(uuid.uuid4()), "eid": EVENT_ID, "pid": pid, "rank": rank},
            )

    print("✓ Seeded:")
    print(f"  - {len(SPONSORS)} sponsors")
    print(f"  - 2 event-sponsor links (Korea Open Demo)")
    print(f"  - 1 ad slot")
    print(f"  - 3 pending awards (1·2·3위)")
    await eng.dispose()


asyncio.run(main())
