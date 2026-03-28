from django.http import HttpRequest
from accounts.models import Session


class RequestIdentity(HttpRequest):
    auth: Session


class RequestWorkspace(HttpRequest):
    auth: Session


# Backwards-compatible alias for workspace-authenticated endpoints.
Request = RequestWorkspace
