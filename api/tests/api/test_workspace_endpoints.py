import json
import pytest
from django.utils import timezone

from accounts.models import WorkspaceInvitation


@pytest.mark.django_db
class TestWorkspaceInviteEndpoint:
    def test_create_invitation_as_admin(self, client, session):
        """Admin can create a new invitation."""
        response = client.post(
            "/api/workspace/invite",
            HTTP_AUTHORIZATION=f"Bearer {session.token}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert "token" in data
        assert "created_at" in data
        assert data["revoked_at"] is None
        
        # Verify invitation was created in DB
        invitation = WorkspaceInvitation.objects.get(id=data["id"])
        assert invitation.token == data["token"]
        assert invitation.workspace_id == session.workspace_id
        assert invitation.revoked_at is None
    
    def test_get_existing_invitation(self, client, session, workspace):
        """Returns existing invitation if one already exists."""
        # Create an invitation
        existing = WorkspaceInvitation.objects.create(
            workspace=workspace,
            token="existing-token-123",
        )
        
        response = client.post(
            "/api/workspace/invite",
            HTTP_AUTHORIZATION=f"Bearer {session.token}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == str(existing.id)
        assert data["token"] == existing.token
        
        # Verify no new invitation was created
        assert WorkspaceInvitation.objects.filter(workspace=workspace).count() == 1
    
    def test_force_create_new_invitation(self, client, session, workspace):
        """force=true revokes old invitation and creates new one."""
        # Create an existing invitation
        existing = WorkspaceInvitation.objects.create(
            workspace=workspace,
            token="old-token-123",
        )
        old_id = existing.id
        
        response = client.post(
            "/api/workspace/invite?force=true",
            HTTP_AUTHORIZATION=f"Bearer {session.token}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] != str(old_id)
        assert data["token"] != existing.token
        assert data["revoked_at"] is None
        
        # Verify old invitation was revoked
        existing.refresh_from_db()
        assert existing.revoked_at is not None
        
        # Verify new invitation was created
        new_invitation = WorkspaceInvitation.objects.get(id=data["id"])
        assert new_invitation.revoked_at is None
        assert new_invitation.token == data["token"]
    
    def test_member_cannot_create_invitation(self, client, member_user, workspace):
        """Members cannot create invitations."""
        from accounts.models import Session
        from datetime import timedelta
        import secrets
        
        # Create session for member user
        member_session = Session.objects.create(
            identity=member_user.identity,
            user=member_user,
            workspace=workspace,
            role=member_user.role,
            token=secrets.token_urlsafe(32),
            expiry=timezone.now() + timedelta(days=7),
        )
        
        response = client.post(
            "/api/workspace/invite",
            HTTP_AUTHORIZATION=f"Bearer {member_session.token}"
        )
        assert response.status_code == 403
        assert "Admin access required" in response.json()["detail"]
    
    def test_unauthenticated_cannot_create_invitation(self, client):
        """Unauthenticated requests are rejected."""
        response = client.post("/api/workspace/invite")
        assert response.status_code == 401
    
    def test_force_without_existing_creates_new(self, client, session, workspace):
        """force=true creates new invitation even if none exists."""
        response = client.post(
            "/api/workspace/invite?force=true",
            HTTP_AUTHORIZATION=f"Bearer {session.token}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert "token" in data
        assert data["revoked_at"] is None
        
        # Verify invitation was created
        assert WorkspaceInvitation.objects.filter(workspace=workspace).count() == 1
    
    def test_ignores_revoked_invitations(self, client, session, workspace):
        """Revoked invitations are not returned."""
        # Create a revoked invitation
        WorkspaceInvitation.objects.create(
            workspace=workspace,
            token="revoked-token",
            revoked_at=timezone.now(),
        )
        
        response = client.post(
            "/api/workspace/invite",
            HTTP_AUTHORIZATION=f"Bearer {session.token}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["token"] != "revoked-token"
        assert data["revoked_at"] is None
        
        # Verify a new invitation was created
        assert WorkspaceInvitation.objects.filter(
            workspace=workspace,
            revoked_at__isnull=True
        ).count() == 1

