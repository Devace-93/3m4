"""Account blueprint: current usage for the authenticated account."""
from __future__ import annotations

from flask import Blueprint, g, jsonify

from dbcore.db import session_scope
from dbcore.models import Account
from dbcore.plans import plan_limits
from dbcore.usage import get_or_create_counter

from ..auth_utils import require_auth
from ..errors import ApiError
from ..serializers import serialize_usage

bp = Blueprint("account", __name__)


@bp.get("/usage")
@require_auth
def usage():
    with session_scope() as session:
        account = session.get(Account, g.account_id)
        if account is None:
            raise ApiError(404, "not_found", "Account not found.")
        limits = plan_limits(account.plan)
        counter = get_or_create_counter(session, account.id)
        body = serialize_usage(counter, limits)
    return jsonify(body)
