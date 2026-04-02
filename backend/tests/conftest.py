"""Shared test fixtures."""
import json
import os
import pytest
from unittest.mock import MagicMock, patch


@pytest.fixture(autouse=True)
def reset_cached_clients():
    """Reset all cached boto3 clients and admin token before each test."""
    import src.app as app
    app._DDB = None
    app._S3 = None
    app._SSM = None
    app._SES = None
    app._ADMIN_TOKEN = None
    app._ADMIN_TOKEN_LOADED_AT = 0
    yield


@pytest.fixture(autouse=True)
def env_vars(monkeypatch):
    """Set required environment variables for all tests."""
    monkeypatch.setenv("LEADS_TABLE_NAME", "test-leads")
    monkeypatch.setenv("CONTENT_TABLE_NAME", "test-content")
    monkeypatch.setenv("MEDIA_BUCKET_NAME", "test-media")
    monkeypatch.setenv("ALLOWED_ORIGIN", "https://example.com")
    monkeypatch.setenv("ADMIN_TOKEN_PARAM", "/test/admin-token")
    monkeypatch.setenv("STAGE", "test")
    monkeypatch.setenv("ENABLE_SES", "false")
    monkeypatch.setenv("SENDER_EMAIL", "")
    monkeypatch.setenv("SITE_NAME", "Test Site")
    monkeypatch.setenv("CONFIRMATION_SUBJECT", "Thanks for signing up!")


@pytest.fixture
def mock_ddb():
    """Mock DynamoDB table operations."""
    mock_table = MagicMock()
    mock_table.put_item.return_value = {}
    mock_table.get_item.return_value = {"Item": None}

    mock_resource = MagicMock()
    mock_resource.Table.return_value = mock_table

    with patch("src.app._ddb", return_value=mock_resource):
        yield mock_table, mock_resource


@pytest.fixture
def mock_s3():
    """Mock S3 client."""
    mock_client = MagicMock()
    mock_client.generate_presigned_url.return_value = "https://s3.example.com/presigned"

    with patch("src.app._s3", return_value=mock_client):
        yield mock_client


@pytest.fixture
def mock_ssm():
    """Mock SSM client."""
    mock_client = MagicMock()
    mock_client.get_parameter.return_value = {
        "Parameter": {"Value": "test-admin-token-123"}
    }

    with patch("src.app._ssm", return_value=mock_client):
        yield mock_client


@pytest.fixture
def mock_ses():
    """Mock SES client."""
    mock_client = MagicMock()
    mock_client.send_email.return_value = {"MessageId": "test-msg-id"}

    with patch("src.app._ses", return_value=mock_client):
        yield mock_client


def make_event(method, path, body=None, headers=None, path_params=None):
    """Build a minimal API Gateway v2 event."""
    event = {
        "routeKey": f"{method} {path}",
        "rawPath": path,
        "requestContext": {
            "http": {"method": method}
        },
        "headers": headers or {},
        "pathParameters": path_params or {},
    }
    if body is not None:
        if isinstance(body, dict):
            event["body"] = json.dumps(body)
        else:
            event["body"] = body
    return event


class FakeContext:
    """Minimal Lambda context for testing."""
    aws_request_id = "test-request-id-000"
