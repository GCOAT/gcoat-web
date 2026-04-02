"""Tests for POST /media/presign endpoint."""
import json
from unittest.mock import MagicMock, patch
from botocore.exceptions import ClientError

from src.app import lambda_handler
from tests.conftest import make_event, FakeContext


class TestPostPresign:
    """POST /media/presign tests."""

    def _admin_event(self, body=None):
        """Build event with admin token header."""
        return make_event("POST", "/media/presign", body=body, headers={
            "x-admin-token": "test-admin-token-123"
        })

    def test_valid_presign(self, mock_s3, mock_ssm):
        """Valid presign request returns 200 with uploadUrl."""
        event = self._admin_event(body={
            "filename": "photo.jpg",
            "contentType": "image/jpeg"
        })
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 200
        assert body["ok"] is True
        assert "uploadUrl" in body["data"]
        assert "key" in body["data"]

    def test_no_auth(self):
        """No admin token returns 401."""
        event = make_event("POST", "/media/presign", body={
            "filename": "photo.jpg",
            "contentType": "image/jpeg"
        })
        resp = lambda_handler(event, FakeContext())
        body = json.loads(resp["body"])

        assert resp["statusCode"] == 401
        assert body["code"] == "AUTH_REQUIRED"

    def test_wrong_token(self, mock_ssm):
        """Wrong admin token returns 401."""
        event = make_event("POST", "/media/presign", body={
            "filename": "photo.jpg",
            "contentType": "image/jpeg"
        }, headers={"x-admin-token": "wrong-token"})
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 401

    def test_invalid_extension(self, mock_ssm):
        """Disallowed file extension returns 400."""
        event = self._admin_event(body={
            "filename": "script.exe",
            "contentType": "image/jpeg"
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400

    def test_invalid_content_type(self, mock_ssm):
        """Disallowed content type returns 400."""
        event = self._admin_event(body={
            "filename": "photo.jpg",
            "contentType": "application/pdf"
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400

    def test_missing_filename(self, mock_ssm):
        """Missing filename returns 400."""
        event = self._admin_event(body={"contentType": "image/jpeg"})
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400

    def test_filename_too_long(self, mock_ssm):
        """Filename exceeding 180 chars returns 400."""
        event = self._admin_event(body={
            "filename": "a" * 181 + ".jpg",
            "contentType": "image/jpeg"
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400

    def test_path_traversal_sanitized(self, mock_s3, mock_ssm):
        """Path traversal in filename is sanitized by os.path.basename."""
        event = self._admin_event(body={
            "filename": "../../etc/photo.jpg",
            "contentType": "image/jpeg"
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 200

    def test_malformed_json(self, mock_ssm):
        """Malformed JSON returns 400."""
        event = make_event("POST", "/media/presign", body="not json{", headers={
            "x-admin-token": "test-admin-token-123"
        })
        resp = lambda_handler(event, FakeContext())

        assert resp["statusCode"] == 400
