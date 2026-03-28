from .base import *
import logging

DEBUG = False
# Allow all hosts since requests are forwarded from Caddy reverse proxy
# Caddy handles host validation, so Django accepts any Host header
ALLOWED_HOSTS = ['*']

# Add production-specific CORS origins if needed
CORS_ALLOWED_ORIGINS += ['https://api.vaultsql.com']

ENABLE_SENTRY = get_env('ENABLE_SENTRY', default='false').lower() == 'true'
ENABLE_BETTERSTACK = get_env('ENABLE_BETTERSTACK', default='false').lower() == 'true'

# Self-hosted and cloud deployments both default to container console logs.
# Optional providers such as Better Stack and Sentry supplement Docker logs.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
            "stream": "ext://sys.stdout",
        },
        "console_error": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
            "stream": "ext://sys.stderr",
        },
    },
    "loggers": {
        "": {
            "handlers": ["console"],
            "level": "INFO",
        },
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console_error"],
            "level": "WARNING",
            "propagate": False,
        },
        "vaultsql": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "gunicorn.access": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "gunicorn.error": {
            "handlers": ["console_error"],
            "level": "INFO",
            "propagate": False,
        },
    },
}

if ENABLE_BETTERSTACK:
    BETTERSTACK_SOURCE_TOKEN = get_env('BETTERSTACK_SOURCE_TOKEN', required=True)
    BETTERSTACK_HOST = get_env('BETTERSTACK_HOST', default='https://in.logs.betterstack.com')
    # Add logtail handler to all loggers
    LOGGING["handlers"]["logtail"] = {
        "class": "logtail.LogtailHandler",
        "source_token": BETTERSTACK_SOURCE_TOKEN,
        "host": BETTERSTACK_HOST,
    }
    for logger_config in LOGGING["loggers"].values():
        logger_config["handlers"].append("logtail")

if ENABLE_SENTRY:
    import sentry_sdk
    from sentry_sdk.integrations.logging import LoggingIntegration

    SENTRY_DSN = get_env('SENTRY_DSN', required=True)

    sentry_logging = LoggingIntegration(
        level=logging.INFO,        # Capture info and above as breadcrumbs
        event_level=logging.ERROR  # Only send errors and above as events
    )

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[sentry_logging],
        send_default_pii=True,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
    )
