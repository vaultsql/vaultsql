"""
Loops.so integration for drip mail campaigns.
"""
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

LOOPS_API_URL = "https://app.loops.so/api/v1/contacts/create"


def create_loops_contact(user, mailing_list_key: str) -> bool:
    """
    Create a contact in Loops.so for a new user.
    
    Args:
        user: The User instance (must have identity and workspace loaded)
        mailing_list_key: Either 'create_workspace' or 'join_workspace'
    
    Returns:
        True if contact was created successfully, False otherwise
    """
    token = settings.LOOPS_API_TOKEN
    if not token:
        return False
    
    list_id = settings.LOOPS_MAILING_LISTS.get(mailing_list_key)
    if not list_id:
        logger.warning(f"Unknown mailing list key: {mailing_list_key}")
        return False
    
    # Split name into first/last
    full_name = user.identity.name or ""
    name_parts = full_name.split(maxsplit=1)
    first_name = name_parts[0] if name_parts else ""
    last_name = name_parts[1] if len(name_parts) > 1 else ""
    
    # Workspace owners (create_workspace) get isOwner=True
    is_owner = mailing_list_key == "create_workspace"
    
    payload = {
        "email": user.email,
        "firstName": first_name,
        "lastName": last_name,
        "source": "vaultsql",
        "subscribed": True,
        "userId": str(user.id),
        # Custom properties
        "fullName": full_name,
        "workspaceId": str(user.workspace.id),
        "workspaceName": user.workspace.name,
        "isOwner": is_owner,
        # Mailing list enrollment
        "mailingLists": {
            list_id: True,
        },
    }
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    
    try:
        response = requests.post(LOOPS_API_URL, json=payload, headers=headers, timeout=10)
        response.raise_for_status()
        logger.info(f"Created Loops contact for user {user.id}")
        return True
    except requests.RequestException as e:
        logger.error(f"Failed to create Loops contact for user {user.id}: {e}")
        return False
