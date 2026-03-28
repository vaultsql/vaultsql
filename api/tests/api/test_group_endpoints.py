import json
import secrets
from datetime import timedelta

import pytest
from django.utils import timezone

from accounts.models import GroupMembership, Session, User, UserGroup, WorkspaceRole


def _auth_header(session):
    return {"HTTP_AUTHORIZATION": f"Bearer {session.token}"}


@pytest.mark.django_db
class TestGroupAdminEndpoints:
    def test_list_users(self, client, session, member_user):
        response = client.get("/api/group/users", **_auth_header(session))
        assert response.status_code == 200
        data = response.json()
        emails = {user["email"] for user in data}
        assert "test@example.com" in emails
        assert "member@example.com" in emails

    def test_update_user_role(self, client, session, member_user):
        url = f"/api/group/users/{member_user.id}/role"
        response = client.put(
            url,
            data=json.dumps({"role": WorkspaceRole.ADMIN.value}),
            content_type="application/json",
            **_auth_header(session),
        )
        assert response.status_code == 200
        member_user.refresh_from_db()
        assert member_user.role == WorkspaceRole.ADMIN.value

    def test_group_crud_and_membership_flow(self, client, session, member_user):
        create_resp = client.post(
            "/api/group/groups",
            data=json.dumps({"name": "Growth Team", "description": "Growth initiatives"}),
            content_type="application/json",
            **_auth_header(session),
        )
        assert create_resp.status_code == 200
        group_id = create_resp.json()["id"]

        update_resp = client.put(
            f"/api/group/groups/{group_id}",
            data=json.dumps({"name": "Growth Org", "description": "Updated"}),
            content_type="application/json",
            **_auth_header(session),
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["name"] == "Growth Org"

        list_resp = client.get("/api/group/groups", **_auth_header(session))
        assert list_resp.status_code == 200
        assert any(group["id"] == group_id for group in list_resp.json())

        assign_resp = client.post(
            f"/api/group/groups/{group_id}/members",
            data=json.dumps({"user_id": str(member_user.id)}),
            content_type="application/json",
            **_auth_header(session),
        )
        assert assign_resp.status_code == 200
        assert GroupMembership.objects.filter(group_id=group_id).count() == 1

        remove_resp = client.delete(
            f"/api/group/groups/{group_id}/members/{member_user.id}",
            **_auth_header(session),
        )
        assert remove_resp.status_code == 200
        assert GroupMembership.objects.filter(group_id=group_id).count() == 0

        delete_resp = client.delete(f"/api/group/groups/{group_id}", **_auth_header(session))
        assert delete_resp.status_code == 200
        assert UserGroup.objects.filter(id=group_id).count() == 0

    def test_list_groups_with_members(self, client, session, member_user):
        create_resp = client.post(
            "/api/group/groups",
            data=json.dumps({"name": "Test Group", "description": "Test"}),
            content_type="application/json",
            **_auth_header(session),
        )
        assert create_resp.status_code == 200
        group_id = create_resp.json()["id"]

        client.post(
            f"/api/group/groups/{group_id}/members",
            data=json.dumps({"user_id": str(member_user.id)}),
            content_type="application/json",
            **_auth_header(session),
        )

        without_members = client.get("/api/group/groups", **_auth_header(session))
        assert without_members.status_code == 200
        groups = without_members.json()
        test_group = next(g for g in groups if g["id"] == group_id)
        assert test_group["members"] is None

        with_members = client.get("/api/group/groups?members=true", **_auth_header(session))
        assert with_members.status_code == 200
        groups_with_members = with_members.json()
        test_group_with_members = next(g for g in groups_with_members if g["id"] == group_id)
        assert test_group_with_members["members"] is not None
        assert len(test_group_with_members["members"]) == 1
        assert test_group_with_members["members"][0]["email"] == "member@example.com"


@pytest.mark.django_db
class TestDeactivateUser:
    """Tests for the user deactivation (soft delete) endpoint."""

    def test_deactivate_user_success(self, client, session, member_user):
        """Admin can deactivate another user."""
        url = f"/api/group/users/{member_user.id}"
        response = client.delete(url, **_auth_header(session))

        assert response.status_code == 200
        assert response.json()["success"] is True

        # User should have deactivated_at set
        member_user.refresh_from_db()
        assert member_user.deactivated_at is not None

    def test_deactivate_user_removes_from_list(self, client, session, member_user, workspace):
        """Deactivated users should not appear in the users list."""
        # First verify user is in the list
        list_resp = client.get("/api/group/users", **_auth_header(session))
        emails = {u["email"] for u in list_resp.json()}
        assert "member@example.com" in emails

        # Deactivate the user
        url = f"/api/group/users/{member_user.id}"
        client.delete(url, **_auth_header(session))

        # User should no longer appear in the list
        list_resp = client.get("/api/group/users", **_auth_header(session))
        emails = {u["email"] for u in list_resp.json()}
        assert "member@example.com" not in emails

    def test_deactivate_user_revokes_sessions(self, client, session, member_user, workspace):
        """Deactivating a user should revoke all their sessions."""
        # Create a session for the member user
        member_token = secrets.token_urlsafe(32)
        member_session = Session.objects.create(
            identity=member_user.identity,
            user=member_user,
            workspace=workspace,
            role=member_user.role,
            token=member_token,
            expiry=timezone.now() + timedelta(days=7),
        )
        member_session_id = member_session.id

        # Verify session exists
        assert Session.objects.filter(id=member_session_id).exists()

        # Deactivate the user
        url = f"/api/group/users/{member_user.id}"
        client.delete(url, **_auth_header(session))

        # Session should be revoked
        assert not Session.objects.filter(id=member_session_id).exists()

    def test_cannot_deactivate_self(self, client, session, user):
        """Admin cannot deactivate themselves."""
        url = f"/api/group/users/{user.id}"
        response = client.delete(url, **_auth_header(session))

        assert response.status_code == 400
        assert "Cannot deactivate yourself" in response.json()["detail"]

    def test_deactivate_nonexistent_user(self, client, session):
        """Deactivating a non-existent user returns 404."""
        import uuid

        url = f"/api/group/users/{uuid.uuid4()}"
        response = client.delete(url, **_auth_header(session))

        assert response.status_code == 404

    def test_deactivate_already_deactivated_user(self, client, session, member_user):
        """Deactivating an already deactivated user returns 404."""
        # Deactivate user first
        url = f"/api/group/users/{member_user.id}"
        client.delete(url, **_auth_header(session))

        # Try to deactivate again
        response = client.delete(url, **_auth_header(session))
        assert response.status_code == 404

    def test_member_cannot_deactivate_user(self, client, member_user, workspace):
        """Non-admin users cannot deactivate other users."""
        # Create session for member user
        member_token = secrets.token_urlsafe(32)
        member_session = Session.objects.create(
            identity=member_user.identity,
            user=member_user,
            workspace=workspace,
            role=member_user.role,
            token=member_token,
            expiry=timezone.now() + timedelta(days=7),
        )

        # Create another user to try to deactivate
        another_member = User.objects.create_user(
            email="another@example.com",
            password="testpass123",
            workspace=workspace,
            role=WorkspaceRole.MEMBER.value,
        )

        url = f"/api/group/users/{another_member.id}"
        response = client.delete(url, **_auth_header(member_session))

        # Should be forbidden (non-admin)
        assert response.status_code == 403

    def test_deactivated_user_excluded_from_group_members(
        self, client, session, member_user, workspace
    ):
        """Deactivated users should not appear in group member lists."""
        # Create a group and add the member
        create_resp = client.post(
            "/api/group/groups",
            data=json.dumps({"name": "Test Group", "description": "Test"}),
            content_type="application/json",
            **_auth_header(session),
        )
        group_id = create_resp.json()["id"]

        client.post(
            f"/api/group/groups/{group_id}/members",
            data=json.dumps({"user_id": str(member_user.id)}),
            content_type="application/json",
            **_auth_header(session),
        )

        # Verify member is in group
        groups_resp = client.get("/api/group/groups?members=true", **_auth_header(session))
        test_group = next(g for g in groups_resp.json() if g["id"] == group_id)
        assert len(test_group["members"]) == 1

        # Deactivate the member
        client.delete(f"/api/group/users/{member_user.id}", **_auth_header(session))

        # Member should no longer appear in group members
        groups_resp = client.get("/api/group/groups?members=true", **_auth_header(session))
        test_group = next(g for g in groups_resp.json() if g["id"] == group_id)
        assert len(test_group["members"]) == 0
