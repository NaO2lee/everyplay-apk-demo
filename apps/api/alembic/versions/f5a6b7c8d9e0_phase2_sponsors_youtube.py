"""phase2 merge: sponsors / ads / youtube_accounts / participant_entries / session_broadcasts

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-05-11 19:00:00.000000

MEDIUM priority merge — 5/11 운영 신규 테이블:
- sponsors + event_sponsors (광고/협회/파트너)
- ad_settings + ad_slots (광고 그리드)
- youtube_accounts (OAuth 풀)
- participant_entries (다종목 출전)
- session_broadcasts (세션×스테이션 방송 정보)
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
import app.core.types


revision: str = "f5a6b7c8d9e0"
down_revision: Union[str, None] = "e4f5a6b7c8d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── sponsors ─────────────────────────────────────────────────
    op.create_table(
        "sponsors",
        sa.Column("id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("logo_url", sa.String(length=500), nullable=True),
        sa.Column("banner_image_url", sa.String(length=500), nullable=True),
        sa.Column("banner_position", sa.String(length=50), nullable=True),
        sa.Column("banner_zoom", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("tagline", sa.String(length=300), nullable=True),
        sa.Column("kind", sa.Enum("AD", "PROMOTION", "PARTNER", name="sponsorkind"), nullable=False, server_default="AD"),
        sa.Column("cta_text", sa.String(length=100), nullable=True),
        sa.Column("cta_url", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "event_sponsors",
        sa.Column("id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("event_id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("sponsor_id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("slot_type", sa.Enum("INLINE", "HERO", name="sponsorslottype"), nullable=False, server_default="INLINE"),
        sa.Column("weight", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sponsor_id"], ["sponsors.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ─── ads ──────────────────────────────────────────────────────
    op.create_table(
        "ad_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("grid_template", sa.String(length=50), nullable=True),
        sa.Column("cell_height", sa.Integer(), nullable=True),
        sa.Column("row_heights", sa.String(length=200), nullable=True),
        sa.Column("slot_modes", sa.String(length=500), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "ad_slots",
        sa.Column("id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("sponsor_id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("slot_index", sa.Integer(), nullable=False),
        sa.Column("banner_position", sa.String(length=50), nullable=True),
        sa.Column("banner_zoom", sa.Integer(), nullable=True),
        sa.Column("banner_fit", sa.String(length=20), nullable=True),
        sa.Column("banner_offset_x", sa.Integer(), nullable=True),
        sa.Column("banner_offset_y", sa.Integer(), nullable=True),
        sa.Column("weight", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["sponsor_id"], ["sponsors.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ad_slots_slot_index", "ad_slots", ["slot_index"])

    # ─── youtube_accounts ─────────────────────────────────────────
    op.create_table(
        "youtube_accounts",
        sa.Column("id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("email", sa.String(length=200), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=True),
        sa.Column("client_id", sa.String(length=500), nullable=True),
        sa.Column("client_secret", sa.String(length=500), nullable=True),
        sa.Column("refresh_token", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

    # ─── participant_entries ──────────────────────────────────────
    op.create_table(
        "participant_entries",
        sa.Column("id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("participant_id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("event_code", sa.String(length=20), nullable=True),
        sa.Column("entry_number", sa.String(length=20), nullable=True),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["participant_id"], ["participants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ─── session_broadcasts ───────────────────────────────────────
    op.create_table(
        "session_broadcasts",
        sa.Column("session_id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("station_id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("broadcast_actual_start_time", sa.DateTime(), nullable=True),
        sa.Column("youtube_live_url", sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(["session_id"], ["operation_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["station_id"], ["stations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("session_id", "station_id"),
    )

    # ─── stations.youtube_account_id FK (now that table exists) ───
    with op.batch_alter_table("stations") as batch:
        batch.add_column(sa.Column("youtube_account_id", app.core.types.GUID(length=36), nullable=True))
        batch.create_foreign_key(
            "fk_stations_youtube_account_id", "youtube_accounts",
            ["youtube_account_id"], ["id"], ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("stations") as batch:
        batch.drop_constraint("fk_stations_youtube_account_id", type_="foreignkey")
        batch.drop_column("youtube_account_id")
    op.drop_table("session_broadcasts")
    op.drop_table("participant_entries")
    op.drop_table("youtube_accounts")
    op.drop_index("ix_ad_slots_slot_index", table_name="ad_slots")
    op.drop_table("ad_slots")
    op.drop_table("ad_settings")
    op.drop_table("event_sponsors")
    op.drop_table("sponsors")
    op.execute("DROP TYPE IF EXISTS sponsorkind")
    op.execute("DROP TYPE IF EXISTS sponsorslottype")
