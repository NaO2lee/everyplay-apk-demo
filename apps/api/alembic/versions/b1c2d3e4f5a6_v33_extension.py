"""v3.3 extension: stations meta, scoring, push, awards, appeals, tiebreakers, reruns, audit_logs, role enum

Revision ID: b1c2d3e4f5a6
Revises: 72356a4236c0
Create Date: 2026-05-09 11:10:00.000000

v3.3 통합 플랫폼 신규 스키마.

추가:
- stations: is_active, position_x, position_y, display_name 컬럼
- users: role enum에 judge/player/coach 추가 (SQLite는 CHECK 제약 재생성)
- 신규 테이블 9개:
  - scores              심판 채점 입력
  - score_submissions   제출 추적 매트릭스
  - device_tokens       BYOD 인증 디바이스 토큰
  - push_subscriptions  Web Push 구독
  - awards              시상 흐름
  - appeals             이의신청
  - tiebreakers         별도 재경기 (동점)
  - reruns              현장 즉시 재진행 (음악 오류 등)
  - audit_logs          immutable 감사 로그
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import app.core.types


# revision identifiers, used by Alembic.
revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, None] = "72356a4236c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) stations 컬럼 추가 (server_default — Postgres·SQLite 양쪽 호환)
    with op.batch_alter_table("stations") as batch:
        batch.add_column(sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))
        batch.add_column(sa.Column("position_x", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("position_y", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("display_name", sa.String(length=100), nullable=True))

    # 2) users.role enum 확장 (admin/operator/judge/player/coach)
    with op.batch_alter_table("users") as batch:
        batch.alter_column(
            "role",
            existing_type=sa.Enum("ADMIN", "OPERATOR", name="userrole"),
            type_=sa.Enum("ADMIN", "OPERATOR", "JUDGE", "PLAYER", "COACH", name="userrole"),
            existing_nullable=False,
        )

    # 3) scores — 심판이 입력한 점수
    op.create_table(
        "scores",
        sa.Column("id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("heat_id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("participant_id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("judge_user_id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("event_code", sa.String(length=20), nullable=False),  # SRSS, SRIF, DDSS 등
        sa.Column("payload", sa.JSON(), nullable=False),  # 종목별 동적 폼 결과 (JSON Schema)
        sa.Column("status", sa.String(length=20), nullable=False, server_default="submitted"),  # draft / submitted / verified
        sa.Column("submitted_at", sa.DateTime(), nullable=False),
        sa.Column("verified_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["heat_id"], ["heats.id"]),
        sa.ForeignKeyConstraint(["participant_id"], ["participants.id"]),
        sa.ForeignKeyConstraint(["judge_user_id"], ["users.id"]),
    )
    op.create_index("ix_scores_heat_id", "scores", ["heat_id"])
    op.create_index("ix_scores_judge_user_id", "scores", ["judge_user_id"])

    # 4) score_submissions — 심판×히트 매트릭스 추적
    op.create_table(
        "score_submissions",
        sa.Column("id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("heat_id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("judge_user_id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("expected_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("submitted_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),  # pending / in_progress / done
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("heat_id", "judge_user_id", name="uq_submission_heat_judge"),
        sa.ForeignKeyConstraint(["heat_id"], ["heats.id"]),
        sa.ForeignKeyConstraint(["judge_user_id"], ["users.id"]),
    )

    # 5) device_tokens — BYOD 인증 토큰 (30일 유효)
    op.create_table(
        "device_tokens",
        sa.Column("id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("user_id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),  # SHA-256
        sa.Column("device_label", sa.String(length=200), nullable=True),  # User-Agent 요약
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("ix_device_tokens_user_id", "device_tokens", ["user_id"])

    # 6) push_subscriptions — Web Push (VAPID)
    op.create_table(
        "push_subscriptions",
        sa.Column("id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("user_id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("endpoint", sa.String(length=500), nullable=False),
        sa.Column("p256dh_key", sa.String(length=200), nullable=False),
        sa.Column("auth_key", sa.String(length=100), nullable=False),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("endpoint"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("ix_push_subscriptions_user_id", "push_subscriptions", ["user_id"])

    # 7) awards — 시상 흐름
    op.create_table(
        "awards",
        sa.Column("id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("event_id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("program_id", app.core.types.GUID(length=36), nullable=True),
        sa.Column("rank", sa.Integer(), nullable=False),  # 1 / 2 / 3
        sa.Column("participant_id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=True),  # 종목·부문
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),  # pending / called / confirmed / done
        sa.Column("called_at", sa.DateTime(), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(), nullable=True),
        sa.Column("done_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"]),
        sa.ForeignKeyConstraint(["program_id"], ["programs.id"]),
        sa.ForeignKeyConstraint(["participant_id"], ["participants.id"]),
    )

    # 8) appeals — 이의신청
    op.create_table(
        "appeals",
        sa.Column("id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("event_id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("heat_id", app.core.types.GUID(length=36), nullable=True),
        sa.Column("participant_id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("appellant_user_id", app.core.types.GUID(length=36), nullable=True),  # 코치 또는 선수
        sa.Column("reason_code", sa.String(length=40), nullable=False),  # scoring_error, video_review, wrong_athlete, other
        sa.Column("reason_text", sa.String(length=2000), nullable=True),
        sa.Column("video_timestamp", sa.String(length=40), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),  # pending / approved / rejected / escalated
        sa.Column("filed_at", sa.DateTime(), nullable=False),
        sa.Column("decided_at", sa.DateTime(), nullable=True),
        sa.Column("decided_by", app.core.types.GUID(length=36), nullable=True),
        sa.Column("decision_text", sa.String(length=2000), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"]),
        sa.ForeignKeyConstraint(["heat_id"], ["heats.id"]),
        sa.ForeignKeyConstraint(["participant_id"], ["participants.id"]),
        sa.ForeignKeyConstraint(["appellant_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["decided_by"], ["users.id"]),
    )
    op.create_index("ix_appeals_event_id", "appeals", ["event_id"])
    op.create_index("ix_appeals_status", "appeals", ["status"])

    # 9) tiebreakers — 별도 섹션 동점 재경기
    op.create_table(
        "tiebreakers",
        sa.Column("id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("event_id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("original_heat_id", app.core.types.GUID(length=36), nullable=True),
        sa.Column("program_id", app.core.types.GUID(length=36), nullable=True),
        sa.Column("tied_participant_ids", sa.JSON(), nullable=False),  # list of UUID strings
        sa.Column("detection_method", sa.String(length=20), nullable=False, server_default="auto"),  # auto / manual
        sa.Column("scheduled_at", sa.DateTime(), nullable=True),
        sa.Column("court_id", app.core.types.GUID(length=36), nullable=True),  # FK to stations
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),  # pending / scheduled / completed / cancelled
        sa.Column("result_heat_id", app.core.types.GUID(length=36), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"]),
        sa.ForeignKeyConstraint(["original_heat_id"], ["heats.id"]),
        sa.ForeignKeyConstraint(["program_id"], ["programs.id"]),
        sa.ForeignKeyConstraint(["court_id"], ["stations.id"]),
        sa.ForeignKeyConstraint(["result_heat_id"], ["heats.id"]),
    )

    # 10) reruns — 현장 즉시 재진행 (Freestyle 음악 오류 등)
    op.create_table(
        "reruns",
        sa.Column("id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("heat_id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("participant_id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("reason_code", sa.String(length=40), nullable=False),  # music_failed / system / disturbance / other
        sa.Column("reason_text", sa.String(length=500), nullable=True),
        sa.Column("requested_by_judge_id", app.core.types.GUID(length=36), nullable=True),
        sa.Column("approved_by_operator_id", app.core.types.GUID(length=36), nullable=True),
        sa.Column("original_started_at", sa.DateTime(), nullable=True),
        sa.Column("rerun_started_at", sa.DateTime(), nullable=True),
        sa.Column("audit_note", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["heat_id"], ["heats.id"]),
        sa.ForeignKeyConstraint(["participant_id"], ["participants.id"]),
        sa.ForeignKeyConstraint(["requested_by_judge_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["approved_by_operator_id"], ["users.id"]),
    )

    # 11) audit_logs — 모든 변경 immutable 보존
    op.create_table(
        "audit_logs",
        sa.Column("id", app.core.types.GUID(length=36), nullable=False),
        sa.Column("actor_id", app.core.types.GUID(length=36), nullable=True),
        sa.Column("actor_role", sa.String(length=20), nullable=True),
        sa.Column("action_type", sa.String(length=40), nullable=False),  # score_change / appeal_decided / rerun_approved / etc
        sa.Column("target_type", sa.String(length=40), nullable=False),  # score / heat / appeal / etc
        sa.Column("target_id", app.core.types.GUID(length=36), nullable=True),
        sa.Column("before_value", sa.JSON(), nullable=True),
        sa.Column("after_value", sa.JSON(), nullable=True),
        sa.Column("reason", sa.String(length=500), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_target", "audit_logs", ["target_type", "target_id"])
    op.create_index("ix_audit_logs_timestamp", "audit_logs", ["timestamp"])


def downgrade() -> None:
    op.drop_index("ix_audit_logs_timestamp", table_name="audit_logs")
    op.drop_index("ix_audit_logs_target", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_table("reruns")
    op.drop_table("tiebreakers")
    op.drop_index("ix_appeals_status", table_name="appeals")
    op.drop_index("ix_appeals_event_id", table_name="appeals")
    op.drop_table("appeals")
    op.drop_table("awards")
    op.drop_index("ix_push_subscriptions_user_id", table_name="push_subscriptions")
    op.drop_table("push_subscriptions")
    op.drop_index("ix_device_tokens_user_id", table_name="device_tokens")
    op.drop_table("device_tokens")
    op.drop_table("score_submissions")
    op.drop_index("ix_scores_judge_user_id", table_name="scores")
    op.drop_index("ix_scores_heat_id", table_name="scores")
    op.drop_table("scores")

    with op.batch_alter_table("users") as batch:
        batch.alter_column(
            "role",
            existing_type=sa.Enum("ADMIN", "OPERATOR", "JUDGE", "PLAYER", "COACH", name="userrole"),
            type_=sa.Enum("ADMIN", "OPERATOR", name="userrole"),
            existing_nullable=False,
        )

    with op.batch_alter_table("stations") as batch:
        batch.drop_column("display_name")
        batch.drop_column("position_y")
        batch.drop_column("position_x")
        batch.drop_column("is_active")
