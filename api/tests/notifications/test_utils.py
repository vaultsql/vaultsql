import pytest
from unittest.mock import patch
from notifications.utils import build_frontend_url


class TestBuildFrontendUrl:
    def test_build_frontend_url_with_env_var(self):
        """Test that build_frontend_url uses FRONTEND_URL env var."""
        with patch('notifications.utils.os.getenv', return_value='https://custom-frontend.com'):
            url = build_frontend_url("/test/path")
            assert url == "https://custom-frontend.com/test/path"
    
    def test_build_frontend_url_default(self):
        """Test that build_frontend_url uses default when env var not set."""
        with patch('notifications.utils.os.getenv', return_value=None):
            url = build_frontend_url("/test/path")
            assert url == "https://app.vaultsql.com/test/path"
    
    def test_build_frontend_url_without_leading_slash(self):
        """Test that build_frontend_url adds leading slash if missing."""
        with patch('notifications.utils.os.getenv', return_value='https://custom-frontend.com'):
            url = build_frontend_url("test/path")
            assert url == "https://custom-frontend.com/test/path"
    
    def test_build_frontend_url_strips_trailing_slash(self):
        """Test that build_frontend_url strips trailing slash from base URL."""
        with patch('notifications.utils.os.getenv', return_value='https://custom-frontend.com/'):
            url = build_frontend_url("/test/path")
            assert url == "https://custom-frontend.com/test/path"
            assert not url.endswith("//")

