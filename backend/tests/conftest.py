"""Shared test fixtures."""
import json
import os
import re
import pytest
from unittest.mock import MagicMock, patch


@pytest.fixture(autouse=True)
def reset_cached_clients():
    """Reset all cached boto3 clients and admin token before each test."""
    import src.app as app
    import src.db as db_mod
    db_mod._ddb_resource = None
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
    monkeypatch.setenv("BLOG_TABLE_NAME", "test-blog")
    monkeypatch.setenv("MEDIA_BUCKET_NAME", "test-media")
    monkeypatch.setenv("ALLOWED_ORIGIN", "https://example.com")
    monkeypatch.setenv("ADMIN_TOKEN_PARAM", "/test/admin-token")
    monkeypatch.setenv("STAGE", "test")
    monkeypatch.setenv("ENABLE_SES", "false")
    monkeypatch.setenv("SENDER_EMAIL", "")
    monkeypatch.setenv("SITE_NAME", "Test Site")
    monkeypatch.setenv("CONFIRMATION_SUBJECT", "Thanks for signing up!")
    monkeypatch.setenv("DEV_ORIGIN", "")


@pytest.fixture
def mock_ddb():
    """Mock DynamoDB via db module."""
    mock_table = MagicMock()
    mock_table.put_item.return_value = {}
    mock_table.get_item.return_value = {"Item": None}

    mock_resource = MagicMock()
    mock_resource.Table.return_value = mock_table

    with patch("src.db._ddb", return_value=mock_resource):
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


# ---------------------------------------------------------------------------
# Blog — in-memory DynamoDB simulator for integration tests
# ---------------------------------------------------------------------------

class InMemoryTable:
    """Simulates a DynamoDB table with query support for blog tests."""

    def __init__(self):
        self.items = []

    def put_item(self, *, Item):
        self.items = [i for i in self.items
                      if not (i["pk"] == Item["pk"] and i["sk"] == Item["sk"])]
        self.items.append(dict(Item))
        return {}

    def get_item(self, *, Key):
        for item in self.items:
            if item["pk"] == Key["pk"] and item["sk"] == Key["sk"]:
                return {"Item": dict(item)}
        return {}

    def delete_item(self, *, Key):
        self.items = [i for i in self.items
                      if not (i["pk"] == Key["pk"] and i["sk"] == Key["sk"])]
        return {}

    def query(self, **kwargs):
        index = kwargs.get("IndexName")
        forward = kwargs.get("ScanIndexForward", True)
        limit = kwargs.get("Limit")
        kce = kwargs.get("KeyConditionExpression")

        pk_attr, pk_val, sk_attr, sk_op, sk_val = _parse_key_condition(
            kce, index
        )

        results = []
        for item in self.items:
            item_pk = item.get(pk_attr, "")
            if item_pk != pk_val:
                continue
            if sk_attr and sk_op:
                item_sk = item.get(sk_attr, "")
                if sk_op == "eq" and item_sk != sk_val:
                    continue
                if sk_op == "begins_with" and not item_sk.startswith(sk_val):
                    continue
                if sk_op == "between":
                    lo, hi = sk_val
                    if not (lo <= item_sk <= hi):
                        continue
            results.append(dict(item))

        results.sort(key=lambda x: x.get(sk_attr or "sk", ""),
                     reverse=not forward)
        if limit:
            results = results[:limit]
        return {"Items": results}


def _parse_key_condition(expr, index_name):
    """Extract pk/sk attribute names, operator, and values from a boto3
    KeyConditionExpression."""
    from boto3.dynamodb.conditions import ConditionExpressionBuilder

    builder = ConditionExpressionBuilder()
    built = builder.build_expression(expr)
    expr_str = built.condition_expression
    names = built.attribute_name_placeholders
    values = built.attribute_value_placeholders

    resolved = expr_str
    for placeholder, real_name in names.items():
        resolved = resolved.replace(placeholder, real_name)

    pk_attr = None
    pk_val = None
    sk_attr = None
    sk_op = None
    sk_val = None

    parts = re.split(r'\s+AND\s+', resolved, flags=re.IGNORECASE)

    for part in parts:
        part = part.strip()
        if "begins_with" in part:
            m = re.match(r"begins_with\s*\((\w+),\s*(:v\d+)\)", part)
            if m:
                sk_attr = m.group(1)
                sk_op = "begins_with"
                sk_val = values[m.group(2)]
        elif "BETWEEN" in part.upper():
            m = re.match(r"(\w+)\s+BETWEEN\s+(:v\d+)\s+AND\s+(:v\d+)", part,
                         re.IGNORECASE)
            if m:
                sk_attr = m.group(1)
                sk_op = "between"
                sk_val = (values[m.group(2)], values[m.group(3)])
        elif "=" in part:
            m = re.match(r"(\w+)\s*=\s*(:v\d+)", part)
            if m:
                attr = m.group(1)
                val = values[m.group(2)]
                if pk_attr is None:
                    pk_attr = attr
                    pk_val = val
                else:
                    sk_attr = attr
                    sk_op = "eq"
                    sk_val = val

    return pk_attr, pk_val, sk_attr, sk_op, sk_val


@pytest.fixture
def blog_db():
    """In-memory DynamoDB table for blog integration tests."""
    table = InMemoryTable()
    mock_resource = MagicMock()
    mock_resource.Table.return_value = table

    with patch("src.db._ddb", return_value=mock_resource):
        yield table


def make_admin_event(method, path, body=None, path_params=None, query_params=None):
    """Build an API Gateway v2 event with admin auth."""
    event = make_event(method, path, body=body, headers={
        "x-admin-token": "test-admin-token-123",
    }, path_params=path_params)
    if query_params:
        event["queryStringParameters"] = query_params
    return event
