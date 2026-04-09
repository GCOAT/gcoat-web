"""Unit tests for email validation logic.

Tests the multi-step email validator directly — regex patterns, dot rules,
length limits. These are fast, isolated, and easy to extend with new cases.

For integration tests (validation through the /leads endpoint), see test_leads.py.
"""
import re
import pytest

from src.app import (
    _EMAIL_STRUCT_RE,
    _CONSECUTIVE_DOTS_RE,
    _DOT_AT_LOCAL_BOUNDARY_RE,
    MAX_LOCAL_PART_LEN,
    MAX_EMAIL_LEN,
)


def is_valid_email(email):
    """Reproduce the validation logic from handle_post_leads for unit testing."""
    email = (email or "").strip()
    if not email or len(email) > MAX_EMAIL_LEN:
        return False
    local_part = email.split("@")[0] if "@" in email else ""
    if (len(local_part) > MAX_LOCAL_PART_LEN
            or _CONSECUTIVE_DOTS_RE.search(email)
            or _DOT_AT_LOCAL_BOUNDARY_RE.search(local_part)
            or not _EMAIL_STRUCT_RE.match(email)):
        return False
    return True


# -- Standard valid emails ----------------------------------------------------

class TestValidEmails:
    """Emails that MUST be accepted."""

    def test_standard(self):
        assert is_valid_email("user@example.com")

    def test_dot_in_local(self):
        assert is_valid_email("first.last@example.com")

    def test_plus_addressing(self):
        """Gmail-style plus tags (user+tag@gmail.com) are widely used."""
        assert is_valid_email("user+newsletter@gmail.com")

    def test_underscore(self):
        assert is_valid_email("user_name@example.com")

    def test_hyphen_in_local(self):
        assert is_valid_email("user-name@example.com")

    def test_all_caps(self):
        """Email addresses are case-insensitive per RFC."""
        assert is_valid_email("USER@EXAMPLE.COM")

    def test_numeric_local(self):
        assert is_valid_email("1234567890@example.com")

    def test_single_char_local(self):
        assert is_valid_email("x@example.com")

    def test_subdomain(self):
        assert is_valid_email("user@sub.domain.example.com")

    def test_deep_subdomain(self):
        assert is_valid_email("user@sub.sub.sub.sub.example.com")

    def test_country_tld(self):
        assert is_valid_email("user@example.co.uk")

    def test_country_tld_jp(self):
        assert is_valid_email("user@example.co.jp")

    def test_long_tld(self):
        assert is_valid_email("user@example.museum")

    def test_modern_tld(self):
        assert is_valid_email("user@example.dev")

    def test_photography_tld(self):
        assert is_valid_email("user@example.photography")

    def test_construction_tld(self):
        assert is_valid_email("contact@island-built.construction")

    def test_app_tld(self):
        assert is_valid_email("user@example.app")

    def test_short_domain(self):
        """Short but valid domains (like t.co, i.ua)."""
        assert is_valid_email("user@t.co")
        assert is_valid_email("user@i.ua")

    def test_minimal_valid(self):
        assert is_valid_email("a@b.co")

    def test_hyphen_in_domain(self):
        assert is_valid_email("user@my-company.com")

    def test_numeric_domain_label(self):
        assert is_valid_email("user@123.com")

    def test_long_valid_email(self):
        assert is_valid_email(
            "very.long.email.address.with.many.parts@example.domain-with-hyphen.com"
        )

    def test_disposable_with_tag(self):
        assert is_valid_email("disposable.email+tag123@example.co.uk")


# -- RFC 5322 special characters ----------------------------------------------

class TestRFCSpecialChars:
    """RFC 5322 allows these characters in the local part.
    Real email providers like iCloud support apostrophes."""

    def test_apostrophe(self):
        """Irish/Scottish names -- o'malley@icloud.com is real."""
        assert is_valid_email("o'malley@example.com")

    def test_exclamation(self):
        assert is_valid_email("user!tag@example.com")

    def test_hash(self):
        assert is_valid_email("user#tag@example.com")

    def test_dollar(self):
        assert is_valid_email("user$tag@example.com")

    def test_percent(self):
        assert is_valid_email("user%tag@example.com")

    def test_ampersand(self):
        assert is_valid_email("user&co@example.com")

    def test_asterisk(self):
        assert is_valid_email("user*star@example.com")

    def test_slash(self):
        assert is_valid_email("user/dept@example.com")

    def test_equals(self):
        assert is_valid_email("user=id@example.com")

    def test_question_mark(self):
        assert is_valid_email("user?query@example.com")

    def test_caret(self):
        assert is_valid_email("user^caret@example.com")

    def test_braces(self):
        assert is_valid_email("user{brace}@example.com")

    def test_pipe(self):
        assert is_valid_email("user|pipe@example.com")

    def test_tilde(self):
        assert is_valid_email("user~tilde@example.com")

    def test_backtick(self):
        assert is_valid_email("user`backtick@example.com")

    def test_all_special_chars_combined(self):
        assert is_valid_email("user!#$%&'*+-/=?^_`{|}~@example.com")


# -- Punycode / Internationalized domains ------------------------------------

class TestPunycodeDomains:
    """Internationalized domain names use xn-- prefix in ASCII form."""

    def test_punycode_tld(self):
        assert is_valid_email("user@example.xn--p1ai")

    def test_punycode_domain_label(self):
        assert is_valid_email("user@xn--tst-qla.de")

    def test_long_punycode_tld(self):
        assert is_valid_email("user@domain.xn--vermgensberatung-pwb")

    def test_punycode_with_subdomain(self):
        assert is_valid_email("user@sub.xn--80akhbyknj4f.xn--p1ai")


# -- Dot rules ----------------------------------------------------------------

class TestDotRules:
    """RFC prohibits leading/trailing/consecutive dots in local part."""

    def test_consecutive_dots_in_local_rejected(self):
        assert not is_valid_email("user..name@example.com")

    def test_consecutive_dots_in_domain_rejected(self):
        assert not is_valid_email("user@example..com")

    def test_leading_dot_rejected(self):
        assert not is_valid_email(".user@example.com")

    def test_trailing_dot_rejected(self):
        assert not is_valid_email("user.@example.com")

    def test_triple_dots_rejected(self):
        assert not is_valid_email("user...name@example.com")

    def test_single_dot_accepted(self):
        assert is_valid_email("first.last@example.com")

    def test_multiple_valid_dots(self):
        assert is_valid_email("a.b.c.d@example.com")


# -- Length limits -------------------------------------------------------------

class TestLengthLimits:
    """RFC limits: local part <= 64 chars, total <= 254 chars."""

    def test_max_local_part_64_accepted(self):
        local = "a" * 64
        assert is_valid_email(f"{local}@example.com")

    def test_local_part_65_rejected(self):
        local = "a" * 65
        assert not is_valid_email(f"{local}@example.com")

    def test_total_254_accepted(self):
        local = "a" * 10
        labels = []
        remaining = 243 - 4  # minus ".com"
        while remaining > 0:
            label_len = min(remaining, 63)
            if remaining - label_len > 0 and remaining - label_len < 3:
                label_len = remaining - 3
            labels.append("b" * label_len)
            remaining -= label_len + 1
        domain = ".".join(labels) + ".com"
        email = f"{local}@{domain}"
        assert len(email) <= 254
        assert is_valid_email(email)

    def test_total_over_254_rejected(self):
        local = "a" * 10
        domain = ("b" * 63 + ".") * 4 + "com"
        email = f"{local}@{domain}"
        assert len(email) > 254
        assert not is_valid_email(email)

    def test_empty_rejected(self):
        assert not is_valid_email("")

    def test_whitespace_only_rejected(self):
        assert not is_valid_email("   ")

    def test_none_rejected(self):
        assert not is_valid_email(None)


# -- Missing parts -------------------------------------------------------------

class TestMissingParts:
    """Emails missing required structural components."""

    def test_no_at_sign(self):
        assert not is_valid_email("userexample.com")

    def test_no_local_part(self):
        assert not is_valid_email("@example.com")

    def test_no_domain(self):
        assert not is_valid_email("user@")

    def test_no_tld(self):
        assert not is_valid_email("user@localhost")

    def test_two_at_signs(self):
        assert not is_valid_email("user@example@example.com")

    def test_just_at_sign(self):
        assert not is_valid_email("@")


# -- Domain rules --------------------------------------------------------------

class TestDomainRules:
    """Domain labels: start/end with alphanumeric, no leading/trailing hyphens."""

    def test_domain_starts_with_hyphen_rejected(self):
        assert not is_valid_email("user@-example.com")

    def test_domain_label_ends_with_hyphen_rejected(self):
        assert not is_valid_email("user@example-.com")

    def test_domain_starts_with_dot_rejected(self):
        assert not is_valid_email("user@.example.com")

    def test_domain_trailing_dot_rejected(self):
        assert not is_valid_email("user@example.com.")

    def test_single_char_tld_rejected(self):
        assert not is_valid_email("user@example.x")
        assert not is_valid_email("a@b.c")

    def test_numeric_tld_rejected(self):
        """TLDs must be alphabetic (or xn-- punycode)."""
        assert not is_valid_email("user@example.123")


# -- IP address domains (intentionally rejected) ------------------------------

class TestIPDomains:
    """Kore rejects IP address domains -- not appropriate for contact forms."""

    def test_ipv4_rejected(self):
        assert not is_valid_email("user@123.123.123.123")

    def test_ipv4_bracketed_rejected(self):
        assert not is_valid_email("user@[123.123.123.123]")

    def test_ipv6_rejected(self):
        assert not is_valid_email("user@[IPv6:2001:db8::1]")


# -- Injection / attack patterns -----------------------------------------------

class TestInjectionAttempts:
    """Emails that could be part of injection attacks."""

    def test_xss_in_local(self):
        assert not is_valid_email("<script>alert(1)</script>@example.com")

    def test_header_injection_newline(self):
        assert not is_valid_email("user@example.com\nBcc: x@evil.com")

    def test_header_injection_carriage_return(self):
        assert not is_valid_email("user@example.com\rBcc: x@evil.com")

    def test_space_in_email(self):
        assert not is_valid_email("user @example.com")

    def test_tab_in_email(self):
        assert not is_valid_email("user\t@example.com")

    def test_parentheses(self):
        assert not is_valid_email("user(comment)@example.com")

    def test_angle_brackets(self):
        assert not is_valid_email("Joe Smith <email@example.com>")

    def test_parentheses_after_domain(self):
        assert not is_valid_email("user@example.com (Joe Smith)")

    def test_non_latin_local(self):
        assert not is_valid_email("\u3042\u3044\u3046\u3048\u304a@example.com")

    def test_garbage_chars(self):
        assert not is_valid_email('#@%^%#$@#$@#.com')


# -- Real-world email providers ------------------------------------------------

class TestRealWorldProviders:
    """Emails from actual providers people use."""

    def test_gmail(self):
        assert is_valid_email("john.doe@gmail.com")

    def test_yahoo(self):
        assert is_valid_email("jane_smith@yahoo.com")

    def test_outlook(self):
        assert is_valid_email("user@outlook.com")

    def test_protonmail(self):
        assert is_valid_email("user@protonmail.com")

    def test_icloud(self):
        assert is_valid_email("user@icloud.com")

    def test_icloud_apostrophe(self):
        assert is_valid_email("o'malley@icloud.com")

    def test_business_email(self):
        assert is_valid_email("info@my-business.com")

    def test_gmail_plus_tag(self):
        assert is_valid_email("user+shopping@gmail.com")

    def test_disposable_guerrilla(self):
        assert is_valid_email("temp@guerrillamail.com")


# -- Regex component tests (direct pattern testing) ---------------------------

class TestRegexComponents:
    """Test the individual regex patterns used in validation."""

    def test_consecutive_dots_regex_matches(self):
        assert _CONSECUTIVE_DOTS_RE.search("user..name")
        assert _CONSECUTIVE_DOTS_RE.search("a...b")

    def test_consecutive_dots_regex_no_match(self):
        assert not _CONSECUTIVE_DOTS_RE.search("user.name")
        assert not _CONSECUTIVE_DOTS_RE.search("nodots")

    def test_dot_boundary_regex_leading(self):
        assert _DOT_AT_LOCAL_BOUNDARY_RE.search(".user")

    def test_dot_boundary_regex_trailing(self):
        assert _DOT_AT_LOCAL_BOUNDARY_RE.search("user.")

    def test_dot_boundary_regex_no_match(self):
        assert not _DOT_AT_LOCAL_BOUNDARY_RE.search("user")
        assert not _DOT_AT_LOCAL_BOUNDARY_RE.search("first.last")

    def test_struct_regex_basic_match(self):
        assert _EMAIL_STRUCT_RE.match("user@example.com")

    def test_struct_regex_no_match_without_tld(self):
        assert not _EMAIL_STRUCT_RE.match("user@localhost")

    def test_struct_regex_punycode_tld(self):
        assert _EMAIL_STRUCT_RE.match("user@example.xn--p1ai")
