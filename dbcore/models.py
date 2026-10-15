"""SQLAlchemy models — the canonical data model for 3m4.

Tenancy: an Account is the billing entity. Users join accounts via Memberships.
Privacy: we never store raw IPs — only a salted hash and derived geo.

NOTE on partitioning: `clicks` is a plain table here for a runnable first build.
The production plan is monthly range-partitioning on `ts`; that is a follow-up
migration (see PROJECT_PLAN.md §4) and does not change the application code.
"""
from __future__ import annotations

import uuid
from datetime import datetime, date

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Index,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = _pk()
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    # current effective plan: free | pro | team | enterprise | selfhost
    plan: Mapped[str] = mapped_column(String(20), nullable=False, default="free")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    memberships: Mapped[list["Membership"]] = relationship(back_populates="account")
    links: Mapped[list["Link"]] = relationship(back_populates="account")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = _pk()
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    memberships: Mapped[list["Membership"]] = relationship(back_populates="user")


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("account_id", "user_id", name="uq_membership"),)

    id: Mapped[uuid.UUID] = _pk()
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="owner")  # owner|admin|member
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    account: Mapped[Account] = relationship(back_populates="memberships")
    user: Mapped[User] = relationship(back_populates="memberships")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = _pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = _pk()
    account_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), unique=True, index=True
    )
    rc_app_user_id: Mapped[str | None] = mapped_column(String(255), index=True)
    entitlement: Mapped[str | None] = mapped_column(String(20))   # pro | team
    product_id: Mapped[str | None] = mapped_column(String(120))
    period: Mapped[str | None] = mapped_column(String(12))        # monthly | annual
    status: Mapped[str | None] = mapped_column(String(30))        # active | expired | ...
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    will_renew: Mapped[bool] = mapped_column(Boolean, default=True)
    raw_payload: Mapped[dict | None] = mapped_column(JSONB)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Domain(Base):
    __tablename__ = "domains"

    id: Mapped[uuid.UUID] = _pk()
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), index=True)
    hostname: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    verification_token: Mapped[str] = mapped_column(String(64), nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    tls_status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Link(Base):
    __tablename__ = "links"
    __table_args__ = (
        # short_code is globally unique (apex only for now; domain_id reserved for Phase 4)
        UniqueConstraint("short_code", name="uq_link_short_code"),
        Index("ix_links_account", "account_id"),
    )

    id: Mapped[uuid.UUID] = _pk()
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    domain_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("domains.id", ondelete="SET NULL"))
    short_code: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    destination_url: Mapped[str] = mapped_column(Text, nullable=False)
    redirect_type: Mapped[int] = mapped_column(Integer, default=302)  # 301 | 302
    title: Mapped[str | None] = mapped_column(String(255))
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # denormalized lifetime counter (fast list views); analytics come from rollups
    click_count: Mapped[int] = mapped_column(Integer, default=0)

    account: Mapped[Account] = relationship(back_populates="links")


class Click(Base):
    __tablename__ = "clicks"
    __table_args__ = (Index("ix_clicks_link_ts", "link_id", "ts"),)

    id: Mapped[uuid.UUID] = _pk()
    link_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("links.id", ondelete="CASCADE"))
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    ip_hash: Mapped[str | None] = mapped_column(String(64))   # salted hash, NEVER raw IP
    country: Mapped[str | None] = mapped_column(String(2))
    region: Mapped[str | None] = mapped_column(String(120))
    city: Mapped[str | None] = mapped_column(String(120))
    device: Mapped[str | None] = mapped_column(String(20))    # desktop|mobile|tablet|bot
    os: Mapped[str | None] = mapped_column(String(40))
    browser: Mapped[str | None] = mapped_column(String(40))
    referrer_host: Mapped[str | None] = mapped_column(String(255))
    raw_ua: Mapped[str | None] = mapped_column(Text)


class ClickDailyRollup(Base):
    __tablename__ = "click_daily_rollup"
    __table_args__ = (UniqueConstraint("link_id", "day", name="uq_rollup_link_day"),)

    id: Mapped[uuid.UUID] = _pk()
    link_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("links.id", ondelete="CASCADE"), index=True)
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    day: Mapped[date] = mapped_column(Date, nullable=False)
    count: Mapped[int] = mapped_column(Integer, default=0)
    by_country: Mapped[dict] = mapped_column(JSONB, default=dict)
    by_device: Mapped[dict] = mapped_column(JSONB, default=dict)
    by_referrer: Mapped[dict] = mapped_column(JSONB, default=dict)


class UsageCounter(Base):
    __tablename__ = "usage_counters"
    __table_args__ = (UniqueConstraint("account_id", "period_start", name="uq_usage_period"),)

    id: Mapped[uuid.UUID] = _pk()
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), index=True)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    links_created: Mapped[int] = mapped_column(Integer, default=0)
    tracked_clicks: Mapped[int] = mapped_column(Integer, default=0)
    # set once when the clicks limit is first hit in a period (for one-shot PostHog event)
    clicks_limit_notified: Mapped[bool] = mapped_column(Boolean, default=False)


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = _pk()
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    # RBAC role: viewer | editor | admin (see packages/shared/api_key_roles.json).
    # Keys created before roles existed keep full access ("admin").
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="admin", server_default="admin")
    prefix: Mapped[str] = mapped_column(String(16), index=True)        # shown in UI, e.g. m4_live_AbCd
    key_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id: Mapped[uuid.UUID] = _pk()
    provider: Mapped[str] = mapped_column(String(40), default="revenuecat")
    event_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    type: Mapped[str | None] = mapped_column(String(60))
    payload: Mapped[dict | None] = mapped_column(JSONB)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ReservedSlug(Base):
    __tablename__ = "reserved_slugs"

    id: Mapped[uuid.UUID] = _pk()
    slug: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    # optional: a reserved slug that itself performs a redirect (e.g. /resume)
    redirect_url: Mapped[str | None] = mapped_column(Text)
    redirect_status: Mapped[int | None] = mapped_column(Integer)


class AuditEvent(Base):
    """Append-only audit trail (see dbcore/audit.py). Never updated or deleted
    by application code; retention is an ops concern."""

    __tablename__ = "audit_events"
    __table_args__ = (Index("ix_audit_events_account_ts", "account_id", "ts"),)

    id: Mapped[uuid.UUID] = _pk()
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actor_type: Mapped[str] = mapped_column(String(20), nullable=False)     # user | api_key | system
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))  # user id or api key id
    actor_label: Mapped[str | None] = mapped_column(String(120))            # e.g. key prefix
    action: Mapped[str] = mapped_column(String(60), nullable=False)         # link.create, auth.denied, ...
    target_type: Mapped[str | None] = mapped_column(String(40))
    target_id: Mapped[str | None] = mapped_column(String(64))
    outcome: Mapped[str] = mapped_column(String(20), nullable=False, default="ok", server_default="ok")  # ok | denied | error
    meta: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
