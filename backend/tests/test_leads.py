"""Tests for POST /leads endpoint."""
import json
import pytest
from unittest.mock import MagicMock, patch
from botocore.exceptions import ClientError

from backend.src.app import lambda_handler
from backend.tests.conftest import make_event, FakeContext


class TestPostLeads:
    """POST /leads tests."""

    def test_valid_lead(self, mock_ddb):
        """Valid lead submission returns 200."""
        mock_table, mock_resource = mock_ddb
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test User",
            "message": "Hello",
            "source": "website"
        })
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 200
        assert body["ok"] is True
        assert "createdAt" in body["data"]
        mock_table.put_item.assert_called_once()

    def test_valid_lead_email_only(self, mock_ddb):
        """Lead with only email (minimal required field) returns 200."""
        mock_table, _ = mock_ddb
        event = make_event("POST", "/leads", body={"email": "user@example.com"})
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 200
        assert body["ok"] is True

    def test_missing_email(self):
        """Missing email returns 400."""
        event = make_event("POST", "/leads", body={"name": "Test"})
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 400
        assert body["ok"] is False
        assert body["code"] == "VALIDATION_ERROR"

    def test_invalid_email(self):
        """Invalid email format returns 400."""
        event = make_event("POST", "/leads", body={"email": "not-an-email"})
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 400
        assert body["code"] == "VALIDATION_ERROR"

    def test_email_too_long(self):
        """Email exceeding 254 chars returns 400."""
        long_email = "a" * 250 + "@b.com"
        event = make_event("POST", "/leads", body={"email": long_email})
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400

    def test_name_too_long(self, mock_ddb):
        """Name exceeding 100 chars returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "A" * 101
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400

    def test_message_too_long(self, mock_ddb):
        """Message exceeding 2000 chars returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "message": "A" * 2001
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400

    def test_source_too_long(self):
        """Source exceeding 100 chars returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "source": "x" * 101
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["code"] == "VALIDATION_ERROR"

    def test_honeypot_filled(self):
        """Filled honeypot returns 200 silently (no DB write)."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "website": "http://spam.com"
        })
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 200
        assert body["ok"] is True

    def test_malformed_json(self):
        """Malformed JSON body returns 400."""
        event = make_event("POST", "/leads", body="not json{")
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 400
        assert body["code"] == "VALIDATION_ERROR"

    def test_empty_body(self):
        """Empty body returns 400 (no email)."""
        event = make_event("POST", "/leads", body={})
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400

    def test_ddb_error(self, mock_ddb):
        """DynamoDB error returns 500."""
        mock_table, _ = mock_ddb
        mock_table.put_item.side_effect = ClientError(
            {"Error": {"Code": "InternalError", "Message": "fail"}}, "PutItem"
        )
        event = make_event("POST", "/leads", body={"email": "user@example.com"})
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 500
        assert body["code"] == "INTERNAL_ERROR"

    def test_lead_item_has_ttl(self, mock_ddb):
        """Lead item includes expiresAt TTL field."""
        mock_table, _ = mock_ddb
        event = make_event("POST", "/leads", body={"email": "user@example.com"})
        lambda_handler(event, FakeContext())

        call_args = mock_table.put_item.call_args
        item = call_args[1]["Item"] if "Item" in (call_args[1] or {}) else call_args[0][0] if call_args[0] else call_args.kwargs.get("Item", {})
        assert "expiresAt" in item

    def test_ses_called_when_enabled(self, mock_ddb, mock_ses, monkeypatch):
        """SES send_email called when ENABLE_SES is true."""
        monkeypatch.setenv("ENABLE_SES", "true")
        monkeypatch.setenv("SENDER_EMAIL", "sender@example.com")
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test",
            "message": "Hello"
        })
        lambda_handler(event, FakeContext())
        # Owner notification + user confirmation = 2 calls
        assert mock_ses.send_email.call_count == 2

    def test_ses_not_called_when_disabled(self, mock_ddb, mock_ses):
        """SES not called when ENABLE_SES is false."""
        event = make_event("POST", "/leads", body={"email": "user@example.com"})
        lambda_handler(event, FakeContext())
        mock_ses.send_email.assert_not_called()

    def test_confirmation_email_sent(self, mock_ddb, mock_ses, monkeypatch):
        """User confirmation email sent when SES is enabled."""
        monkeypatch.setenv("ENABLE_SES", "true")
        monkeypatch.setenv("SENDER_EMAIL", "sender@example.com")
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test User"
        })
        lambda_handler(event, FakeContext())
        # Owner notification + user confirmation = 2 calls
        assert mock_ses.send_email.call_count == 2
        # Second call should be to the lead's email
        confirmation_call = mock_ses.send_email.call_args_list[1]
        assert confirmation_call.kwargs["Destination"]["ToAddresses"] == ["user@example.com"]
        assert "Html" in confirmation_call.kwargs["Message"]["Body"]

    def test_confirmation_not_sent_when_disabled(self, mock_ddb, mock_ses):
        """No confirmation email when SES is disabled."""
        event = make_event("POST", "/leads", body={"email": "user@example.com"})
        lambda_handler(event, FakeContext())
        mock_ses.send_email.assert_not_called()

    def test_confirmation_failure_does_not_block(self, mock_ddb, mock_ses, monkeypatch):
        """Confirmation email failure does not block the 200 response."""
        monkeypatch.setenv("ENABLE_SES", "true")
        monkeypatch.setenv("SENDER_EMAIL", "sender@example.com")
        # First call (notification) succeeds, second (confirmation) fails
        mock_ses.send_email.side_effect = [
            {"MessageId": "ok"},
            ClientError({"Error": {"Code": "MessageRejected", "Message": "fail"}}, "SendEmail")
        ]
        event = make_event("POST", "/leads", body={"email": "user@example.com"})
        resp = lambda_handler(event, FakeContext())
        assert resp["statusCode"] == 200
        assert json.loads(resp["body"])["ok"] is True
