"""Auth blueprint: ``GET /auth/me``.

Identity lives in accounts.3m4.net (register / login / magic link / OAuth /
logout / profile all happen there). This app only recognises the session it
issues (see ``api.auth_utils``) and exposes what the dashboard needs about the
*tenant*: the mirrored user, the account, plan, limits, usage and flags.
"""
from __future__ import annotations

from flask import Blueprint, g, jsonify

from dbcore.db import session_scope
from dbcore.feature_flags import resolve_all
from dbcore.models import Account, User
from dbcore.plans import effective_plan_limits
from dbcore.usage import get_or_create_counter

from ..auth_utils import require_auth
from ..errors import ApiError
from ..serializers import serialize_account, serialize_usage, serialize_user

bp = Blueprint("auth", __name__)


@bp.get("/me")
@require_auth(verified=False)
def me():
    """Reachable while the e-mail is still unverified, so the dashboard can
    render its own "verify your e-mail" state instead of a bare 403."""
    with session_scope() as session:
        user = session.get(User, g.user_id)
        account = session.get(Account, g.account_id)
        if user is None or account is None:
            raise ApiError(404, "not_found", "User or account not found.")
        limits = effective_plan_limits(account.plan, str(account.id))
        counter = get_or_create_counter(session, account.id)
        body = {
            "user": serialize_user(user),
            "account": serialize_account(account),
            "plan": account.plan,
            "limits": limits,
            "usage": serialize_usage(counter, limits),
            "flags": resolve_all(str(account.id)),
        }
    return jsonify(body)
