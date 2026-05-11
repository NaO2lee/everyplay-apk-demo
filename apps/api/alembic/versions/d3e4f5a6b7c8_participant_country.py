"""participants.country_code (v3.3 — 국기 표시용)

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-05-10 22:50:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "d3e4f5a6b7c8"
down_revision: Union[str, None] = "c2d3e4f5a6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("participants") as batch:
        batch.add_column(sa.Column("country_code", sa.String(length=8), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("participants") as batch:
        batch.drop_column("country_code")
