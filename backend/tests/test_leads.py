"""Tests for POST /leads endpoint."""
import json
import pytest
from unittest.mock import MagicMock, patch
from botocore.exceptions import ClientError

from src.app import lambda_handler
from tests.conftest import make_event, FakeContext


class TestPostLeads:
    """POST /leads tests."""

    def test_valid_lead(self, mock_ddb):
        """Valid lead submission returns 200."""
        mock_table, mock_resource = mock_ddb
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test User",
            "message": "Hello",
            "source": "contact"
        })
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 200
        assert body["ok"] is True
        assert "createdAt" in body["data"]
        mock_table.put_item.assert_called_once()

    def test_valid_lead_signup_email_only(self, mock_ddb):
        """Signup with only email returns 200."""
        mock_table, _ = mock_ddb
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "source": "signup"
        })
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 200
        assert body["ok"] is True

    def test_signup_with_name(self, mock_ddb):
        """Signup with email + name returns 200."""
        mock_table, _ = mock_ddb
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test User",
            "source": "signup"
        })
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 200
        assert body["ok"] is True

    def test_missing_email(self):
        """Missing email returns 400."""
        event = make_event("POST", "/leads", body={
            "name": "Test",
            "source": "contact"
        })
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 400
        assert body["ok"] is False
        assert body["code"] == "VALIDATION_ERROR"

    def test_invalid_email(self):
        """Invalid email format returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "not-an-email",
            "source": "signup"
        })
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 400
        assert body["code"] == "VALIDATION_ERROR"

    def test_email_too_long(self):
        """Email exceeding 254 chars returns 400."""
        long_email = "a" * 250 + "@b.com"
        event = make_event("POST", "/leads", body={
            "email": long_email,
            "source": "signup"
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400

    def test_name_too_long(self):
        """Name exceeding 100 chars returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "A" * 101,
            "source": "signup"
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400

    def test_message_too_long(self):
        """Message exceeding 2000 chars returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test",
            "message": "A" * 2001,
            "source": "contact"
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400

    def test_missing_source(self):
        """Missing source returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com"
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["message"] == "Source is required"

    def test_invalid_source(self):
        """Invalid source value returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "source": "invalid-source"
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["message"] == "Invalid source"

    def test_honeypot_filled(self):
        """Filled honeypot returns 200 silently (no DB write)."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "source": "contact",
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
        """Empty body returns 400 (no source)."""
        event = make_event("POST", "/leads", body={})
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400

    def test_ddb_error(self, mock_ddb):
        """DynamoDB error returns 500."""
        mock_table, _ = mock_ddb
        mock_table.put_item.side_effect = ClientError(
            {"Error": {"Code": "InternalError", "Message": "fail"}}, "PutItem"
        )
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test",
            "message": "Hello",
            "source": "contact"
        })
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 500
        assert body["code"] == "INTERNAL_ERROR"

    def test_lead_item_has_ttl(self, mock_ddb):
        """Lead item includes expiresAt TTL field."""
        mock_table, _ = mock_ddb
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test",
            "message": "Hello",
            "source": "contact"
        })
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
            "message": "Hello",
            "source": "contact"
        })
        lambda_handler(event, FakeContext())
        # Owner notification + user confirmation = 2 calls
        assert mock_ses.send_email.call_count == 2

    def test_ses_not_called_when_disabled(self, mock_ddb, mock_ses):
        """SES not called when ENABLE_SES is false."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "source": "signup"
        })
        lambda_handler(event, FakeContext())
        mock_ses.send_email.assert_not_called()

    def test_confirmation_email_sent(self, mock_ddb, mock_ses, monkeypatch):
        """User confirmation email sent when SES is enabled."""
        monkeypatch.setenv("ENABLE_SES", "true")
        monkeypatch.setenv("SENDER_EMAIL", "sender@example.com")
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test User",
            "message": "Hello",
            "source": "contact"
        })
        lambda_handler(event, FakeContext())
        assert mock_ses.send_email.call_count == 2
        confirmation_call = mock_ses.send_email.call_args_list[1]
        assert confirmation_call.kwargs["Destination"]["ToAddresses"] == ["user@example.com"]
        assert "Html" in confirmation_call.kwargs["Message"]["Body"]

    def test_confirmation_not_sent_when_disabled(self, mock_ddb, mock_ses):
        """No confirmation email when SES is disabled."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "source": "signup"
        })
        lambda_handler(event, FakeContext())
        mock_ses.send_email.assert_not_called()

    def test_confirmation_failure_does_not_block(self, mock_ddb, mock_ses, monkeypatch):
        """Confirmation email failure does not block the 200 response."""
        monkeypatch.setenv("ENABLE_SES", "true")
        monkeypatch.setenv("SENDER_EMAIL", "sender@example.com")
        mock_ses.send_email.side_effect = [
            {"MessageId": "ok"},
            ClientError({"Error": {"Code": "MessageRejected", "Message": "fail"}}, "SendEmail")
        ]
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test",
            "message": "Hello",
            "source": "contact"
        })
        resp = lambda_handler(event, FakeContext())
        assert resp["statusCode"] == 200
        assert json.loads(resp["body"])["ok"] is True


class TestPostLeadsIntake:
    """Intake-specific lead tests."""

    def test_intake_all_fields(self, mock_ddb):
        """Intake with every field populated returns 200."""
        mock_table, _ = mock_ddb
        event = make_event("POST", "/leads", body={
            "name": "Jane Doe",
            "email": "jane@example.com",
            "phone": "555-123-4567",
            "companyName": "Acme Inc.",
            "projectType": "Web App",
            "budgetRange": "$5,000–$15,000",
            "timeline": "1–3 Months",
            "message": "Build me a dashboard",
            "features": ["Contact Form", "Analytics"],
            "source": "intake"
        })
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 200
        assert body["ok"] is True

        item = mock_table.put_item.call_args.kwargs["Item"]
        assert item["phone"] == "555-123-4567"
        assert item["projectType"] == "Web App"
        assert item["budgetRange"] == "$5,000–$15,000"
        assert item["timeline"] == "1–3 Months"
        assert item["companyName"] == "Acme Inc."
        assert item["features"] == ["Contact Form", "Analytics"]

    def test_intake_missing_message(self):
        """Intake without message returns 400."""
        event = make_event("POST", "/leads", body={
            "name": "Jane Doe",
            "email": "jane@example.com",
            "source": "intake"
        })
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 400
        assert body["message"] == "Message is required"

    def test_intake_missing_name(self):
        """Intake without name returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "jane@example.com",
            "message": "Build me something",
            "source": "intake"
        })
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 400
        assert body["message"] == "Name is required"


class TestPostLeadsContact:
    """Contact-specific lead tests."""

    def test_contact_valid(self, mock_ddb):
        """Contact with name + email + message returns 200."""
        event = make_event("POST", "/leads", body={
            "name": "Test User",
            "email": "test@example.com",
            "message": "Question about services",
            "source": "contact"
        })
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 200
        assert body["ok"] is True

    def test_contact_missing_message(self):
        """Contact without message returns 400."""
        event = make_event("POST", "/leads", body={
            "name": "Test User",
            "email": "test@example.com",
            "source": "contact"
        })
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 400
        assert body["message"] == "Message is required"

    def test_kore_starter_backward_compat(self, mock_ddb):
        """kore-starter source works same as contact."""
        event = make_event("POST", "/leads", body={
            "name": "Test",
            "email": "test@example.com",
            "message": "Hello",
            "source": "kore-starter"
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 200


class TestPostLeadsFieldValidation:
    """Field-level validation tests for new fields."""

    def test_phone_too_long(self):
        """Phone exceeding 20 chars returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test",
            "message": "Hello",
            "source": "intake",
            "phone": "1" * 21
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["message"] == "Phone too long"

    def test_project_type_too_long(self):
        """projectType exceeding 50 chars returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test",
            "message": "Hello",
            "source": "intake",
            "projectType": "A" * 51
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["message"] == "Project type too long"

    def test_budget_range_too_long(self):
        """budgetRange exceeding 50 chars returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test",
            "message": "Hello",
            "source": "intake",
            "budgetRange": "B" * 51
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400

    def test_timeline_too_long(self):
        """timeline exceeding 50 chars returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test",
            "message": "Hello",
            "source": "intake",
            "timeline": "T" * 51
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400

    def test_company_name_too_long(self):
        """companyName exceeding 100 chars returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test",
            "message": "Hello",
            "source": "intake",
            "companyName": "C" * 101
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400

    def test_features_list_valid(self, mock_ddb):
        """Valid features list returns 200."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test",
            "message": "Hello",
            "source": "intake",
            "features": ["Contact Form", "Analytics"]
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 200

    def test_features_not_a_list(self):
        """Features as string returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test",
            "message": "Hello",
            "source": "intake",
            "features": "not a list"
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["message"] == "Features must be a list"

    def test_features_too_many(self):
        """Features with 11 items returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test",
            "message": "Hello",
            "source": "intake",
            "features": [f"feat-{i}" for i in range(11)]
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["message"] == "Too many features"

    def test_features_item_too_long(self):
        """Single feature item exceeding 50 chars returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test",
            "message": "Hello",
            "source": "intake",
            "features": ["A" * 51]
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["message"] == "Feature item too long"

    def test_unknown_fields_rejected(self):
        """Body with unknown fields returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "source": "signup",
            "foo": "bar"
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["message"] == "Unknown fields"

    def test_optional_fields_omitted_from_item(self, mock_ddb):
        """Optional fields not sent are not stored in DynamoDB item."""
        mock_table, _ = mock_ddb
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "source": "signup"
        })
        lambda_handler(event, FakeContext())

        item = mock_table.put_item.call_args.kwargs["Item"]
        assert "phone" not in item
        assert "projectType" not in item
        assert "features" not in item
