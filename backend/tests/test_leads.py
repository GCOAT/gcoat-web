"""Tests for POST /leads endpoint."""
import base64
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
        assert "existingWebsite" not in item
        assert "inspirationLinks" not in item
        assert "brandingStatus" not in item

    def test_existing_website_valid(self, mock_ddb):
        """existingWebsite field is stored when provided."""
        mock_table, _ = mock_ddb
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test",
            "message": "Hi",
            "source": "intake",
            "existingWebsite": "https://my-site.com"
        })
        resp = lambda_handler(event, FakeContext())
        assert resp["statusCode"] == 200
        item = mock_table.put_item.call_args.kwargs["Item"]
        assert item["existingWebsite"] == "https://my-site.com"

    def test_existing_website_too_long(self):
        """existingWebsite exceeding max length returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test",
            "message": "Hi",
            "source": "intake",
            "existingWebsite": "https://x.com/" + "a" * 250
        })
        resp = lambda_handler(event, FakeContext())
        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["message"] == "Existing website URL too long"

    def test_inspiration_links_valid(self, mock_ddb):
        """inspirationLinks field is stored when provided."""
        mock_table, _ = mock_ddb
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test",
            "message": "Hi",
            "source": "intake",
            "inspirationLinks": "https://example.com, https://cool-site.io"
        })
        resp = lambda_handler(event, FakeContext())
        assert resp["statusCode"] == 200
        item = mock_table.put_item.call_args.kwargs["Item"]
        assert item["inspirationLinks"] == "https://example.com, https://cool-site.io"

    def test_inspiration_links_too_long(self):
        """inspirationLinks exceeding max length returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test",
            "message": "Hi",
            "source": "intake",
            "inspirationLinks": "https://x.com/" + "a" * 500
        })
        resp = lambda_handler(event, FakeContext())
        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["message"] == "Inspiration links too long"

    def test_branding_status_valid(self, mock_ddb):
        """brandingStatus field is stored when provided."""
        mock_table, _ = mock_ddb
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test",
            "message": "Hi",
            "source": "intake",
            "brandingStatus": "I have a logo and brand colors"
        })
        resp = lambda_handler(event, FakeContext())
        assert resp["statusCode"] == 200
        item = mock_table.put_item.call_args.kwargs["Item"]
        assert item["brandingStatus"] == "I have a logo and brand colors"

    def test_branding_status_too_long(self):
        """brandingStatus exceeding max length returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test",
            "message": "Hi",
            "source": "intake",
            "brandingStatus": "a" * 201
        })
        resp = lambda_handler(event, FakeContext())
        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["message"] == "Branding status too long"

    def test_all_new_optional_fields_together(self, mock_ddb):
        """All three new optional fields submitted together are stored."""
        mock_table, _ = mock_ddb
        event = make_event("POST", "/leads", body={
            "email": "user@example.com",
            "name": "Test",
            "message": "Hi",
            "source": "intake",
            "existingWebsite": "https://old-site.com",
            "inspirationLinks": "https://stripe.com",
            "brandingStatus": "I need everything designed"
        })
        resp = lambda_handler(event, FakeContext())
        assert resp["statusCode"] == 200
        item = mock_table.put_item.call_args.kwargs["Item"]
        assert item["existingWebsite"] == "https://old-site.com"
        assert item["inspirationLinks"] == "https://stripe.com"
        assert item["brandingStatus"] == "I need everything designed"


class TestPostLeadsBase64Body:
    """Tests for base64-encoded body handling."""

    def test_base64_body_valid(self, mock_ddb):
        """Base64-encoded body is decoded and processed correctly."""
        payload = json.dumps({
            "email": "user@example.com",
            "source": "signup"
        })
        encoded = base64.b64encode(payload.encode("utf-8")).decode("utf-8")
        event = make_event("POST", "/leads")
        event["body"] = encoded
        event["isBase64Encoded"] = True

        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 200
        assert body["ok"] is True

    def test_base64_body_with_all_fields(self, mock_ddb):
        """Base64-encoded body with all intake fields works."""
        mock_table, _ = mock_ddb
        payload = json.dumps({
            "name": "Jane",
            "email": "jane@example.com",
            "message": "Hello",
            "source": "intake",
            "phone": "555-1234",
            "companyName": "Acme"
        })
        encoded = base64.b64encode(payload.encode("utf-8")).decode("utf-8")
        event = make_event("POST", "/leads")
        event["body"] = encoded
        event["isBase64Encoded"] = True

        resp = lambda_handler(event, FakeContext())
        assert resp["statusCode"] == 200

    def test_base64_body_exceeds_pre_decode_limit(self):
        """Base64 body exceeding 50KB pre-decode guard returns 400."""
        # Create a raw string > 50KB before base64 decoding
        large_payload = "A" * 52_000
        event = make_event("POST", "/leads")
        event["body"] = large_payload
        event["isBase64Encoded"] = True

        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 400
        assert body["code"] == "VALIDATION_ERROR"

    def test_base64_body_exceeds_post_decode_limit(self):
        """Base64 body that decodes to > 10KB returns 400."""
        # Create a payload that's < 50KB encoded but > 10KB decoded
        large_json = json.dumps({"message": "A" * 11_000, "email": "a@b.com", "source": "signup"})
        encoded = base64.b64encode(large_json.encode("utf-8")).decode("utf-8")
        event = make_event("POST", "/leads")
        event["body"] = encoded
        event["isBase64Encoded"] = True

        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 400
        assert body["code"] == "VALIDATION_ERROR"

    def test_non_base64_body_exceeds_limit(self):
        """Non-base64 body exceeding 50KB pre-decode guard returns 400."""
        large_body = "A" * 52_000
        event = make_event("POST", "/leads")
        event["body"] = large_body

        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 400
        assert body["code"] == "VALIDATION_ERROR"


class TestPostLeadsEmailEdgeCases:
    """Email validation edge case tests."""

    def test_email_consecutive_dots(self):
        """Email with consecutive dots in local part returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "user..name@example.com",
            "source": "signup"
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["message"] == "Invalid email"

    def test_email_dot_at_start(self):
        """Email starting with dot in local part returns 400."""
        event = make_event("POST", "/leads", body={
            "email": ".user@example.com",
            "source": "signup"
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["message"] == "Invalid email"

    def test_email_dot_at_end_of_local(self):
        """Email ending with dot in local part returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "user.@example.com",
            "source": "signup"
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["message"] == "Invalid email"

    def test_email_local_part_too_long(self):
        """Email with local part > 64 chars returns 400."""
        long_local = "a" * 65
        event = make_event("POST", "/leads", body={
            "email": f"{long_local}@example.com",
            "source": "signup"
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400
        assert json.loads(resp["body"])["message"] == "Invalid email"

    def test_email_valid_with_dots(self, mock_ddb):
        """Email with valid dots passes validation."""
        event = make_event("POST", "/leads", body={
            "email": "first.last@example.com",
            "source": "signup"
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 200

    def test_email_valid_with_plus(self, mock_ddb):
        """Email with plus addressing passes."""
        event = make_event("POST", "/leads", body={
            "email": "user+tag@example.com",
            "source": "signup"
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 200

    def test_email_valid_with_hyphen(self, mock_ddb):
        """Email with hyphens in domain passes."""
        event = make_event("POST", "/leads", body={
            "email": "user@my-domain.com",
            "source": "signup"
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 200

    def test_email_no_at_sign(self):
        """Email without @ returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "userexample.com",
            "source": "signup"
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400

    def test_email_no_domain(self):
        """Email without domain returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "user@",
            "source": "signup"
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400

    def test_email_no_tld(self):
        """Email without TLD returns 400."""
        event = make_event("POST", "/leads", body={
            "email": "user@example",
            "source": "signup"
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400
