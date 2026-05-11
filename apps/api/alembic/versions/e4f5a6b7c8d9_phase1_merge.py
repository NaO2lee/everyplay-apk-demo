"""phase1 merge: 5/11 운영 신규 필드 (Event/Station/Heat/Participant)

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-05-11 18:00:00.000000

HIGH priority merge from weplay21c/everyone-play (5/11 운영 최신):
- Event: name_en, recording_path_template, location, hero_color, poster_url, poster_position, poster_zoom, pinned, deleted_at + EventStatus.PUBLISHED
- Station: mirror_of_station_id, youtube_live_url, broadcast_actual_start_time
- Heat: HeatStatus.SCHEDULED + clip_error
- Participant: phone nullable + entry_number + event_code
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
import app.core.types


revision: str = "e4f5a6b7c8d9"
down_revision: Union[str, None] = "d3e4f5a6b7c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    # ─── EventStatus enum 확장 ─────────────────────────────────────
    if is_postgres:
        op.execute("ALTER TYPE eventstatus ADD VALUE IF NOT EXISTS 'PUBLISHED'")
        op.execute("ALTER TYPE heatstatus ADD VALUE IF NOT EXISTS 'SCHEDULED'")

    # ─── Event 신규 컬럼 ────────────────────────────────────────────
    with op.batch_alter_table("events") as batch:
        batch.add_column(sa.Column("name_en", sa.String(length=500), nullable=True))
        batch.add_column(sa.Column("recording_path_template", sa.String(length=500), nullable=True))
        batch.add_column(sa.Column("location", sa.String(length=200), nullable=True))
        batch.add_column(sa.Column("hero_color", sa.String(length=20), nullable=True))
        batch.add_column(sa.Column("poster_url", sa.String(length=500), nullable=True))
        batch.add_column(sa.Column("poster_position", sa.String(length=50), nullable=True))
        batch.add_column(sa.Column("poster_zoom", sa.Integer(), nullable=False, server_default="100"))
        batch.add_column(sa.Column("pinned", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.add_column(sa.Column("deleted_at", sa.DateTime(), nullable=True))

    # ─── Station 신규 컬럼 ──────────────────────────────────────────
    with op.batch_alter_table("stations") as batch:
        batch.add_column(sa.Column("mirror_of_station_id", app.core.types.GUID(length=36), nullable=True))
        batch.add_column(sa.Column("youtube_live_url", sa.String(length=500), nullable=True))
        batch.add_column(sa.Column("broadcast_actual_start_time", sa.DateTime(), nullable=True))
        # mirror_of_station_id self-FK (SET NULL on delete)
        batch.create_foreign_key(
            "fk_stations_mirror_of_station_id", "stations",
            ["mirror_of_station_id"], ["id"], ondelete="SET NULL",
        )

    # ─── Heat 신규 컬럼 ────────────────────────────────────────────
    with op.batch_alter_table("heats") as batch:
        batch.add_column(sa.Column("clip_error", sa.Text(), nullable=True))

    # ─── Participant 신규 컬럼 + phone nullable ────────────────────
    with op.batch_alter_table("participants") as batch:
        batch.add_column(sa.Column("entry_number", sa.String(length=20), nullable=True))
        batch.add_column(sa.Column("event_code", sa.String(length=20), nullable=True))
        # phone NOT NULL → nullable (Korea Open 같은 IJRU 대회 대응)
        batch.alter_column("phone", existing_type=sa.String(length=20), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("participants") as batch:
        batch.alter_column("phone", existing_type=sa.String(length=20), nullable=False)
        batch.drop_column("event_code")
        batch.drop_column("entry_number")

    with op.batch_alter_table("heats") as batch:
        batch.drop_column("clip_error")

    with op.batch_alter_table("stations") as batch:
        batch.drop_constraint("fk_stations_mirror_of_station_id", type_="foreignkey")
        batch.drop_column("broadcast_actual_start_time")
        batch.drop_column("youtube_live_url")
        batch.drop_column("mirror_of_station_id")

    with op.batch_alter_table("events") as batch:
        batch.drop_column("deleted_at")
        batch.drop_column("pinned")
        batch.drop_column("poster_zoom")
        batch.drop_column("poster_position")
        batch.drop_column("poster_url")
        batch.drop_column("hero_color")
        batch.drop_column("location")
        batch.drop_column("recording_path_template")
        batch.drop_column("name_en")
    # Postgres enum 값은 ADD만 가능, 제거는 복잡 — 다운그레이드 시 enum 값 그대로 둠
