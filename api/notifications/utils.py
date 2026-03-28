import os


def build_frontend_url(path: str) -> str:
    """Build a full frontend URL from a path.

    Args:
        path: Path relative to frontend root (e.g., "/keys/123/approve")

    Returns:
        Full URL (e.g., "https://app.vaultsql.com/keys/123/approve")
    """
    frontend_url = os.getenv('APP_URL_WEB') or os.getenv('API_FRONTEND_URL') or os.getenv(
        'FRONTEND_URL'
    ) or 'https://app.vaultsql.com'
    # Ensure frontend_url doesn't end with /
    frontend_url = frontend_url.rstrip('/')
    # Ensure path starts with /
    if not path.startswith('/'):
        path = '/' + path
    return frontend_url + path
