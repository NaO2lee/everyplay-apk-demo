import uuid
from typing import Optional, List

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Participant
from app.schemas import ParticipantCreate, ParticipantUpdate


async def create_participant(
    db: AsyncSession,
    event_id: uuid.UUID,
    participant_data: ParticipantCreate,
) -> Participant:
    """Create a new participant"""
    participant = Participant(
        event_id=event_id,
        name=participant_data.name,
        phone=participant_data.phone,
        team=participant_data.team,
        category=participant_data.category,
    )
    db.add(participant)
    await db.commit()
    await db.refresh(participant)
    return participant


async def get_participant(db: AsyncSession, participant_id: uuid.UUID) -> Optional[Participant]:
    """Get participant by ID"""
    query = select(Participant).where(Participant.id == participant_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_participants(
    db: AsyncSession,
    event_id: uuid.UUID,
    search: Optional[str] = None,
    team: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[List[Participant], int]:
    """Get participants for an event"""
    query = select(Participant).where(Participant.event_id == event_id)
    count_query = select(func.count(Participant.id)).where(Participant.event_id == event_id)

    if search:
        search_filter = or_(
            Participant.name.ilike(f"%{search}%"),
            Participant.phone.ilike(f"%{search}%"),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if team:
        query = query.where(Participant.team == team)
        count_query = count_query.where(Participant.team == team)

    query = query.order_by(Participant.name).offset(skip).limit(limit)

    result = await db.execute(query)
    count_result = await db.execute(count_query)

    return result.scalars().all(), count_result.scalar()


async def update_participant(
    db: AsyncSession,
    participant_id: uuid.UUID,
    participant_data: ParticipantUpdate,
) -> Optional[Participant]:
    """Update participant"""
    participant = await get_participant(db, participant_id)
    if not participant:
        return None

    update_data = participant_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(participant, field, value)

    await db.commit()
    await db.refresh(participant)
    return participant


async def delete_participant(db: AsyncSession, participant_id: uuid.UUID) -> bool:
    """Delete participant"""
    participant = await get_participant(db, participant_id)
    if not participant:
        return False

    await db.delete(participant)
    await db.commit()
    return True


async def bulk_create_participants(
    db: AsyncSession,
    event_id: uuid.UUID,
    participants_data: List[dict],
) -> tuple[int, int, List[dict]]:
    """Bulk create participants from CSV data.

    각 row 를 savepoint 로 격리해서 실패한 row 가 전체 트랜잭션을 오염시키지 않도록 한다.
    """
    imported = 0
    failed = 0
    errors: List[dict] = []

    for idx, data in enumerate(participants_data, start=1):
        name = (data.get("name") or "").strip()
        phone = (data.get("phone") or "").replace("-", "").replace(" ", "")
        team = (data.get("team") or "").strip() or None
        category = (data.get("category") or "").strip() or None

        if not name or not phone:
            failed += 1
            errors.append({"row": idx, "message": "이름과 전화번호는 필수입니다"})
            continue

        try:
            # 각 row 마다 nested savepoint 로 격리
            async with db.begin_nested():
                participant = Participant(
                    event_id=event_id,
                    name=name,
                    phone=phone,
                    team=team,
                    category=category,
                )
                db.add(participant)
                # flush 로 개별 row 검증 (unique, length 등)
                await db.flush()
            imported += 1
        except Exception as e:
            failed += 1
            errors.append({"row": idx, "message": str(e)[:200]})

    if imported > 0:
        try:
            await db.commit()
        except Exception as e:
            await db.rollback()
            # 최종 commit 실패 — 전부 실패로 처리
            return 0, len(participants_data), [
                {"row": 0, "message": f"최종 commit 실패: {str(e)[:200]}"}
            ]

    return imported, failed, errors


# ── PDF 대진표 파서 ────────────────────────────────────────
# Korea Open Heat Sheets 형식 등의 대진표 PDF 에서 참가자 추출
# 핵심: 텍스트 라인 단위로 한글 이름 또는 영문 이름 패턴 매칭

import re

KOREAN_NAME_RE = re.compile(r"[가-힣]{2,4}")
ENGLISH_NAME_RE = re.compile(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b")
PHONE_RE = re.compile(r"01[016789][\s-]?\d{3,4}[\s-]?\d{4}")
HEAT_RE = re.compile(r"(?:Heat|HEAT|히트)\s*[#:]?\s*(\d+)", re.IGNORECASE)
EVENT_RE = re.compile(r"(30초|3분|2분|싱글|더블|크로스|프리스타일|stsl|sttl|drsr|drst|dut|3-jump|wheel)", re.IGNORECASE)
SKIP_KEYWORDS = ("page", "table of", "korea open", "heat sheet", "station", "court", "stage", "judge", "score")


async def import_from_pdf(
    db: AsyncSession,
    event_id: uuid.UUID,
    pdf_bytes: bytes,
) -> tuple[int, int, List[dict]]:
    """PDF 텍스트를 추출해 참가자 목록을 자동 등록한다.

    추출 전략:
    - pdfplumber 로 페이지별 텍스트 추출
    - 라인 단위로 분석: 한글 2~4자 이름이 등장하면 참가자로 간주
    - 같은 라인의 영문 단어/팀명을 team 에 매핑
    - phone 은 PDF 에 없을 가능성이 커서, 값이 없으면 dummy ("pdf-{slug}-{idx}") 로 채움 (사용자가 후에 수정)
    - 중복 이름은 스킵
    """
    try:
        import pdfplumber
    except ImportError:
        return 0, 0, [{"row": 0, "message": "pdfplumber 가 설치되어 있지 않습니다. requirements.txt 의존성 설치 필요"}]

    import io as _io
    parsed: list[dict] = []
    seen: set[str] = set()
    errors: list[dict] = []

    try:
        with pdfplumber.open(_io.BytesIO(pdf_bytes)) as pdf:
            for page_idx, page in enumerate(pdf.pages, start=1):
                try:
                    text = page.extract_text() or ""
                except Exception as e:
                    errors.append({"row": page_idx, "message": f"페이지 {page_idx} 텍스트 추출 실패: {str(e)[:100]}"})
                    continue

                current_event: Optional[str] = None
                current_heat: Optional[int] = None

                for line in text.splitlines():
                    line = line.strip()
                    if not line:
                        continue

                    low = line.lower()
                    if any(kw in low for kw in SKIP_KEYWORDS) and not KOREAN_NAME_RE.search(line):
                        # 헤더/타이틀 라인 스킵 (단 한글 이름이 같이 있으면 처리)
                        m_event = EVENT_RE.search(line)
                        if m_event:
                            current_event = m_event.group(0)
                        m_heat = HEAT_RE.search(line)
                        if m_heat:
                            try:
                                current_heat = int(m_heat.group(1))
                            except ValueError:
                                pass
                        continue

                    # event/heat 컨텍스트 갱신
                    m_event = EVENT_RE.search(line)
                    if m_event:
                        current_event = m_event.group(0)
                    m_heat = HEAT_RE.search(line)
                    if m_heat:
                        try:
                            current_heat = int(m_heat.group(1))
                        except ValueError:
                            pass

                    phones = PHONE_RE.findall(line)
                    phone = phones[0].replace(" ", "").replace("-", "") if phones else None

                    # 한글 이름 우선 추출
                    names = KOREAN_NAME_RE.findall(line)
                    if not names:
                        # 영문 이름 (Wing Tung Wong 같은)
                        eng_match = ENGLISH_NAME_RE.search(line)
                        if eng_match:
                            names = [eng_match.group(0)]

                    for name in names:
                        if name in seen:
                            continue
                        seen.add(name)
                        parsed.append({
                            "name": name,
                            "phone": phone or f"pdf-{len(seen):04d}",
                            "category": current_event,
                            "team": None,
                            "_heat": current_heat,
                        })
    except Exception as e:
        return 0, 0, [{"row": 0, "message": f"PDF 파싱 실패: {str(e)[:200]}"}]

    if not parsed:
        return 0, 0, [{"row": 0, "message": "PDF 에서 참가자 이름을 추출하지 못했습니다. PDF 형식을 확인해주세요."}]

    imported, failed, row_errors = await bulk_create_participants(db, event_id, parsed)
    errors.extend(row_errors)
    return imported, failed, errors
