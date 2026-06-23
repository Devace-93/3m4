"""Click enrichment helpers: user-agent parsing, referrer host, and geo lookup.

These are pure-ish helpers kept apart from the task logic so they're easy to
read and test. All of them are defensive: bad/empty input yields Nones rather
than raising, because a single weird click must never poison the queue.
"""
from __future__ import annotations

from urllib.parse import urlparse

from user_agents import parse as parse_ua

from dbcore.config import config

# The geoip2 reader is created lazily and reused. It's None when no database is
# available (the common case in dev / self-host without a GeoLite2 file).
_geo_reader = None
_geo_init_done = False


def parse_user_agent(ua_string: str | None) -> dict:
    """Parse a UA string into {device, os, browser}.

    device is normalized to one of: bot | mobile | tablet | desktop.
    Returns Nones when the UA is missing/unparseable.
    """
    if not ua_string:
        return {"device": None, "os": None, "browser": None}

    ua = parse_ua(ua_string)

    if ua.is_bot:
        device = "bot"
    elif ua.is_mobile:
        device = "mobile"
    elif ua.is_tablet:
        device = "tablet"
    elif ua.is_pc:
        device = "desktop"
    else:
        device = None

    # `.family` is "Other" for unknown agents; treat that as unknown (None).
    os_family = ua.os.family if ua.os.family and ua.os.family != "Other" else None
    browser_family = (
        ua.browser.family if ua.browser.family and ua.browser.family != "Other" else None
    )

    return {"device": device, "os": os_family, "browser": browser_family}


def referrer_host(referrer: str | None) -> str | None:
    """Extract just the hostname from a referrer URL (privacy-friendly).

    We keep only the host (e.g. "twitter.com"), never the full path/query.
    """
    if not referrer:
        return None
    try:
        host = urlparse(referrer).hostname
    except ValueError:
        return None
    return host or None


def _get_geo_reader():
    """Lazily open the GeoLite2 reader. Returns None if unavailable."""
    global _geo_reader, _geo_init_done
    if _geo_init_done:
        return _geo_reader
    _geo_init_done = True
    try:
        import os

        import geoip2.database

        if config.geoip_db_path and os.path.isfile(config.geoip_db_path):
            _geo_reader = geoip2.database.Reader(config.geoip_db_path)
    except Exception:
        # Missing DB / missing lib / corrupt file: geo is simply unavailable.
        _geo_reader = None
    return _geo_reader


def geo_lookup(ip: str | None) -> dict:
    """Resolve an IP to {country, region, city}. All-None when unavailable.

    The raw IP is only used here, transiently, and is never persisted.
    """
    empty = {"country": None, "region": None, "city": None}
    if not ip:
        return empty

    reader = _get_geo_reader()
    if reader is None:
        return empty

    try:
        resp = reader.city(ip)
    except Exception:
        # Address not in DB, private IP, lookup error, etc.
        return empty

    region = resp.subdivisions.most_specific.name if resp.subdivisions else None
    return {
        "country": resp.country.iso_code,  # 2-letter ISO code or None
        "region": region,
        "city": resp.city.name,
    }
