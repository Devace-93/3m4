"""Public QR codes for short links.

A QR code only encodes the public short URL, so serving it without auth leaks
nothing the redirect itself does not already reveal. This lets the dashboard
(and anyone embedding a link) load the PNG with a plain ``<img src>`` — a
browser cannot attach ``Authorization`` headers to image requests.

The authenticated ``GET /links/:id/qr.png`` route still exists for API clients.
"""
from __future__ import annotations

from io import BytesIO

import qrcode
from flask import Blueprint, Response, request
from sqlalchemy import select

from dbcore.db import session_scope
from dbcore.models import Link

from ..errors import ApiError
from ..extensions import limiter
from ..serializers import short_url

bp = Blueprint("qr", __name__)


def clamp_size(raw) -> int:
    """Clamp the requested pixel size to a sane square."""
    try:
        size = int(raw)
    except (TypeError, ValueError):
        size = 512
    return min(max(size, 64), 2048)


def render_qr_png(url: str, size: int) -> bytes:
    """Render ``url`` as a PNG QR of exactly ``size`` x ``size`` pixels.

    Nearest-neighbour resize keeps the modules crisp.
    """
    qr = qrcode.QRCode(border=2, box_size=10)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    img = img.resize((size, size))
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def png_response(data: bytes) -> Response:
    return Response(
        data,
        mimetype="image/png",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@bp.get("/<short_code>.png")
@limiter.limit("120/minute")
def public_qr(short_code: str):
    size = clamp_size(request.args.get("size", 512))
    with session_scope() as session:
        link = session.scalar(select(Link).where(Link.short_code == short_code))
        if link is None:
            raise ApiError(404, "not_found", "Link not found.")
        url = short_url(link.short_code)
    return png_response(render_qr_png(url, size))
