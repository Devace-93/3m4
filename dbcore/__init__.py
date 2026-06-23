"""dbcore — shared core used by the api, redirect, and worker services.

Holds the single source of truth for: configuration, SQLAlchemy models,
plan limits, reserved slugs, short-code generation, usage metering, and the
PostHog client. Each service Docker image copies this package in.
"""

__version__ = "0.1.0"
