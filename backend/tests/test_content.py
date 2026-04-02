"""Tests for GET /content/{page} endpoint."""
import json
from unittest.mock import MagicMock, patch
from botocore.exceptions import ClientError

from src.app import lambda_handler
from tests.conftest import make_event, FakeContext


class TestGetContent:
    """GET /content/{page} tests."""

    def test_content_found(self, mock_ddb):
        """Existing page returns 200 with data."""
        mock_table, _ = mock_ddb
        mock_table.get_item.return_value = {
            "Item": {"pk": "CONTENT", "sk": "PAGE#home", "data": {"title": "Home"}}
        }
        event = make_event("GET", "/content/home", path_params={"page": "home"})
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 200
        assert body["ok"] is True
        assert body["data"]["title"] == "Home"

    def test_content_not_found(self, mock_ddb):
        """Missing page returns 404."""
        mock_table, _ = mock_ddb
        mock_table.get_item.return_value = {}
        event = make_event("GET", "/content/missing", path_params={"page": "missing"})
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 404
        assert body["code"] == "NOT_FOUND"

    def test_invalid_page_slug(self):
        """Invalid page slug returns 400."""
        event = make_event("GET", "/content/INVALID!", path_params={"page": "INVALID!"})
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["code"] == "VALIDATION_ERROR"

    def test_page_slug_too_long(self):
        """Page slug exceeding 100 chars returns 400."""
        long_slug = "a" * 101
        event = make_event("GET", f"/content/{long_slug}", path_params={"page": long_slug})
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400

    def test_empty_page_slug(self):
        """Empty page slug returns 400."""
        event = make_event("GET", "/content/", path_params={"page": ""})
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400

    def test_content_cache_header(self, mock_ddb):
        """Content response has Cache-Control: public, max-age=60."""
        mock_table, _ = mock_ddb
        mock_table.get_item.return_value = {
            "Item": {"pk": "CONTENT", "sk": "PAGE#about", "data": {"title": "About"}}
        }
        event = make_event("GET", "/content/about", path_params={"page": "about"})
        resp = lambda_handler(event, FakeContext())

        assert resp["headers"]["Cache-Control"] == "public, max-age=60"

    def test_ddb_error(self, mock_ddb):
        """DynamoDB error returns 500."""
        mock_table, _ = mock_ddb
        mock_table.get_item.side_effect = ClientError(
            {"Error": {"Code": "InternalError", "Message": "fail"}}, "GetItem"
        )
        event = make_event("GET", "/content/home", path_params={"page": "home"})
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 500
        assert json.loads(resp["body"])["code"] == "INTERNAL_ERROR"
