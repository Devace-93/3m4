"""API-key roles (RBAC) + append-only audit_events table.

Revision ID: 0001_api_key_roles_audit
Revises: None

Idempotent on purpose: fresh installs get the schema from ``create_all`` before
this runs, so every step checks the live schema first.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001_api_key_roles_audit"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    cols = {c["name"] for c in insp.get_columns("api_keys")}
    if "role" not in cols:
        # Existing keys predate roles and had full access: keep that behaviour.
        op.add_column(
            "api_keys",
            sa.Column("role", sa.String(20), nullable=False, server_default="admin"),
        )

    if "audit_events" not in insp.get_table_names():
        op.create_table(
            "audit_events",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "account_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("accounts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("ts", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("actor_type", sa.String(20), nullable=False),
            sa.Column("actor_id", postgresql.UUID(as_uuid=True)),
            sa.Column("actor_label", sa.String(120)),
            sa.Column("action", sa.String(60), nullable=False),
            sa.Column("target_type", sa.String(40)),
            sa.Column("target_id", sa.String(64)),
            sa.Column("outcome", sa.String(20), nullable=False, server_default="ok"),
            sa.Column("meta", postgresql.JSONB, nullable=False, server_default="{}"),
        )
        op.create_index("ix_audit_events_account_ts", "audit_events", ["account_id", "ts"])


def downgrade() -> None:
    op.drop_index("ix_audit_events_account_ts", table_name="audit_events")
    op.drop_table("audit_events")
    op.drop_column("api_keys", "role")
