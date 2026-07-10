"""Feature flag evaluation. Source of truth: PostHog; registry + fail-safe
defaults live in ``packages/shared/feature_flags.json``.

Resolution order (see PROJECT plan / .lavish/feature-flags-plan.html):

1. Self-host (``POSTHOG_API_KEY`` unset) — every flag is ON, zero network.
2. Hosted with PostHog reachable — whatever the PostHog dashboard says,
   evaluated locally (definitions polled in the background, ~0ms per call).
   Requires ``POSTHOG_PERSONAL_API_KEY`` for local evaluation.
3. PostHog unreachable / flag undefined there / personal key missing — the
   per-flag ``default`` from the shared registry.

Flag checks must never add request latency or raise: any failure falls back
to the registry default.
"""
from __future__ import annotations

from ._shared import load_shared
from .config import config

_client = None
_client_ready = False


def registry() -> dict:
    """The shared flag registry: ``{key: {description, default, created}}``."""
    return load_shared("feature_flags.json")["flags"]


def _get_client():
    """Posthog client with local evaluation, or None when unavailable."""
    global _client, _client_ready
    if _client_ready:
        return _client
    _client_ready = True
    if not config.posthog_api_key or not config.posthog_personal_api_key:
        return None
    try:
        from posthog import Posthog

        _client = Posthog(
            project_api_key=config.posthog_api_key,
            host=config.posthog_host,
            personal_api_key=config.posthog_personal_api_key,
            poll_interval=30,
        )
    except Exception:
        _client = None
    return _client


def is_enabled(key: str, distinct_id: str = "anonymous") -> bool:
    """Evaluate one flag for a requester (account id, or "anonymous")."""
    reg = registry()
    if key not in reg:
        # Unknown flag: fail closed so a typo can't silently expose a feature.
        return False
    if not config.posthog_api_key:
        return True  # self-host: full product, no PostHog dependency
    default = bool(reg[key]["default"])
    client = _get_client()
    if client is None:
        return default
    try:
        result = client.feature_enabled(
            key,
            distinct_id,
            only_evaluate_locally=True,
            send_feature_flag_events=False,
        )
    except Exception:
        return default
    return default if result is None else bool(result)


def resolve_all(distinct_id: str = "anonymous") -> dict[str, bool]:
    """Every registered flag resolved for a requester (for /auth/me and /flags)."""
    return {key: is_enabled(key, distinct_id) for key in registry()}
