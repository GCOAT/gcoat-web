"""Tests for routing, OPTIONS, CORS headers, and response format."""
import json
from src.app import lambda_handler
from tests.conftest import make_event, FakeContext


class TestRouting:
    """Route matching and 404 tests."""

    def test_options_returns_200(self):
        """OPTIONS request returns 200."""
        event = make_event("OPTIONS", "/{proxy+}")
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 200

    def test_unknown_route_returns_404(self):
        """Unknown route returns 404."""
        event = make_event("GET", "/unknown/path")
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 404
        assert body["code"] == "NOT_FOUND"

    def test_unknown_method_returns_404(self):
        """Unsupported method returns 404."""
        event = make_event("DELETE", "/leads")
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 404


class TestResponseFormat:
    """Response envelope and header assertions."""

    def test_response_has_json_content_type(self):
        """All responses have Content-Type: application/json."""
        event = make_event("GET", "/unknown")
        resp = lambda_handler(event, FakeContext())

        assert resp["headers"]["Content-Type"] == "application/json"

    def test_response_body_is_json(self):
        """Response body is valid JSON."""
        event = make_event("GET", "/unknown")
        resp = lambda_handler(event, FakeContext())

        body = json.loads(resp["body"])
        assert isinstance(body, dict)

    def test_response_has_ok_field(self):
        """Response body has 'ok' boolean field."""
        event = make_event("GET", "/unknown")
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert "ok" in body
        assert isinstance(body["ok"], bool)

    def test_error_response_has_code(self):
        """Error responses have 'code' field."""
        event = make_event("GET", "/unknown")
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert "code" in body

    def test_error_response_has_no_store(self):
        """Error responses have Cache-Control: no-store."""
        event = make_event("GET", "/unknown")
        resp = lambda_handler(event, FakeContext())

        assert resp["headers"]["Cache-Control"] == "no-store"


class TestCORS:
    """CORS header assertions."""

    def test_cors_origin_header(self):
        """Response has Access-Control-Allow-Origin."""
        event = make_event("OPTIONS", "/{proxy+}")
        resp = lambda_handler(event, FakeContext())

        assert resp["headers"]["Access-Control-Allow-Origin"] == "https://example.com"

    def test_cors_headers_header(self):
        """Response has Access-Control-Allow-Headers."""
        event = make_event("OPTIONS", "/{proxy+}")
        resp = lambda_handler(event, FakeContext())

        assert "Content-Type" in resp["headers"]["Access-Control-Allow-Headers"]

    def test_cors_methods_header(self):
        """Response has Access-Control-Allow-Methods."""
        event = make_event("OPTIONS", "/{proxy+}")
        resp = lambda_handler(event, FakeContext())

        assert "POST" in resp["headers"]["Access-Control-Allow-Methods"]


class TestLambdaHandler:
    """Lambda handler structured logging tests."""

    def test_handler_returns_dict(self):
        """lambda_handler returns a dict with statusCode."""
        event = make_event("GET", "/unknown")
        resp = lambda_handler(event, FakeContext())

        assert isinstance(resp, dict)
        assert "statusCode" in resp
        assert "headers" in resp
        assert "body" in resp
