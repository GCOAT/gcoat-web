"""Unit tests for multi-step email validation logic."""
import pytest

from src.app import (
    _EMAIL_STRUCT_RE,
    _CONSECUTIVE_DOTS_RE,
    _DOT_AT_LOCAL_BOUNDARY_RE,
    MAX_LOCAL_PART_LEN,
)


def _is_valid_email(email):
    """Replicate the multi-step email validation from app.py."""
    if not email or len(email) > 254:
        return False
    if not _EMAIL_STRUCT_RE.match(email):
        return False
    local_part = email.split("@")[0]
    if len(local_part) > MAX_LOCAL_PART_LEN:
        return False
    if _CONSECUTIVE_DOTS_RE.search(local_part):
        return False
    if _DOT_AT_LOCAL_BOUNDARY_RE.search(local_part):
        return False
    return True


class TestEmailValidationValid:
    """Emails that MUST pass validation."""

    @pytest.mark.parametrize("email", [
        "user@example.com",
        "first.last@example.com",
        "user+tag@example.com",
        "user-name@example.com",
        "user_name@example.com",
        "user123@example.com",
        "u@example.com",
        "user@sub.domain.example.com",
        "user@my-domain.co.uk",
        "user@123.123.123.com",
        "USER@EXAMPLE.COM",
        "a" * 64 + "@example.com",
    ])
    def test_valid_emails(self, email):
        assert _is_valid_email(email), f"Expected valid: {email}"


class TestEmailValidationInvalid:
    """Emails that MUST fail validation."""

    @pytest.mark.parametrize("email", [
        "",
        "not-an-email",
        "user@",
        "@example.com",
        "user@example",
        "user..name@example.com",
        ".user@example.com",
        "user.@example.com",
        "user @example.com",
        "user@exam ple.com",
        "a" * 65 + "@example.com",
        "a" * 250 + "@b.com",
    ])
    def test_invalid_emails(self, email):
        assert not _is_valid_email(email), f"Expected invalid: {email}"


class TestEmailStructRegex:
    """Direct tests for _EMAIL_STRUCT_RE."""

    def test_basic_match(self):
        assert _EMAIL_STRUCT_RE.match("user@example.com")

    def test_no_at(self):
        assert not _EMAIL_STRUCT_RE.match("userexample.com")

    def test_no_domain(self):
        assert not _EMAIL_STRUCT_RE.match("user@")

    def test_no_tld(self):
        assert not _EMAIL_STRUCT_RE.match("user@example")

    def test_short_tld(self):
        assert not _EMAIL_STRUCT_RE.match("user@example.c")


class TestConsecutiveDotsRegex:
    """Direct tests for _CONSECUTIVE_DOTS_RE."""

    def test_consecutive_dots(self):
        assert _CONSECUTIVE_DOTS_RE.search("user..name")

    def test_triple_dots(self):
        assert _CONSECUTIVE_DOTS_RE.search("a...b")

    def test_single_dot(self):
        assert not _CONSECUTIVE_DOTS_RE.search("user.name")

    def test_no_dots(self):
        assert not _CONSECUTIVE_DOTS_RE.search("username")


class TestDotBoundaryRegex:
    """Direct tests for _DOT_AT_LOCAL_BOUNDARY_RE."""

    def test_leading_dot(self):
        assert _DOT_AT_LOCAL_BOUNDARY_RE.search(".user")

    def test_trailing_dot(self):
        assert _DOT_AT_LOCAL_BOUNDARY_RE.search("user.")

    def test_internal_dot(self):
        assert not _DOT_AT_LOCAL_BOUNDARY_RE.search("user.name")

    def test_no_dot(self):
        assert not _DOT_AT_LOCAL_BOUNDARY_RE.search("username")
