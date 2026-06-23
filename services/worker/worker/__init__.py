"""worker — the Celery worker that turns raw click events into analytics.

It consumes click events enqueued by the redirect service, enriches them
(geo / device / browser / referrer), and writes durable rows: a `Click`, the
per-account usage counter, the link's lifetime counter, and the daily rollup.
It also runs scheduled maintenance (retention pruning, billing reconcile).
See PROJECT_PLAN.md §3.
"""

__version__ = "0.1.0"
