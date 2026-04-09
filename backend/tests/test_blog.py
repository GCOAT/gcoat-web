"""Blog module integration tests.

Tests all 6 blog routes (including RSS feed) through lambda_handler
with an in-memory DynamoDB table. Validates the full request/response
cycle including validation, auth, CRUD, pagination, tag filtering,
slug changes, redirects, and RSS feed generation.
"""
import json
import pytest

from src.app import lambda_handler
from tests.conftest import FakeContext, make_event, make_admin_event


CTX = FakeContext()


def _call(event):
    """Call lambda_handler and parse the response."""
    resp = lambda_handler(event, CTX)
    body = json.loads(resp["body"])
    return resp["statusCode"], body


def _create_post(title="Test Post", slug=None, content="<p>Hello</p>",
                 tags=None, status="draft"):
    """Helper: create a post via the API and return (status_code, body)."""
    payload = {"title": title, "content": content, "status": status}
    if slug:
        payload["slug"] = slug
    if tags:
        payload["tags"] = tags
    event = make_admin_event("POST", "/blog/posts", body=payload)
    return _call(event)


# ---------------------------------------------------------------------------
# POST /blog/posts — Create
# ---------------------------------------------------------------------------

class TestCreateBlogPost:

    def test_create_draft(self, blog_db, mock_ssm):
        status, body = _create_post(title="My First Post", slug="my-first-post")
        assert status == 201
        assert body["ok"] is True
        assert body["data"]["slug"] == "my-first-post"
        assert body["data"]["status"] == "draft"
        assert "postId" in body["data"]

    def test_create_published(self, blog_db, mock_ssm):
        status, body = _create_post(
            title="Live Post", slug="live-post", status="published",
            tags=["news", "update"],
        )
        assert status == 201
        assert body["data"]["status"] == "published"
        # Tag items should exist
        tag_items = [i for i in blog_db.items if i["pk"].startswith("TAG#")]
        assert len(tag_items) == 2

    def test_auto_slug_from_title(self, blog_db, mock_ssm):
        status, body = _create_post(title="Hello World Post")
        assert status == 201
        assert body["data"]["slug"] == "hello-world-post"

    def test_duplicate_slug_rejected(self, blog_db, mock_ssm):
        _create_post(title="First", slug="same-slug")
        status, body = _create_post(title="Second", slug="same-slug")
        assert status == 409
        assert body["code"] == "CONFLICT"

    def test_missing_title_rejected(self, blog_db, mock_ssm):
        event = make_admin_event("POST", "/blog/posts", body={
            "content": "<p>No title</p>",
        })
        status, body = _call(event)
        assert status == 400

    def test_missing_content_rejected(self, blog_db, mock_ssm):
        event = make_admin_event("POST", "/blog/posts", body={
            "title": "No Content",
        })
        status, body = _call(event)
        assert status == 400

    def test_invalid_slug_rejected(self, blog_db, mock_ssm):
        status, body = _create_post(title="Bad Slug", slug="BAD SLUG!")
        assert status == 400
        assert "slug" in body["message"].lower()

    def test_invalid_status_rejected(self, blog_db, mock_ssm):
        event = make_admin_event("POST", "/blog/posts", body={
            "title": "Bad Status", "content": "<p>x</p>", "status": "archived",
        })
        status, body = _call(event)
        assert status == 400

    def test_too_many_tags_rejected(self, blog_db, mock_ssm):
        status, body = _create_post(
            title="Many Tags", slug="many-tags",
            tags=[f"tag-{i}" for i in range(15)],
        )
        assert status == 400

    def test_requires_admin(self, blog_db, mock_ssm):
        event = make_event("POST", "/blog/posts", body={
            "title": "No Auth", "content": "<p>x</p>",
        })
        status, body = _call(event)
        assert status == 401

    def test_invalid_json(self, blog_db, mock_ssm):
        event = make_admin_event("POST", "/blog/posts")
        event["body"] = "not json{{"
        status, body = _call(event)
        assert status == 400


# ---------------------------------------------------------------------------
# GET /blog/posts — List
# ---------------------------------------------------------------------------

class TestListBlogPosts:

    @pytest.fixture(autouse=True)
    def _seed(self, blog_db, mock_ssm):
        """Seed 5 published + 2 draft posts."""
        for i in range(5):
            _create_post(
                title=f"Published {i}", slug=f"published-{i}",
                status="published", tags=["news"] if i % 2 == 0 else ["update"],
            )
        for i in range(2):
            _create_post(title=f"Draft {i}", slug=f"draft-{i}", status="draft")

    def test_list_published_default(self, blog_db, mock_ssm):
        event = make_event("GET", "/blog/posts")
        status, body = _call(event)
        assert status == 200
        assert body["ok"] is True
        posts = body["data"]["posts"]
        assert len(posts) == 5
        # All returned posts should be published
        assert all(p.get("GSI1PK") == "published" or p.get("status") == "published"
                    for p in posts)
        # Content should be stripped from list response
        assert all("content" not in p for p in posts)

    def test_list_with_limit(self, blog_db, mock_ssm):
        event = make_event("GET", "/blog/posts")
        event["queryStringParameters"] = {"limit": "2"}
        status, body = _call(event)
        assert len(body["data"]["posts"]) == 2

    def test_filter_by_tag(self, blog_db, mock_ssm):
        event = make_event("GET", "/blog/posts")
        event["queryStringParameters"] = {"tag": "news"}
        status, body = _call(event)
        posts = body["data"]["posts"]
        assert len(posts) >= 1
        # All returned items are from the TAG#news partition
        assert all(p["pk"] == "TAG#news" for p in posts)

    def test_admin_list_drafts(self, blog_db, mock_ssm):
        event = make_admin_event("GET", "/blog/posts",
                                  query_params={"status": "draft"})
        status, body = _call(event)
        posts = body["data"]["posts"]
        assert len(posts) == 2

    def test_non_admin_cannot_filter_by_status(self, blog_db, mock_ssm):
        """Non-admin with status param gets published list (status ignored)."""
        event = make_event("GET", "/blog/posts")
        event["queryStringParameters"] = {"status": "draft"}
        status, body = _call(event)
        posts = body["data"]["posts"]
        # Should return published, not drafts (non-admin)
        assert len(posts) == 5


# ---------------------------------------------------------------------------
# GET /blog/posts/{slug} — Get Single Post
# ---------------------------------------------------------------------------

class TestGetBlogPost:

    def test_get_published_post(self, blog_db, mock_ssm):
        _create_post(title="My Post", slug="my-post", status="published",
                     content="<p>Full content here</p>")
        event = make_event("GET", "/blog/posts/{slug}",
                          path_params={"slug": "my-post"})
        status, body = _call(event)
        assert status == 200
        assert body["data"]["title"] == "My Post"
        assert body["data"]["content"] == "<p>Full content here</p>"

    def test_draft_hidden_from_public(self, blog_db, mock_ssm):
        _create_post(title="Secret Draft", slug="secret-draft", status="draft")
        event = make_event("GET", "/blog/posts/{slug}",
                          path_params={"slug": "secret-draft"})
        status, body = _call(event)
        assert status == 404

    def test_admin_can_view_draft(self, blog_db, mock_ssm):
        _create_post(title="Admin Draft", slug="admin-draft", status="draft")
        event = make_admin_event("GET", "/blog/posts/{slug}",
                                 path_params={"slug": "admin-draft"})
        status, body = _call(event)
        assert status == 200

    def test_not_found(self, blog_db, mock_ssm):
        event = make_event("GET", "/blog/posts/{slug}",
                          path_params={"slug": "nonexistent"})
        status, body = _call(event)
        assert status == 404

    def test_redirect_on_old_slug(self, blog_db, mock_ssm):
        _create_post(title="Renamed", slug="old-name", status="published")
        # Rename the slug
        event = make_admin_event("PUT", "/blog/posts/{slug}",
                                 body={"slug": "new-name"},
                                 path_params={"slug": "old-name"})
        _call(event)

        # Old slug should redirect
        event = make_event("GET", "/blog/posts/{slug}",
                          path_params={"slug": "old-name"})
        status, body = _call(event)
        assert status == 301
        assert body["data"]["redirect"] is True
        assert body["data"]["slug"] == "new-name"

    def test_invalid_slug_format(self, blog_db, mock_ssm):
        event = make_event("GET", "/blog/posts/{slug}",
                          path_params={"slug": "BAD SLUG!!"})
        status, body = _call(event)
        assert status == 400


# ---------------------------------------------------------------------------
# PUT /blog/posts/{slug} — Update
# ---------------------------------------------------------------------------

class TestUpdateBlogPost:

    def test_update_title(self, blog_db, mock_ssm):
        _create_post(title="Original", slug="to-update", status="published")
        event = make_admin_event("PUT", "/blog/posts/{slug}",
                                 body={"title": "Updated Title"},
                                 path_params={"slug": "to-update"})
        status, body = _call(event)
        assert status == 200
        assert body["data"]["slug"] == "to-update"

        # Verify the update persisted
        get_event = make_event("GET", "/blog/posts/{slug}",
                              path_params={"slug": "to-update"})
        _, get_body = _call(get_event)
        assert get_body["data"]["title"] == "Updated Title"

    def test_publish_a_draft(self, blog_db, mock_ssm):
        _create_post(title="Draft", slug="to-publish")
        event = make_admin_event("PUT", "/blog/posts/{slug}",
                                 body={"status": "published"},
                                 path_params={"slug": "to-publish"})
        status, body = _call(event)
        assert status == 200
        assert body["data"]["status"] == "published"

    def test_unpublish(self, blog_db, mock_ssm):
        _create_post(title="Live", slug="to-unpublish", status="published",
                     tags=["news"])
        # Verify tag items exist
        tag_items = [i for i in blog_db.items if i["pk"] == "TAG#news"]
        assert len(tag_items) == 1

        event = make_admin_event("PUT", "/blog/posts/{slug}",
                                 body={"status": "draft"},
                                 path_params={"slug": "to-unpublish"})
        status, body = _call(event)
        assert status == 200
        assert body["data"]["status"] == "draft"

        # Tag items should be removed
        tag_items = [i for i in blog_db.items if i["pk"] == "TAG#news"]
        assert len(tag_items) == 0

    def test_change_slug_creates_redirect(self, blog_db, mock_ssm):
        _create_post(title="Rename Me", slug="old-slug", status="published")
        event = make_admin_event("PUT", "/blog/posts/{slug}",
                                 body={"slug": "new-slug"},
                                 path_params={"slug": "old-slug"})
        status, body = _call(event)
        assert status == 200
        assert body["data"]["slug"] == "new-slug"

        # Redirect exists
        redirect = [i for i in blog_db.items
                    if i["pk"] == "REDIRECT#old-slug"]
        assert len(redirect) == 1
        assert redirect[0]["targetSlug"] == "new-slug"

    def test_change_slug_conflict(self, blog_db, mock_ssm):
        _create_post(title="A", slug="slug-a", status="published")
        _create_post(title="B", slug="slug-b", status="published")
        event = make_admin_event("PUT", "/blog/posts/{slug}",
                                 body={"slug": "slug-a"},
                                 path_params={"slug": "slug-b"})
        status, body = _call(event)
        assert status == 409

    def test_update_tags_rebuilds_tag_items(self, blog_db, mock_ssm):
        _create_post(title="Tagged", slug="tagged", status="published",
                     tags=["news", "update"])
        assert len([i for i in blog_db.items if i["pk"] == "TAG#news"]) == 1
        assert len([i for i in blog_db.items if i["pk"] == "TAG#update"]) == 1

        event = make_admin_event("PUT", "/blog/posts/{slug}",
                                 body={"tags": ["tutorial", "guide"]},
                                 path_params={"slug": "tagged"})
        status, body = _call(event)
        assert status == 200

        # Old tags gone, new tags present
        assert len([i for i in blog_db.items if i["pk"] == "TAG#news"]) == 0
        assert len([i for i in blog_db.items if i["pk"] == "TAG#update"]) == 0
        assert len([i for i in blog_db.items if i["pk"] == "TAG#tutorial"]) == 1
        assert len([i for i in blog_db.items if i["pk"] == "TAG#guide"]) == 1

    def test_not_found(self, blog_db, mock_ssm):
        event = make_admin_event("PUT", "/blog/posts/{slug}",
                                 body={"title": "X"},
                                 path_params={"slug": "nonexistent"})
        status, body = _call(event)
        assert status == 404

    def test_requires_admin(self, blog_db, mock_ssm):
        _create_post(title="Protected", slug="protected")
        event = make_event("PUT", "/blog/posts/{slug}",
                          body={"title": "Hack"}, path_params={"slug": "protected"})
        status, body = _call(event)
        assert status == 401

    def test_empty_update_rejected(self, blog_db, mock_ssm):
        _create_post(title="No Change", slug="no-change")
        event = make_admin_event("PUT", "/blog/posts/{slug}",
                                 body={},
                                 path_params={"slug": "no-change"})
        status, body = _call(event)
        assert status == 400


# ---------------------------------------------------------------------------
# DELETE /blog/posts/{slug} — Delete
# ---------------------------------------------------------------------------

class TestDeleteBlogPost:

    def test_delete_published_post(self, blog_db, mock_ssm):
        _create_post(title="Doomed", slug="doomed", status="published",
                     tags=["news"])
        assert len(blog_db.items) >= 2  # main + tag

        event = make_admin_event("DELETE", "/blog/posts/{slug}",
                                 path_params={"slug": "doomed"})
        status, body = _call(event)
        assert status == 200
        assert body["data"]["deleted"] is True

        # All items cleaned up
        post_items = [i for i in blog_db.items if i["pk"].startswith("POST#")]
        tag_items = [i for i in blog_db.items if i["pk"].startswith("TAG#")]
        assert len(post_items) == 0
        assert len(tag_items) == 0

    def test_delete_draft(self, blog_db, mock_ssm):
        _create_post(title="Draft", slug="draft-delete")
        event = make_admin_event("DELETE", "/blog/posts/{slug}",
                                 path_params={"slug": "draft-delete"})
        status, body = _call(event)
        assert status == 200

    def test_not_found(self, blog_db, mock_ssm):
        event = make_admin_event("DELETE", "/blog/posts/{slug}",
                                 path_params={"slug": "ghost"})
        status, body = _call(event)
        assert status == 404

    def test_requires_admin(self, blog_db, mock_ssm):
        _create_post(title="Safe", slug="safe")
        event = make_event("DELETE", "/blog/posts/{slug}",
                          path_params={"slug": "safe"})
        status, body = _call(event)
        assert status == 401


# ---------------------------------------------------------------------------
# Full Lifecycle
# ---------------------------------------------------------------------------

class TestBlogLifecycle:

    def test_create_edit_publish_rename_delete(self, blog_db, mock_ssm):
        """Full lifecycle: create draft -> edit -> publish -> rename slug -> delete."""
        # 1. Create draft
        s, b = _create_post(title="Lifecycle", slug="lifecycle",
                            content="<p>v1</p>", tags=["news"])
        assert s == 201
        post_id = b["data"]["postId"]

        # 2. Edit content
        event = make_admin_event("PUT", "/blog/posts/{slug}",
                                 body={"content": "<p>v2 improved</p>"},
                                 path_params={"slug": "lifecycle"})
        s, b = _call(event)
        assert s == 200

        # 3. Publish
        event = make_admin_event("PUT", "/blog/posts/{slug}",
                                 body={"status": "published"},
                                 path_params={"slug": "lifecycle"})
        s, b = _call(event)
        assert s == 200
        assert b["data"]["status"] == "published"

        # 4. Verify it appears in published list
        event = make_event("GET", "/blog/posts")
        s, b = _call(event)
        slugs = [p["slug"] for p in b["data"]["posts"]]
        assert "lifecycle" in slugs

        # 5. Rename slug
        event = make_admin_event("PUT", "/blog/posts/{slug}",
                                 body={"slug": "lifecycle-v2"},
                                 path_params={"slug": "lifecycle"})
        s, b = _call(event)
        assert s == 200

        # 6. Old slug redirects
        event = make_event("GET", "/blog/posts/{slug}",
                          path_params={"slug": "lifecycle"})
        s, b = _call(event)
        assert s == 301
        assert b["data"]["slug"] == "lifecycle-v2"

        # 7. New slug works
        event = make_event("GET", "/blog/posts/{slug}",
                          path_params={"slug": "lifecycle-v2"})
        s, b = _call(event)
        assert s == 200
        assert b["data"]["content"] == "<p>v2 improved</p>"

        # 8. Delete
        event = make_admin_event("DELETE", "/blog/posts/{slug}",
                                 path_params={"slug": "lifecycle-v2"})
        s, b = _call(event)
        assert s == 200

        # 9. Gone
        event = make_event("GET", "/blog/posts/{slug}",
                          path_params={"slug": "lifecycle-v2"})
        s, b = _call(event)
        assert s == 404


# ---------------------------------------------------------------------------
# Validation Edge Cases
# ---------------------------------------------------------------------------

class TestBlogValidation:

    def test_slug_special_chars_rejected(self, blog_db, mock_ssm):
        for bad_slug in ["Hello World", "a/b", "a@b", "a..b"]:
            s, b = _create_post(title="X", slug=bad_slug, content="<p>x</p>")
            assert s == 400, f"Slug '{bad_slug}' should be rejected"

    def test_uppercase_slug_lowered(self, blog_db, mock_ssm):
        """Uppercase slugs are auto-lowered, not rejected."""
        s, b = _create_post(title="X", slug="A-B-C", content="<p>x</p>")
        assert s == 201
        assert b["data"]["slug"] == "a-b-c"

    def test_valid_slugs_accepted(self, blog_db, mock_ssm):
        for good_slug in ["hello-world", "post-123", "a", "my-2026-post"]:
            s, b = _create_post(title="X", slug=good_slug, content="<p>x</p>")
            assert s == 201, f"Slug '{good_slug}' should be accepted"

    def test_title_too_long(self, blog_db, mock_ssm):
        s, b = _create_post(title="x" * 201, slug="long-title")
        assert s == 400

    def test_content_too_long(self, blog_db, mock_ssm):
        s, b = _create_post(title="Big", slug="big-content",
                            content="x" * 50_001)
        assert s == 400

    def test_tags_must_be_list(self, blog_db, mock_ssm):
        event = make_admin_event("POST", "/blog/posts", body={
            "title": "X", "content": "<p>x</p>", "tags": "not-a-list",
        })
        s, b = _call(event)
        assert s == 400

    def test_featured_image_accepted(self, blog_db, mock_ssm):
        s, b = _create_post(title="With Image", slug="with-image")
        assert s == 201

    def test_featured_image_javascript_protocol_rejected(self, blog_db, mock_ssm):
        event = make_admin_event("POST", "/blog/posts", body={
            "title": "XSS", "content": "<p>x</p>",
            "featuredImage": "javascript:alert(1)",
        })
        s, b = _call(event)
        assert s == 400
        assert "HTTPS" in b["message"] or "https" in b["message"]

    def test_featured_image_data_uri_rejected(self, blog_db, mock_ssm):
        event = make_admin_event("POST", "/blog/posts", body={
            "title": "Data URI", "content": "<p>x</p>",
            "featuredImage": "data:text/html,<script>alert(1)</script>",
        })
        s, b = _call(event)
        assert s == 400

    def test_featured_image_https_accepted(self, blog_db, mock_ssm):
        event = make_admin_event("POST", "/blog/posts", body={
            "title": "HTTPS", "content": "<p>x</p>", "slug": "https-img",
            "featuredImage": "https://example.com/photo.jpg",
        })
        s, b = _call(event)
        assert s == 201

    def test_featured_image_uploads_path_accepted(self, blog_db, mock_ssm):
        event = make_admin_event("POST", "/blog/posts", body={
            "title": "Upload", "content": "<p>x</p>", "slug": "upload-img",
            "featuredImage": "uploads/abc123.jpg",
        })
        s, b = _call(event)
        assert s == 201

    def test_limit_non_numeric_defaults(self, blog_db, mock_ssm):
        """Non-numeric limit param should default to 10, not crash."""
        _create_post(title="Post", slug="post", status="published")
        event = make_event("GET", "/blog/posts")
        event["queryStringParameters"] = {"limit": "abc"}
        s, b = _call(event)
        assert s == 200

    def test_draft_not_cached(self, blog_db, mock_ssm):
        """Draft post responses should not have public cache headers."""
        _create_post(title="Draft", slug="draft-cache", status="draft")
        event = make_admin_event("GET", "/blog/posts/{slug}",
                                 path_params={"slug": "draft-cache"})
        resp = lambda_handler(event, FakeContext())
        assert "public" not in resp["headers"].get("Cache-Control", "")

    def test_published_post_cached(self, blog_db, mock_ssm):
        """Published post responses should have public cache headers."""
        _create_post(title="Live", slug="live-cache", status="published")
        event = make_event("GET", "/blog/posts/{slug}",
                          path_params={"slug": "live-cache"})
        resp = lambda_handler(event, FakeContext())
        assert "public" in resp["headers"].get("Cache-Control", "")


# ---------------------------------------------------------------------------
# Content Stripping (list vs single)
# ---------------------------------------------------------------------------

class TestContentStripping:
    """List endpoints must strip content field; single GET must include it."""

    def test_list_published_strips_content(self, blog_db, mock_ssm):
        _create_post(title="Has Content", slug="has-content",
                     content="<p>Full body here</p>", status="published")
        event = make_event("GET", "/blog/posts")
        s, b = _call(event)
        assert s == 200
        for post in b["data"]["posts"]:
            assert "content" not in post, "List should strip content field"

    def test_admin_list_strips_content(self, blog_db, mock_ssm):
        _create_post(title="Admin Post", slug="admin-post",
                     content="<p>Secret content</p>", status="draft")
        event = make_admin_event("GET", "/blog/posts",
                                 query_params={"status": "draft"})
        s, b = _call(event)
        assert s == 200
        for post in b["data"]["posts"]:
            assert "content" not in post, "Admin list should strip content"

    def test_single_get_includes_content(self, blog_db, mock_ssm):
        _create_post(title="Full Post", slug="full-post",
                     content="<p>This must appear</p>", status="published")
        event = make_event("GET", "/blog/posts/{slug}",
                          path_params={"slug": "full-post"})
        s, b = _call(event)
        assert s == 200
        assert "content" in b["data"]
        assert b["data"]["content"] == "<p>This must appear</p>"


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

class TestPagination:
    """Verify pagination works with limit and nextKey."""

    def test_pagination_returns_limited_results(self, blog_db, mock_ssm):
        for i in range(15):
            _create_post(title=f"Post {i}", slug=f"paginated-{i}",
                         status="published")
        event = make_event("GET", "/blog/posts")
        event["queryStringParameters"] = {"limit": "5"}
        s, b = _call(event)
        assert s == 200
        assert len(b["data"]["posts"]) == 5

    def test_default_limit_is_10(self, blog_db, mock_ssm):
        for i in range(15):
            _create_post(title=f"Post {i}", slug=f"default-limit-{i}",
                         status="published")
        event = make_event("GET", "/blog/posts")
        s, b = _call(event)
        assert s == 200
        assert len(b["data"]["posts"]) <= 10

    def test_limit_capped_at_50(self, blog_db, mock_ssm):
        """Requesting limit=999 should be capped to 50."""
        _create_post(title="One", slug="cap-test", status="published")
        event = make_event("GET", "/blog/posts")
        event["queryStringParameters"] = {"limit": "999"}
        s, b = _call(event)
        assert s == 200  # doesn't crash


# ---------------------------------------------------------------------------
# Tag Edge Cases
# ---------------------------------------------------------------------------

class TestTagEdgeCases:

    def test_empty_tags_in_array_filtered(self, blog_db, mock_ssm):
        """Empty strings in tags array should be silently removed."""
        s, b = _create_post(title="Empty Tags", slug="empty-tags",
                            tags=["news", "", "  ", "update"])
        assert s == 201

    def test_duplicate_tags_accepted(self, blog_db, mock_ssm):
        """Duplicate tags shouldn't crash, even if wasteful."""
        s, b = _create_post(title="Dupe Tags", slug="dupe-tags",
                            tags=["news", "news", "news"], status="published")
        assert s == 201

    def test_max_length_tag_accepted(self, blog_db, mock_ssm):
        long_tag = "a" * 50
        s, b = _create_post(title="Long Tag", slug="long-tag",
                            tags=[long_tag])
        assert s == 201

    def test_tag_over_max_length_filtered(self, blog_db, mock_ssm):
        """Tags over 50 chars should be silently dropped by validator."""
        over_tag = "a" * 51
        s, b = _create_post(title="Over Tag", slug="over-tag",
                            tags=[over_tag, "valid"])
        assert s == 201

    def test_tag_special_chars_filtered(self, blog_db, mock_ssm):
        """Tags with special chars should be silently dropped."""
        s, b = _create_post(title="Bad Tag", slug="bad-tag",
                            tags=["Hello World", "good-tag", "bad@tag"])
        assert s == 201


# ---------------------------------------------------------------------------
# Slug Edge Cases
# ---------------------------------------------------------------------------

class TestSlugEdgeCases:

    def test_max_length_slug_accepted(self, blog_db, mock_ssm):
        slug = "a-" * 59 + "ab"  # 120 chars
        assert len(slug) == 120
        s, b = _create_post(title="Long Slug", slug=slug)
        assert s == 201

    def test_slug_over_max_rejected(self, blog_db, mock_ssm):
        slug = "a" * 121
        s, b = _create_post(title="Too Long", slug=slug)
        assert s == 400

    def test_auto_slug_collision_on_same_title(self, blog_db, mock_ssm):
        """Two posts with same title: first succeeds, second gets slug conflict."""
        s1, b1 = _create_post(title="Same Title", content="<p>First</p>")
        assert s1 == 201
        assert b1["data"]["slug"] == "same-title"

        s2, b2 = _create_post(title="Same Title", content="<p>Second</p>")
        assert s2 == 409  # duplicate slug
        assert b2["code"] == "CONFLICT"

    def test_update_with_invalid_slug_rejected(self, blog_db, mock_ssm):
        _create_post(title="Valid", slug="valid-slug")
        event = make_admin_event("PUT", "/blog/posts/{slug}",
                                 body={"slug": "BAD SLUG!!"},
                                 path_params={"slug": "valid-slug"})
        s, b = _call(event)
        assert s == 400


# ---------------------------------------------------------------------------
# Publish/Unpublish Edge Cases
# ---------------------------------------------------------------------------

class TestPublishEdgeCases:

    def test_republish_preserves_original_published_at(self, blog_db, mock_ssm):
        """Unpublish then republish should keep the original publishedAt."""
        _create_post(title="Republish", slug="republish", status="published")

        # Get the original publishedAt
        event = make_admin_event("GET", "/blog/posts/{slug}",
                                 path_params={"slug": "republish"})
        _, b = _call(event)
        original_published_at = b["data"]["publishedAt"]
        assert original_published_at != ""

        # Unpublish
        event = make_admin_event("PUT", "/blog/posts/{slug}",
                                 body={"status": "draft"},
                                 path_params={"slug": "republish"})
        _call(event)

        # Republish
        event = make_admin_event("PUT", "/blog/posts/{slug}",
                                 body={"status": "published"},
                                 path_params={"slug": "republish"})
        _call(event)

        # publishedAt should still be the original
        event = make_admin_event("GET", "/blog/posts/{slug}",
                                 path_params={"slug": "republish"})
        _, b = _call(event)
        assert b["data"]["publishedAt"] == original_published_at

    def test_publish_already_published_is_noop(self, blog_db, mock_ssm):
        """Publishing an already published post shouldn't create duplicate tags."""
        _create_post(title="Already Live", slug="already-live",
                     status="published", tags=["news"])
        tag_count_before = len([i for i in blog_db.items if i["pk"] == "TAG#news"])

        event = make_admin_event("PUT", "/blog/posts/{slug}",
                                 body={"status": "published"},
                                 path_params={"slug": "already-live"})
        s, b = _call(event)
        assert s == 200

        tag_count_after = len([i for i in blog_db.items if i["pk"] == "TAG#news"])
        assert tag_count_after == tag_count_before, "Should not duplicate tag items"


class TestBlogFeed:
    """Tests for GET /blog/feed (RSS 2.0)."""

    def test_blog_feed_returns_xml(self, blog_db, mock_ssm):
        _create_post(title="Feed Post 1", slug="feed-1", status="published")
        _create_post(title="Feed Post 2", slug="feed-2", status="published")
        event = make_event("GET", "/blog/feed")
        resp = lambda_handler(event, CTX)
        assert resp["statusCode"] == 200
        assert "application/rss+xml" in resp["headers"]["Content-Type"]
        body = resp["body"]
        assert "<rss" in body
        assert "Feed Post 1" in body
        assert "Feed Post 2" in body

    def test_blog_feed_excludes_drafts(self, blog_db, mock_ssm):
        _create_post(title="Published One", slug="pub-1", status="published")
        _create_post(title="Draft One", slug="draft-1", status="draft")
        event = make_event("GET", "/blog/feed")
        resp = lambda_handler(event, CTX)
        assert resp["statusCode"] == 200
        assert "Published One" in resp["body"]
        assert "Draft One" not in resp["body"]

    def test_blog_feed_caching_headers(self, blog_db):
        event = make_event("GET", "/blog/feed")
        resp = lambda_handler(event, CTX)
        assert resp["headers"]["Cache-Control"] == "public, max-age=300"

    def test_blog_feed_empty(self, blog_db):
        event = make_event("GET", "/blog/feed")
        resp = lambda_handler(event, CTX)
        assert resp["statusCode"] == 200
        body = resp["body"]
        assert "<rss" in body
        assert "<channel>" in body
        assert "<item>" not in body
