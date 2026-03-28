from __future__ import annotations

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import Identity, Workspace


class Command(BaseCommand):
    help = "Delete all workspaces and identities. Only available when DEBUG=True."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError(
                "This command can only be run when DEBUG=True (API_DEBUG=true in env.txt)."
            )

        with transaction.atomic():
            workspace_count = Workspace.objects.count()
            identity_count = Identity.objects.count()

            # Delete all workspaces (cascades to users, servers, profiles, credentials, access, etc.)
            Workspace.objects.all().delete()

            # Delete all identities
            Identity.objects.all().delete()

        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted {workspace_count} workspace(s) and {identity_count} identity/identities."
            )
        )
