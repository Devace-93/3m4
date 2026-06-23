"""Privacy helpers. We NEVER persist a raw IP address.

`hash_ip` produces a salted, truncated hash usable only for coarse uniqueness
estimates within a period. The raw IP is used transiently for geo lookup in the
worker and then discarded.
"""
from __future__ import annotations

import hashlib

from .config import config


def hash_ip(ip: str | None) -> str | None:
    if not ip:
        return None
    digest = hashlib.sha256(f"{config.ip_hash_salt}:{ip}".encode()).hexdigest()
    return digest[:32]
