"""Custom managers for workspace-scoped queries."""
from django.db import models


class WorkspaceScopedQuerySet(models.QuerySet):
    """QuerySet that provides workspace scoping utilities."""

    def for_workspace(self, workspace):
        """Filter queryset to only include objects from the given workspace.

        Args:
            workspace: Workspace instance to filter by

        Returns:
            QuerySet filtered to the workspace
        """
        return self.filter(workspace=workspace)


class WorkspaceScopedManager(models.Manager):
    """Manager for models that are workspace-scoped.

    Provides convenience methods for querying workspace-scoped models safely.
    Use this manager on any model that has a direct FK to Workspace.

    Example:
        class Server(models.Model):
            workspace = models.ForeignKey(Workspace, ...)
            objects = WorkspaceScopedManager()

        # Usage
        servers = Server.objects.for_workspace(request.auth.workspace)
    """

    def get_queryset(self):
        return WorkspaceScopedQuerySet(self.model, using=self._db)

    def for_workspace(self, workspace):
        """Filter to only objects in the given workspace.

        Args:
            workspace: Workspace instance to filter by

        Returns:
            QuerySet filtered to the workspace
        """
        return self.get_queryset().for_workspace(workspace)
