"""redirect — the tiny, fast Flask service that serves short-code redirects.

This is the hot path of 3m4: every short link click hits this service. It does
the bare minimum (resolve the code, fire-and-forget a click event, redirect) and
never blocks on analytics. See PROJECT_PLAN.md §3.
"""

__version__ = "0.1.0"
