import json

import pytest

from accounts.models import Session, User, WorkspaceInvitation, Identity


@pytest.mark.django_db
class TestIdentityEndpoints:
    def test_list_identity_workspaces(self, client, user, workspace):
        login_response = client.post(
            "/api/auth/login",
            data=json.dumps({"email": user.email, "password": "testpass123"}),
            content_type="application/json",
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]

        response = client.get(
            "/api/identity/workspace",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == str(workspace.id)
        assert data[0]["role"] == user.role

    def test_identity_workspace_login(self, client, user, workspace):
        login_response = client.post(
            "/api/auth/login",
            data=json.dumps({"email": user.email, "password": "testpass123"}),
            content_type="application/json",
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]

        response = client.post(
            f"/api/identity/workspace/{workspace.id}/login",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data

        session = Session.objects.get(token=data["token"])
        assert session.user_id == user.id
        assert session.workspace_id == workspace.id


@pytest.mark.django_db
class TestWorkspaceInviteFlow:
    def test_list_workspaces_with_valid_invite_code(self, client, user, another_workspace):
        """List workspaces with valid invite code shows invited workspace."""
        # Create invitation for another_workspace
        invitation = WorkspaceInvitation.objects.create(
            workspace=another_workspace,
            token="test-invite-123",
        )
        
        # Login as user (who is NOT in another_workspace)
        login_response = client.post(
            "/api/auth/login",
            data=json.dumps({"email": user.email, "password": "testpass123"}),
            content_type="application/json",
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # List workspaces with invite code
        response = client.get(
            f"/api/identity/workspace?invite_code={invitation.token}",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should only return the invited workspace
        assert len(data) == 1
        assert data[0]["id"] == str(another_workspace.id)
        assert data[0]["name"] == another_workspace.name
        assert data[0]["slug"] == another_workspace.slug
        assert data[0]["role"] is None  # Not a member yet
        assert data[0]["mode"] == another_workspace.mode
    
    def test_list_workspaces_with_invalid_invite_code(self, client, user):
        """List workspaces with invalid invite code returns empty."""
        login_response = client.post(
            "/api/auth/login",
            data=json.dumps({"email": user.email, "password": "testpass123"}),
            content_type="application/json",
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        response = client.get(
            "/api/identity/workspace?invite_code=invalid-code",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 0
    
    def test_list_workspaces_with_revoked_invite_code(self, client, user, another_workspace):
        """List workspaces with revoked invite code returns empty."""
        from django.utils import timezone
        
        # Create revoked invitation
        invitation = WorkspaceInvitation.objects.create(
            workspace=another_workspace,
            token="revoked-invite",
            revoked_at=timezone.now(),
        )
        
        login_response = client.post(
            "/api/auth/login",
            data=json.dumps({"email": user.email, "password": "testpass123"}),
            content_type="application/json",
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        response = client.get(
            f"/api/identity/workspace?invite_code={invitation.token}",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 0
    
    def test_list_workspaces_already_member_with_invite_code(self, client, user, workspace):
        """List workspaces with invite code for workspace user is already in returns empty."""
        # Create invitation for workspace user is already in
        invitation = WorkspaceInvitation.objects.create(
            workspace=workspace,
            token="already-member",
        )
        
        login_response = client.post(
            "/api/auth/login",
            data=json.dumps({"email": user.email, "password": "testpass123"}),
            content_type="application/json",
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        response = client.get(
            f"/api/identity/workspace?invite_code={invitation.token}",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 0
    
    def test_join_workspace_with_valid_invite(self, client, another_workspace):
        """Join workspace with valid invite code creates user and session."""
        # Create a new identity (not in any workspace yet)
        identity = Identity.objects.create(email="newuser@example.com")
        identity.set_password("testpass123")
        identity.save()
        
        # Create invitation
        invitation = WorkspaceInvitation.objects.create(
            workspace=another_workspace,
            token="join-invite-123",
        )
        
        # Signup/login as new identity
        login_response = client.post(
            "/api/auth/login",
            data=json.dumps({"email": identity.email, "password": "testpass123"}),
            content_type="application/json",
        )
        assert login_response.status_code == 200
        identity_token = login_response.json()["token"]
        
        # Join workspace with name in body
        response = client.post(
            f"/api/identity/workspace/{another_workspace.id}/join?invite_code={invitation.token}",
            data=json.dumps({"user_name": "New User"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {identity_token}",
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should return auth response with token
        assert "token" in data
        
        # Verify user was created with correct name
        user = User.objects.get(identity=identity, workspace=another_workspace)
        assert user.email == identity.email
        assert user.role == "member"
        assert user.identity.name == "New User"
        
        # Verify session was created
        session = Session.objects.get(token=data["token"])
        assert session.identity_id == identity.id
        assert session.user_id == user.id
        assert session.workspace_id == another_workspace.id
        assert session.role == "member"
    
    def test_join_workspace_with_invalid_invite(self, client, another_workspace):
        """Join workspace with invalid invite code fails."""
        identity = Identity.objects.create(email="newuser2@example.com")
        identity.set_password("testpass123")
        identity.save()
        
        login_response = client.post(
            "/api/auth/login",
            data=json.dumps({"email": identity.email, "password": "testpass123"}),
            content_type="application/json",
        )
        assert login_response.status_code == 200
        identity_token = login_response.json()["token"]
        
        response = client.post(
            f"/api/identity/workspace/{another_workspace.id}/join?invite_code=invalid-code",
            data=json.dumps({"user_name": "Test User"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {identity_token}",
        )
        assert response.status_code == 400
        assert "Invalid or expired invite code" in response.json()["detail"]
    
    def test_join_workspace_already_member(self, client, user, workspace):
        """Join workspace when already a member fails."""
        invitation = WorkspaceInvitation.objects.create(
            workspace=workspace,
            token="already-member-join",
        )
        
        login_response = client.post(
            "/api/auth/login",
            data=json.dumps({"email": user.email, "password": "testpass123"}),
            content_type="application/json",
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        response = client.post(
            f"/api/identity/workspace/{workspace.id}/join?invite_code={invitation.token}",
            data=json.dumps({"user_name": "Test User"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        assert response.status_code == 400
        assert "already a member" in response.json()["detail"]
    
    def test_join_workspace_mismatched_workspace_id(self, client, workspace, another_workspace):
        """Join workspace with invite code for different workspace fails."""
        identity = Identity.objects.create(email="newuser3@example.com")
        identity.set_password("testpass123")
        identity.save()
        
        # Create invitation for workspace A
        invitation = WorkspaceInvitation.objects.create(
            workspace=workspace,
            token="workspace-a-invite",
        )
        
        login_response = client.post(
            "/api/auth/login",
            data=json.dumps({"email": identity.email, "password": "testpass123"}),
            content_type="application/json",
        )
        assert login_response.status_code == 200
        identity_token = login_response.json()["token"]
        
        # Try to join workspace B with workspace A's invite code
        response = client.post(
            f"/api/identity/workspace/{another_workspace.id}/join?invite_code={invitation.token}",
            data=json.dumps({"user_name": "Test User"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {identity_token}",
        )
        assert response.status_code == 400
        assert "Invalid or expired invite code" in response.json()["detail"]
    
    def test_complete_invite_flow(self, client, user, workspace, another_workspace):
        """Test complete flow: create invite, list workspaces, join."""
        # Step 1: Admin creates invitation
        admin_login = client.post(
            "/api/auth/login",
            data=json.dumps({"email": user.email, "password": "testpass123"}),
            content_type="application/json",
        )
        admin_token = admin_login.json()["token"]
        
        # Switch to workspace session
        workspace_login = client.post(
            f"/api/identity/workspace/{workspace.id}/login",
            HTTP_AUTHORIZATION=f"Bearer {admin_token}",
        )
        workspace_token = workspace_login.json()["token"]
        
        invite_response = client.post(
            "/api/workspace/invite",
            HTTP_AUTHORIZATION=f"Bearer {workspace_token}",
        )
        assert invite_response.status_code == 200
        invite_code = invite_response.json()["token"]
        
        # Step 2: New user signs up
        identity = Identity.objects.create(
            email="invited@example.com",
            name="Invited User",
        )
        identity.set_password("testpass123")
        identity.save()
        
        new_user_login = client.post(
            "/api/auth/login",
            data=json.dumps({"email": identity.email, "password": "testpass123"}),
            content_type="application/json",
        )
        new_user_token = new_user_login.json()["token"]
        
        # Step 3: List workspaces with invite code
        list_response = client.get(
            f"/api/identity/workspace?invite_code={invite_code}",
            HTTP_AUTHORIZATION=f"Bearer {new_user_token}",
        )
        assert list_response.status_code == 200
        workspaces = list_response.json()
        assert len(workspaces) == 1
        assert workspaces[0]["id"] == str(workspace.id)
        assert workspaces[0]["role"] is None
        
        # Step 4: Join workspace (with name from body, which overrides identity values)
        join_response = client.post(
            f"/api/identity/workspace/{workspace.id}/join?invite_code={invite_code}",
            data=json.dumps({"user_name": "Custom Name"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {new_user_token}",
        )
        assert join_response.status_code == 200
        join_token = join_response.json()["token"]
        
        # Step 5: Verify user is now a member with name from request body
        new_user = User.objects.get(identity=identity, workspace=workspace)
        assert new_user.email == identity.email
        assert new_user.identity.name == "Custom Name"
        assert new_user.role == "member"
        
        # Step 6: List workspaces again (without invite code) should show workspace with role
        list_after_join = client.get(
            "/api/identity/workspace",
            HTTP_AUTHORIZATION=f"Bearer {new_user_token}",
        )
        assert list_after_join.status_code == 200
        workspaces_after = list_after_join.json()
        assert len(workspaces_after) == 1
        assert workspaces_after[0]["id"] == str(workspace.id)
        assert workspaces_after[0]["role"] == "member"
