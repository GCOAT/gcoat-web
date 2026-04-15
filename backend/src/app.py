import hmac
import html
import json
import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone
from email.utils import format_datetime

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

try:
    from . import db
except ImportError:
    import db

# Cached clients / cached admin token
_S3 = None
_SSM = None
_SES = None
_ADMIN_TOKEN = None
_ADMIN_TOKEN_LOADED_AT = 0

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Email validation: multi-step (structural regex + explicit dot/length checks).
# Accepts RFC 5322 special chars (apostrophes, etc.) and punycode TLDs (xn--).
# Rejects IP address domains (not appropriate for contact forms).
_EMAIL_STRUCT_RE = re.compile(
    r"^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+"
    r"(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*"
    r"@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
    r"(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*"
    r"\.(?:[a-zA-Z]{2,63}|xn--[a-zA-Z0-9-]{1,59})$"
)
_CONSECUTIVE_DOTS_RE = re.compile(r"\.{2,}")
_DOT_AT_LOCAL_BOUNDARY_RE = re.compile(r"^\.|\.$")
MAX_LOCAL_PART_LEN = 64

MAX_BODY_BYTES = 10_240  # 10KB
MAX_NAME_LEN = 100
MAX_EMAIL_LEN = 254
MAX_MESSAGE_LEN = 2000
MAX_PHONE_LEN = 20
MAX_SOURCE_LEN = 50
MAX_STRING_FIELD_LEN = 50
MAX_COMPANY_LEN = 100
MAX_FEATURES_COUNT = 10
MAX_FEATURE_ITEM_LEN = 50
MAX_EXISTING_WEBSITE_LEN = 254
MAX_INSPIRATION_LINKS_LEN = 500
MAX_BRANDING_STATUS_LEN = 200

ALLOWED_LEAD_FIELDS = {
    "name", "email", "message", "source", "phone", "projectType",
    "budgetRange", "timeline", "companyName", "features", "website",
    "existingWebsite", "inspirationLinks", "brandingStatus",
}

ALLOWED_SOURCES = {"intake", "contact", "signup", "blog-subscribe", "kore-starter"}

# Sources that require name + email + message
SOURCES_REQUIRE_MESSAGE = {"intake", "contact", "kore-starter"}

ALLOWED_EXTS = {"png","jpg","jpeg","webp","gif","mp3","wav","m4a","aac","ogg"}
ALLOWED_MIME = {
    "image/png","image/jpeg","image/webp","image/gif",
    "audio/mpeg","audio/wav","audio/x-wav","audio/mp4","audio/aac","audio/ogg"
}
PRESIGN_EXPIRES_SECONDS = 300  # 5 minutes
MAX_BLOG_BODY_BYTES = 102_400  # 100KB for blog content

# CORS: primary origin from env, optional dev origin for local testing
_ALLOWED_ORIGINS = set(filter(None, [
    os.environ.get("ALLOWED_ORIGIN", ""),
    os.environ.get("DEV_ORIGIN", ""),
]))

# Set per-request by lambda_handler; used by _json to return correct CORS origin
_current_origin = os.environ.get("ALLOWED_ORIGIN", "")

def _now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def _set_origin_for_request(event):
    """Resolve and cache the CORS origin for this request."""
    global _current_origin
    origin = (event or {}).get("headers", {}).get("origin", "")
    _current_origin = origin if origin in _ALLOWED_ORIGINS else os.environ.get("ALLOWED_ORIGIN", "")

def _json(status, payload, *, cache=None):
    headers = {
        "Content-Type": "application/json",
        "Cache-Control": cache if cache else "no-store",
        "Access-Control-Allow-Origin": _current_origin,
        "Access-Control-Allow-Headers": "Content-Type,x-admin-token",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
    }
    if os.environ.get("STAGE") == "prod":
        headers["Strict-Transport-Security"] = "max-age=31536000"
    return {
        "statusCode": status,
        "headers": headers,
        "body": json.dumps(payload),
    }

def _route_key(event):
    rk = event.get("routeKey")
    if rk:
        return rk
    method = (event.get("requestContext", {}).get("http", {}).get("method") or "").upper()
    path = event.get("rawPath") or event.get("path") or ""
    return f"{method} {path}"

def _path_param(event, name, *, prefix=""):
    """Safely extract a path parameter, with rawPath fallback."""
    val = (event.get("pathParameters") or {}).get(name, "")
    if val:
        return val
    if prefix:
        raw = event.get("rawPath") or event.get("path") or ""
        if prefix in raw:
            val = raw.split(prefix, 1)[-1].split("/")[0]
            from urllib.parse import unquote
            return unquote(val)
    return ""

def _body_json(event, *, max_bytes=None):
    max_bytes = max_bytes or MAX_BODY_BYTES
    raw = event.get("body") or ""
    if isinstance(raw, (dict, list)):
        return raw
    # Pre-decode size guard: reject before wasting memory on base64 decode.
    # Base64 inflates by ~33%, so multiply limit by 1.4 for raw check.
    if len(raw) > int(max_bytes * 1.4):
        return None
    if event.get("isBase64Encoded"):
        import base64
        raw = base64.b64decode(raw).decode("utf-8")
    if len(raw.encode("utf-8")) > max_bytes:
        return None
    raw = raw.strip()
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return None

def _s3():
    global _S3
    if _S3 is None:
        _S3 = boto3.client("s3")
    return _S3

def _ssm():
    global _SSM
    if _SSM is None:
        _SSM = boto3.client("ssm")
    return _SSM

def _ses():
    global _SES
    if _SES is None:
        _SES = boto3.client("ses")
    return _SES

def _get_admin_token():
    global _ADMIN_TOKEN, _ADMIN_TOKEN_LOADED_AT
    ttl_seconds = 300
    now = int(time.time())
    if _ADMIN_TOKEN and (now - _ADMIN_TOKEN_LOADED_AT) < ttl_seconds:
        return _ADMIN_TOKEN

    param_name = os.environ.get("ADMIN_TOKEN_PARAM") or ""
    if not param_name:
        # local dev fallback
        _ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")
        _ADMIN_TOKEN_LOADED_AT = now
        return _ADMIN_TOKEN

    try:
        resp = _ssm().get_parameter(Name=param_name, WithDecryption=True)
        _ADMIN_TOKEN = resp["Parameter"]["Value"]
    except ClientError:
        logger.exception("Failed to retrieve admin token from SSM: %s", param_name)
        _ADMIN_TOKEN = ""
    _ADMIN_TOKEN_LOADED_AT = now
    return _ADMIN_TOKEN

def _require_admin(event):
    headers = event.get("headers") or {}
    provided = headers.get("x-admin-token") or headers.get("X-Admin-Token") or ""
    expected = _get_admin_token()
    return bool(expected and provided and hmac.compare_digest(provided, expected))

def _sanitize_for_email(value):
    """Strip CR/LF to prevent email header injection."""
    if not value:
        return value
    return value.replace("\r", "").replace("\n", " ")

def _send_lead_notification(email, name, message, source, **extra):
    """Send SES notification for a new lead. Fails silently."""
    if os.environ.get("ENABLE_SES") != "true":
        return
    sender = os.environ.get("SENDER_EMAIL", "")
    if not sender:
        return
    stage = os.environ.get("STAGE", "unknown")
    safe_name = _sanitize_for_email(name)
    safe_email = _sanitize_for_email(email)
    safe_message = _sanitize_for_email(message)
    safe_source = _sanitize_for_email(source)
    subject = f"New lead from {safe_name or safe_email}"
    body_text = (
        f"New lead submission\n"
        f"-------------------\n"
        f"Name:    {safe_name or '(not provided)'}\n"
        f"Email:   {safe_email}\n"
        f"Message: {safe_message or '(not provided)'}\n"
        f"Source:  {safe_source or '(not provided)'}\n"
        f"Stage:   {stage}\n"
        f"Time:    {_now_iso()}\n"
    )
    # Append optional extra fields
    for label, key in [("Phone", "phone"), ("Company", "companyName"),
                       ("Project Type", "projectType"), ("Budget", "budgetRange"),
                       ("Timeline", "timeline"),
                       ("Existing Website", "existingWebsite"),
                       ("Inspiration", "inspirationLinks"),
                       ("Branding", "brandingStatus"),
                       ("Features", "features")]:
        val = extra.get(key)
        if val:
            display = ", ".join(val) if isinstance(val, list) else _sanitize_for_email(str(val))
            body_text += f"{label}: {display}\n"
    try:
        _ses().send_email(
            Source=sender,
            Destination={"ToAddresses": [sender]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {"Text": {"Data": body_text, "Charset": "UTF-8"}},
            },
        )
    except ClientError:
        logger.warning("SES send_email failed", exc_info=True)

CONFIRMATION_EMAIL_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background-color:#1a1a2e;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">{site_name}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#333333;">Hi {name},</p>
              <p style="margin:0 0 16px;font-size:16px;color:#333333;">{confirmation_body}</p>
              <p style="margin:0 0 24px;font-size:16px;color:#333333;">We'll be in touch soon. In the meantime, if you'd like to talk through your project, feel free to book a free discovery call:</p>
              <p style="margin:0;text-align:center;"><a href="https://calendly.com/gcoatllc/30min" style="display:inline-block;padding:12px 24px;background-color:#1a1a2e;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;">Book a Discovery Call</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background-color:#f4f4f7;text-align:center;">
              <p style="margin:0;font-size:12px;color:#999999;">&copy; {site_name}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

def _send_lead_confirmation(lead_email, lead_name):
    """Send HTML confirmation email to the lead. Fails silently."""
    if os.environ.get("ENABLE_SES") != "true":
        return
    sender = os.environ.get("SENDER_EMAIL", "")
    if not sender:
        return
    site_name = os.environ.get("SITE_NAME", "") or "Our Team"
    subject = os.environ.get("CONFIRMATION_SUBJECT", "Thanks for signing up!")
    safe_lead_name = _sanitize_for_email(lead_name)
    display_name = safe_lead_name or "there"
    safe_site_name = html.escape(site_name)
    safe_display_name = html.escape(display_name)
    body_text = (f"Thanks for reaching out, {display_name}! We received your submission and appreciate your interest.\n\n"
                  f"Want to talk through your project? Book a free discovery call: https://calendly.com/gcoatllc/30min")
    body_html = CONFIRMATION_EMAIL_HTML.format(
        site_name=safe_site_name,
        name=safe_display_name,
        confirmation_body=f"Thanks for reaching out! We received your submission and appreciate your interest.",
    )
    try:
        _ses().send_email(
            Source=sender,
            Destination={"ToAddresses": [lead_email]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Text": {"Data": body_text, "Charset": "UTF-8"},
                    "Html": {"Data": body_html, "Charset": "UTF-8"},
                },
            },
        )
    except ClientError:
        logger.warning("SES lead confirmation failed", exc_info=True)

def handle_options(_event):
    return _json(200, {"ok": True})

def handle_post_leads(event):
    data = _body_json(event)
    if data is None:
        return _json(400, {"ok": False, "message": "Invalid JSON", "code": "VALIDATION_ERROR"})
    if not isinstance(data, dict):
        return _json(400, {"ok": False, "message": "Invalid JSON", "code": "VALIDATION_ERROR"})

    # Honeypot check — silently accept
    if str(data.get("website") or "").strip():
        return _json(200, {"ok": True, "data": {"ignored": True}})

    # Reject unknown fields
    unknown = set(data.keys()) - ALLOWED_LEAD_FIELDS
    if unknown:
        return _json(400, {"ok": False, "message": "Unknown fields", "code": "VALIDATION_ERROR"})

    # Extract and sanitize fields
    email = str(data.get("email") or "").strip()
    name = str(data.get("name") or "").strip()
    message = str(data.get("message") or "").strip()
    source = str(data.get("source") or "").strip()
    phone = str(data.get("phone") or "").strip()
    project_type = str(data.get("projectType") or "").strip()
    budget_range = str(data.get("budgetRange") or "").strip()
    timeline = str(data.get("timeline") or "").strip()
    company_name = str(data.get("companyName") or "").strip()
    existing_website = str(data.get("existingWebsite") or "").strip()
    inspiration_links = str(data.get("inspirationLinks") or "").strip()
    branding_status = str(data.get("brandingStatus") or "").strip()
    features_raw = data.get("features")

    # Source validation
    if not source:
        return _json(400, {"ok": False, "message": "Source is required", "code": "VALIDATION_ERROR"})
    if source not in ALLOWED_SOURCES:
        return _json(400, {"ok": False, "message": "Invalid source", "code": "VALIDATION_ERROR"})

    # Email — always required (multi-step validation)
    if not email or len(email) > MAX_EMAIL_LEN:
        return _json(400, {"ok": False, "message": "Invalid email", "code": "VALIDATION_ERROR"})
    if not _EMAIL_STRUCT_RE.match(email):
        return _json(400, {"ok": False, "message": "Invalid email", "code": "VALIDATION_ERROR"})
    local_part = email.split("@")[0]
    if len(local_part) > MAX_LOCAL_PART_LEN:
        return _json(400, {"ok": False, "message": "Invalid email", "code": "VALIDATION_ERROR"})
    if _CONSECUTIVE_DOTS_RE.search(local_part):
        return _json(400, {"ok": False, "message": "Invalid email", "code": "VALIDATION_ERROR"})
    if _DOT_AT_LOCAL_BOUNDARY_RE.search(local_part):
        return _json(400, {"ok": False, "message": "Invalid email", "code": "VALIDATION_ERROR"})

    # Source-specific required fields
    if source in SOURCES_REQUIRE_MESSAGE:
        if not name:
            return _json(400, {"ok": False, "message": "Name is required", "code": "VALIDATION_ERROR"})
        if not message:
            return _json(400, {"ok": False, "message": "Message is required", "code": "VALIDATION_ERROR"})

    # Field length limits
    if name and len(name) > MAX_NAME_LEN:
        return _json(400, {"ok": False, "message": "Name too long", "code": "VALIDATION_ERROR"})
    if message and len(message) > MAX_MESSAGE_LEN:
        return _json(400, {"ok": False, "message": "Message too long", "code": "VALIDATION_ERROR"})
    if phone and len(phone) > MAX_PHONE_LEN:
        return _json(400, {"ok": False, "message": "Phone too long", "code": "VALIDATION_ERROR"})
    if project_type and len(project_type) > MAX_STRING_FIELD_LEN:
        return _json(400, {"ok": False, "message": "Project type too long", "code": "VALIDATION_ERROR"})
    if budget_range and len(budget_range) > MAX_STRING_FIELD_LEN:
        return _json(400, {"ok": False, "message": "Budget range too long", "code": "VALIDATION_ERROR"})
    if timeline and len(timeline) > MAX_STRING_FIELD_LEN:
        return _json(400, {"ok": False, "message": "Timeline too long", "code": "VALIDATION_ERROR"})
    if company_name and len(company_name) > MAX_COMPANY_LEN:
        return _json(400, {"ok": False, "message": "Company name too long", "code": "VALIDATION_ERROR"})
    if existing_website and len(existing_website) > MAX_EXISTING_WEBSITE_LEN:
        return _json(400, {"ok": False, "message": "Existing website URL too long", "code": "VALIDATION_ERROR"})
    if inspiration_links and len(inspiration_links) > MAX_INSPIRATION_LINKS_LEN:
        return _json(400, {"ok": False, "message": "Inspiration links too long", "code": "VALIDATION_ERROR"})
    if branding_status and len(branding_status) > MAX_BRANDING_STATUS_LEN:
        return _json(400, {"ok": False, "message": "Branding status too long", "code": "VALIDATION_ERROR"})

    # Features validation
    features = []
    if features_raw is not None:
        if not isinstance(features_raw, list):
            return _json(400, {"ok": False, "message": "Features must be a list", "code": "VALIDATION_ERROR"})
        if len(features_raw) > MAX_FEATURES_COUNT:
            return _json(400, {"ok": False, "message": "Too many features", "code": "VALIDATION_ERROR"})
        for item in features_raw:
            val = str(item).strip()
            if len(val) > MAX_FEATURE_ITEM_LEN:
                return _json(400, {"ok": False, "message": "Feature item too long", "code": "VALIDATION_ERROR"})
            if val:
                features.append(val)

    table = os.environ.get("LEADS_TABLE_NAME") or ""
    if not table:
        return _json(500, {"ok": False, "message": "Server not configured", "code": "INTERNAL_ERROR"})

    created_at = _now_iso()
    item = {
        "pk": "LEADS",
        "sk": f"{created_at}#{uuid.uuid4()}",
        "createdAt": created_at,
        "email": email,
        "name": name,
        "message": message,
        "source": source,
        "expiresAt": int(time.time()) + 365 * 86400,
    }
    # Add optional fields only if non-empty
    if phone:
        item["phone"] = phone
    if project_type:
        item["projectType"] = project_type
    if budget_range:
        item["budgetRange"] = budget_range
    if timeline:
        item["timeline"] = timeline
    if company_name:
        item["companyName"] = company_name
    if features:
        item["features"] = features
    if existing_website:
        item["existingWebsite"] = existing_website
    if inspiration_links:
        item["inspirationLinks"] = inspiration_links
    if branding_status:
        item["brandingStatus"] = branding_status

    try:
        db.put_item(table, item)
        _send_lead_notification(email, name, message, source,
                                phone=phone, companyName=company_name,
                                projectType=project_type, budgetRange=budget_range,
                                timeline=timeline,
                                existingWebsite=existing_website,
                                inspirationLinks=inspiration_links,
                                brandingStatus=branding_status,
                                features=features)
        _send_lead_confirmation(email, name)
        return _json(200, {"ok": True, "data": {"createdAt": created_at}})
    except ClientError:
        return _json(500, {"ok": False, "message": "Failed to store lead", "code": "INTERNAL_ERROR"})

def handle_get_content(event):
    page = _path_param(event, "page", prefix="/content/").strip().lower()
    if not page or not re.match(r"^[a-z0-9\-]{1,100}$", page):
        return _json(400, {"ok": False, "message": "Invalid page", "code": "VALIDATION_ERROR"})

    table = os.environ.get("CONTENT_TABLE_NAME") or ""
    if not table:
        return _json(500, {"ok": False, "message": "Server not configured", "code": "INTERNAL_ERROR"})

    key = {"pk": "CONTENT", "sk": f"PAGE#{page}"}
    try:
        item = db.get_item(table, key)
        if not item:
            return _json(404, {"ok": False, "message": "Not found", "code": "NOT_FOUND"})
        return _json(200, {"ok": True, "data": item.get("data", {})}, cache="public, max-age=60")
    except ClientError:
        return _json(500, {"ok": False, "message": "Failed to read content", "code": "INTERNAL_ERROR"})

def handle_post_media_presign(event):
    if not _require_admin(event):
        return _json(401, {"ok": False, "message": "Unauthorized", "code": "AUTH_REQUIRED"})

    data = _body_json(event)
    if data is None:
        return _json(400, {"ok": False, "message": "Invalid JSON", "code": "VALIDATION_ERROR"})
    filename = str(data.get("filename") or "").strip()
    content_type = str(data.get("contentType") or "").strip()

    if not filename or len(filename) > 180:
        return _json(400, {"ok": False, "message": "Invalid filename", "code": "VALIDATION_ERROR"})
    if content_type not in ALLOWED_MIME:
        return _json(400, {"ok": False, "message": "Invalid contentType", "code": "VALIDATION_ERROR"})

    filename = os.path.basename(filename)
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTS:
        return _json(400, {"ok": False, "message": "Invalid file extension", "code": "VALIDATION_ERROR"})

    bucket = os.environ.get("MEDIA_BUCKET_NAME") or ""
    if not bucket:
        return _json(500, {"ok": False, "message": "Server not configured", "code": "INTERNAL_ERROR"})

    key = f"uploads/{uuid.uuid4().hex}.{ext}"
    try:
        url = _s3().generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": bucket,
                "Key": key,
                "ContentType": content_type,
                "ServerSideEncryption": "AES256",
            },
            ExpiresIn=PRESIGN_EXPIRES_SECONDS,
        )
        return _json(200, {"ok": True, "data": {"uploadUrl": url, "key": key}})
    except ClientError:
        return _json(500, {"ok": False, "message": "Failed to create presign", "code": "INTERNAL_ERROR"})


# ---------------------------------------------------------------------------
# Admin: Leads
# ---------------------------------------------------------------------------

def handle_get_leads(event):
    """GET /leads — list all leads (admin only)."""
    if not _require_admin(event):
        return _json(401, {"ok": False, "message": "Unauthorized", "code": "AUTH_REQUIRED"})

    table = os.environ.get("LEADS_TABLE_NAME") or ""
    if not table:
        return _json(500, {"ok": False, "message": "Server not configured", "code": "INTERNAL_ERROR"})

    params = event.get("queryStringParameters") or {}
    try:
        limit = min(int(params.get("limit") or 200), 500)
    except (ValueError, TypeError):
        limit = 200

    try:
        items, last_key = db.query_items(
            table, Key("pk").eq("LEADS"),
            scan_forward=False, limit=limit,
        )
        return _json(200, {"ok": True, "data": {"leads": items, "nextKey": last_key}})
    except ClientError:
        return _json(500, {"ok": False, "message": "Failed to list leads", "code": "INTERNAL_ERROR"})


def handle_delete_lead(event):
    """DELETE /leads/{sk} — delete a single lead (admin only)."""
    if not _require_admin(event):
        return _json(401, {"ok": False, "message": "Unauthorized", "code": "AUTH_REQUIRED"})

    table = os.environ.get("LEADS_TABLE_NAME") or ""
    if not table:
        return _json(500, {"ok": False, "message": "Server not configured", "code": "INTERNAL_ERROR"})

    sk = _path_param(event, "sk", prefix="/leads/").strip()
    if not sk:
        return _json(400, {"ok": False, "message": "Missing lead ID", "code": "VALIDATION_ERROR"})

    try:
        db.delete_item(table, {"pk": "LEADS", "sk": sk})
        return _json(200, {"ok": True, "data": {"deleted": True}})
    except ClientError:
        return _json(500, {"ok": False, "message": "Failed to delete lead", "code": "INTERNAL_ERROR"})


# ---------------------------------------------------------------------------
# Admin: Media
# ---------------------------------------------------------------------------

def handle_get_media_list(event):
    """GET /media/list — list S3 objects in uploads/ (admin only)."""
    if not _require_admin(event):
        return _json(401, {"ok": False, "message": "Unauthorized", "code": "AUTH_REQUIRED"})

    bucket = os.environ.get("MEDIA_BUCKET_NAME") or ""
    if not bucket:
        return _json(500, {"ok": False, "message": "Server not configured", "code": "INTERNAL_ERROR"})

    try:
        resp = _s3().list_objects_v2(Bucket=bucket, Prefix="uploads/", MaxKeys=200)
        contents = resp.get("Contents", [])
        region = os.environ.get("AWS_REGION") or "us-east-1"
        files = []
        for obj in contents:
            key = obj["Key"]
            if key == "uploads/":
                continue
            url = f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
            files.append({
                "key": key,
                "url": url,
                "size": obj.get("Size", 0),
                "lastModified": obj.get("LastModified", "").isoformat() if hasattr(obj.get("LastModified", ""), "isoformat") else "",
            })
        files.sort(key=lambda f: f["lastModified"], reverse=True)
        return _json(200, {"ok": True, "data": {"files": files}})
    except ClientError:
        return _json(500, {"ok": False, "message": "Failed to list media", "code": "INTERNAL_ERROR"})


def handle_delete_media(event):
    """DELETE /media/delete — delete an S3 object (admin only)."""
    if not _require_admin(event):
        return _json(401, {"ok": False, "message": "Unauthorized", "code": "AUTH_REQUIRED"})

    # Accept key from query param (preferred) or body (fallback)
    params = event.get("queryStringParameters") or {}
    key = (params.get("key") or "").strip()
    if not key:
        data = _body_json(event)
        if data is None:
            return _json(400, {"ok": False, "message": "Invalid JSON", "code": "VALIDATION_ERROR"})
        key = str(data.get("key") or "").strip()
    if not key or not key.startswith("uploads/"):
        return _json(400, {"ok": False, "message": "Invalid key", "code": "VALIDATION_ERROR"})

    bucket = os.environ.get("MEDIA_BUCKET_NAME") or ""
    if not bucket:
        return _json(500, {"ok": False, "message": "Server not configured", "code": "INTERNAL_ERROR"})

    try:
        _s3().delete_object(Bucket=bucket, Key=key)
        return _json(200, {"ok": True, "data": {"deleted": True}})
    except ClientError:
        return _json(500, {"ok": False, "message": "Failed to delete media", "code": "INTERNAL_ERROR"})


# ---------------------------------------------------------------------------
# Blog
# ---------------------------------------------------------------------------

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
MAX_TITLE_LEN = 200
MAX_EXCERPT_LEN = 500
MAX_CONTENT_LEN = 50_000
MAX_SLUG_LEN = 120
MAX_TAG_LEN = 50
MAX_TAGS = 10
VALID_BLOG_STATUSES = {"draft", "published"}


def _blog_table():
    return os.environ.get("BLOG_TABLE_NAME") or ""


def _generate_post_id():
    """Generate a time-ordered unique ID (sortable, no external deps).

    Format: {epoch_ms}-{uuid4_hex_12} — lexicographic sort = time sort.
    """
    ms = int(time.time() * 1000)
    return f"{ms:013d}-{uuid.uuid4().hex[:12]}"


def _auto_slug(title):
    """Generate a URL slug from a title."""
    slug = title.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s-]+", "-", slug)
    slug = slug.strip("-")
    return slug[:MAX_SLUG_LEN]


def _validate_blog_post(data, *, require_all=True):
    """Validate blog post fields. Returns (clean_data, error_response).

    If require_all=True (create), title and content are required.
    If require_all=False (update), only validate fields that are present.
    """
    errors = []
    clean = {}

    title = data.get("title")
    if title is not None:
        title = str(title).strip()
        if not title:
            if require_all:
                errors.append("Title is required")
        elif len(title) > MAX_TITLE_LEN:
            errors.append("Title too long")
        else:
            clean["title"] = title
    elif require_all:
        errors.append("Title is required")

    slug = data.get("slug")
    if slug is not None:
        slug = str(slug).strip().lower()
        if not slug:
            if require_all:
                errors.append("Slug is required")
        elif len(slug) > MAX_SLUG_LEN or not _SLUG_RE.match(slug):
            errors.append("Invalid slug (lowercase, hyphens, no special chars)")
        else:
            clean["slug"] = slug

    content = data.get("content")
    if content is not None:
        content = str(content).strip()
        if not content:
            if require_all:
                errors.append("Content is required")
        elif len(content) > MAX_CONTENT_LEN:
            errors.append("Content too long")
        else:
            clean["content"] = content
    elif require_all:
        errors.append("Content is required")

    excerpt = data.get("excerpt")
    if excerpt is not None:
        excerpt = str(excerpt).strip()
        if len(excerpt) > MAX_EXCERPT_LEN:
            errors.append("Excerpt too long")
        else:
            clean["excerpt"] = excerpt

    tags = data.get("tags")
    if tags is not None:
        if not isinstance(tags, list):
            errors.append("Tags must be a list")
        elif len(tags) > MAX_TAGS:
            errors.append(f"Too many tags (max {MAX_TAGS})")
        else:
            clean_tags = []
            for t in tags:
                t = str(t).strip().lower()
                if t and len(t) <= MAX_TAG_LEN and re.match(r"^[a-z0-9-]+$", t):
                    clean_tags.append(t)
            clean["tags"] = clean_tags

    status = data.get("status")
    if status is not None:
        status = str(status).strip().lower()
        if status not in VALID_BLOG_STATUSES:
            errors.append(f"Invalid status (must be draft or published)")
        else:
            clean["status"] = status

    featured_image = data.get("featuredImage")
    if featured_image is not None:
        featured_image = str(featured_image).strip()
        if len(featured_image) > 500:
            errors.append("Featured image URL too long")
        elif featured_image and not (featured_image.startswith("https://")
                                     or featured_image.startswith("uploads/")):
            errors.append("Featured image must be an HTTPS URL or uploads/ path")
        else:
            clean["featuredImage"] = featured_image

    if errors:
        return None, _json(400, {
            "ok": False, "message": "; ".join(errors), "code": "VALIDATION_ERROR",
        })
    return clean, None


def _slug_exists(table, slug, exclude_post_id=None):
    """Check if a slug is already in use (GSI2 query)."""
    items, _ = db.query_items(table, Key("GSI2PK").eq(slug),
                              index_name="GSI2", limit=1)
    if not items:
        return False
    if exclude_post_id and items[0].get("postId") == exclude_post_id:
        return False
    return True


def _write_tag_items(table, post):
    """Create TAG# items for a published post."""
    if post.get("status") != "published" or not post.get("tags"):
        return
    for tag in post["tags"]:
        item = {
            "pk": f"TAG#{tag}",
            "sk": f"{post['publishedAt']}#{post['postId']}",
            "slug": post["slug"],
            "title": post["title"],
            "excerpt": post.get("excerpt", ""),
            "tags": post["tags"],
            "featuredImage": post.get("featuredImage", ""),
            "publishedAt": post["publishedAt"],
            "postId": post["postId"],
        }
        db.put_item(table, item)


def _delete_tag_items(table, post):
    """Remove TAG# items for a post."""
    for tag in post.get("tags", []):
        items, _ = db.query_items(table, Key("pk").eq(f"TAG#{tag}"))
        for item in items:
            if item.get("postId") == post.get("postId"):
                db.delete_item(table, {"pk": item["pk"], "sk": item["sk"]})


def handle_get_blog_posts(event):
    """GET /blog/posts — list published posts (public) or all posts (admin)."""
    table = _blog_table()
    if not table:
        return _json(500, {"ok": False, "message": "Server not configured", "code": "INTERNAL_ERROR"})

    params = event.get("queryStringParameters") or {}
    tag = (params.get("tag") or "").strip().lower()
    status_filter = (params.get("status") or "").strip().lower()
    try:
        limit = min(int(params.get("limit") or 10), 50)
    except (ValueError, TypeError):
        limit = 10

    try:
        # Tag filter: query TAG# partition
        if tag:
            items, last_key = db.query_items(
                table, Key("pk").eq(f"TAG#{tag}"),
                scan_forward=False, limit=limit,
            )
            posts = items
        # Admin: all posts of a specific status
        elif status_filter in VALID_BLOG_STATUSES and _require_admin(event):
            items, last_key = db.query_items(
                table, Key("GSI1PK").eq(status_filter),
                index_name="GSI1", scan_forward=False, limit=limit,
            )
            posts = [{k: v for k, v in item.items() if k != "content"}
                     for item in items]
        # Public: published only
        else:
            items, last_key = db.query_items(
                table, Key("GSI1PK").eq("published"),
                index_name="GSI1", scan_forward=False, limit=limit,
            )
            posts = [{k: v for k, v in item.items() if k != "content"}
                     for item in items]

        return _json(200, {
            "ok": True,
            "data": {"posts": posts, "nextKey": last_key},
        }, cache="public, max-age=60" if not status_filter else None)
    except ClientError:
        return _json(500, {"ok": False, "message": "Failed to list posts", "code": "INTERNAL_ERROR"})


def handle_get_blog_post(event):
    """GET /blog/posts/{slug} — get a single post by slug."""
    table = _blog_table()
    if not table:
        return _json(500, {"ok": False, "message": "Server not configured", "code": "INTERNAL_ERROR"})

    slug = _path_param(event, "slug", prefix="/blog/posts/").strip().lower()
    if not slug or not _SLUG_RE.match(slug):
        return _json(400, {"ok": False, "message": "Invalid slug", "code": "VALIDATION_ERROR"})

    try:
        # GSI2 lookup by slug
        items, _ = db.query_items(table, Key("GSI2PK").eq(slug), index_name="GSI2", limit=1)
        if items:
            post = items[0]
            if post.get("status") != "published" and not _require_admin(event):
                return _json(404, {"ok": False, "message": "Not found", "code": "NOT_FOUND"})
            cache = "public, max-age=60" if post.get("status") == "published" else None
            return _json(200, {"ok": True, "data": post}, cache=cache)

        # Check for redirect
        redirect = db.get_item(table, {"pk": f"REDIRECT#{slug}", "sk": "REDIRECT"})
        if redirect:
            return _json(301, {
                "ok": True,
                "data": {"redirect": True, "slug": redirect["targetSlug"]},
            })

        return _json(404, {"ok": False, "message": "Not found", "code": "NOT_FOUND"})
    except ClientError:
        return _json(500, {"ok": False, "message": "Failed to read post", "code": "INTERNAL_ERROR"})


def handle_post_blog_posts(event):
    """POST /blog/posts — create a new blog post (admin only)."""
    if not _require_admin(event):
        return _json(401, {"ok": False, "message": "Unauthorized", "code": "AUTH_REQUIRED"})

    table = _blog_table()
    if not table:
        return _json(500, {"ok": False, "message": "Server not configured", "code": "INTERNAL_ERROR"})

    data = _body_json(event, max_bytes=MAX_BLOG_BODY_BYTES)
    if data is None:
        return _json(400, {"ok": False, "message": "Invalid JSON", "code": "VALIDATION_ERROR"})

    clean, err = _validate_blog_post(data, require_all=True)
    if err:
        return err

    # Auto-generate slug from title if not provided
    if "slug" not in clean:
        clean["slug"] = _auto_slug(clean["title"])
    if not clean["slug"]:
        return _json(400, {"ok": False, "message": "Could not generate slug", "code": "VALIDATION_ERROR"})

    # Check slug uniqueness
    if _slug_exists(table, clean["slug"]):
        return _json(409, {"ok": False, "message": "Slug already in use", "code": "CONFLICT"})

    now = _now_iso()
    status = clean.get("status", "draft")
    published_at = now if status == "published" else ""
    post_id = _generate_post_id()

    item = {
        "pk": f"POST#{post_id}",
        "sk": "META",
        "GSI1PK": status,
        "GSI1SK": published_at or now,
        "GSI2PK": clean["slug"],
        "GSI2SK": status,
        "postId": post_id,
        "slug": clean["slug"],
        "title": clean["title"],
        "excerpt": clean.get("excerpt", clean["title"][:150]),
        "content": clean["content"],
        "status": status,
        "tags": clean.get("tags", []),
        "featuredImage": clean.get("featuredImage", ""),
        "author": "Admin",
        "createdAt": now,
        "updatedAt": now,
        "publishedAt": published_at,
    }

    try:
        db.put_item(table, item)
        _write_tag_items(table, item)
        return _json(201, {"ok": True, "data": {
            "postId": post_id, "slug": clean["slug"], "status": status,
        }})
    except ClientError:
        return _json(500, {"ok": False, "message": "Failed to create post", "code": "INTERNAL_ERROR"})


def handle_put_blog_post(event):
    """PUT /blog/posts/{slug} — update a blog post (admin only)."""
    if not _require_admin(event):
        return _json(401, {"ok": False, "message": "Unauthorized", "code": "AUTH_REQUIRED"})

    table = _blog_table()
    if not table:
        return _json(500, {"ok": False, "message": "Server not configured", "code": "INTERNAL_ERROR"})

    slug = _path_param(event, "slug", prefix="/blog/posts/").strip().lower()
    if not slug or not _SLUG_RE.match(slug):
        return _json(400, {"ok": False, "message": "Invalid slug", "code": "VALIDATION_ERROR"})

    data = _body_json(event, max_bytes=MAX_BLOG_BODY_BYTES)
    if data is None:
        return _json(400, {"ok": False, "message": "Invalid JSON", "code": "VALIDATION_ERROR"})

    clean, err = _validate_blog_post(data, require_all=False)
    if err:
        return err
    if not clean:
        return _json(400, {"ok": False, "message": "No fields to update", "code": "VALIDATION_ERROR"})

    try:
        # Find post by current slug
        items, _ = db.query_items(table, Key("GSI2PK").eq(slug), index_name="GSI2", limit=1)
        if not items:
            return _json(404, {"ok": False, "message": "Not found", "code": "NOT_FOUND"})

        item = items[0]
        post_id = item["postId"]
        old_status = item["status"]
        old_tags = list(item.get("tags", []))
        old_slug = item["slug"]

        # Slug change: check uniqueness + create redirect
        new_slug = clean.get("slug")
        if new_slug and new_slug != old_slug:
            if _slug_exists(table, new_slug, exclude_post_id=post_id):
                return _json(409, {"ok": False, "message": "Slug already in use", "code": "CONFLICT"})
            item["slug"] = new_slug
            item["GSI2PK"] = new_slug
            # Create redirect from old slug
            db.put_item(table, {
                "pk": f"REDIRECT#{old_slug}",
                "sk": "REDIRECT",
                "targetSlug": new_slug,
                "createdAt": _now_iso(),
            })

        # Apply field updates
        now = _now_iso()
        for field in ("title", "content", "excerpt", "tags", "featuredImage"):
            if field in clean:
                item[field] = clean[field]
        item["updatedAt"] = now

        # Status change handling
        new_status = clean.get("status")
        if new_status and new_status != old_status:
            item["status"] = new_status
            item["GSI1PK"] = new_status
            item["GSI2SK"] = new_status
            if new_status == "published" and not item.get("publishedAt"):
                item["publishedAt"] = now
                item["GSI1SK"] = now
            elif new_status == "draft":
                item["GSI1SK"] = item["createdAt"]
            # Clean up old tag items if unpublishing
            if old_status == "published" and new_status != "published":
                _delete_tag_items(table, {"postId": post_id, "tags": old_tags})
            # Create tag items if publishing
            if new_status == "published" and old_status != "published":
                _write_tag_items(table, item)
        elif old_status == "published" and "tags" in clean:
            # Tags changed while published — rebuild tag items
            _delete_tag_items(table, {"postId": post_id, "tags": old_tags})
            _write_tag_items(table, item)

        db.put_item(table, item)

        return _json(200, {"ok": True, "data": {
            "postId": post_id, "slug": item["slug"], "status": item["status"],
        }})
    except ClientError:
        return _json(500, {"ok": False, "message": "Failed to update post", "code": "INTERNAL_ERROR"})


def handle_delete_blog_post(event):
    """DELETE /blog/posts/{slug} — delete a blog post (admin only)."""
    if not _require_admin(event):
        return _json(401, {"ok": False, "message": "Unauthorized", "code": "AUTH_REQUIRED"})

    table = _blog_table()
    if not table:
        return _json(500, {"ok": False, "message": "Server not configured", "code": "INTERNAL_ERROR"})

    slug = _path_param(event, "slug", prefix="/blog/posts/").strip().lower()
    if not slug or not _SLUG_RE.match(slug):
        return _json(400, {"ok": False, "message": "Invalid slug", "code": "VALIDATION_ERROR"})

    try:
        items, _ = db.query_items(table, Key("GSI2PK").eq(slug), index_name="GSI2", limit=1)
        if not items:
            return _json(404, {"ok": False, "message": "Not found", "code": "NOT_FOUND"})

        item = items[0]
        # Delete tag items if published
        if item.get("status") == "published":
            _delete_tag_items(table, item)
        # Delete main item
        db.delete_item(table, {"pk": item["pk"], "sk": item["sk"]})

        return _json(200, {"ok": True, "data": {"deleted": True}})
    except ClientError:
        return _json(500, {"ok": False, "message": "Failed to delete post", "code": "INTERNAL_ERROR"})


def handle_get_blog_feed(event):
    """Return an RSS 2.0 XML feed of the latest published blog posts."""
    table = _blog_table()
    if not table:
        return _json(500, {"ok": False, "message": "Server not configured", "code": "INTERNAL_ERROR"})
    origin = os.environ.get("ALLOWED_ORIGIN", "")
    site_name = os.environ.get("SITE_NAME", "Blog")

    try:
        items, _ = db.query_items(
            table,
            Key("GSI1PK").eq("published"),
            index_name="GSI1",
            scan_forward=False,
            limit=20,
        )
    except ClientError:
        items = []

    rss_items = ""
    for item in items:
        title = html.escape(item.get("title", ""))
        slug = html.escape(item.get("slug", ""))
        excerpt = html.escape(item.get("excerpt", ""))
        post_id = html.escape(item.get("postId", item.get("pk", "")))
        link = f"{html.escape(origin)}/post.html?slug={slug}"

        pub_date = ""
        published_at = item.get("publishedAt", "")
        if published_at:
            try:
                dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
                pub_date = format_datetime(dt)
            except (ValueError, TypeError):
                pub_date = ""

        rss_items += (
            "<item>"
            f"<title>{title}</title>"
            f"<link>{link}</link>"
            f"<description>{excerpt}</description>"
            f"<pubDate>{pub_date}</pubDate>"
            f"<guid>{post_id}</guid>"
            "</item>"
        )

    xml_string = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<rss version="2.0">'
        "<channel>"
        f"<title>{html.escape(site_name)}</title>"
        f"<link>{html.escape(origin)}</link>"
        "<description>Latest posts</description>"
        f"{rss_items}"
        "</channel>"
        "</rss>"
    )

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            "Access-Control-Allow-Origin": _current_origin,
            "Access-Control-Allow-Headers": "Content-Type,x-admin-token",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        },
        "body": xml_string,
    }


def lambda_handler(event, context):
    start = time.time()
    _set_origin_for_request(event)
    rk = _route_key(event)
    method = (event.get("requestContext", {}).get("http", {}).get("method") or "").upper()
    request_id = getattr(context, "aws_request_id", None)

    try:
        if method == "OPTIONS":
            response = handle_options(event)
        elif rk == "POST /leads":
            response = handle_post_leads(event)
        elif rk == "GET /leads":
            response = handle_get_leads(event)
        elif rk == "DELETE /leads/{sk}" or rk.startswith("DELETE /leads/"):
            response = handle_delete_lead(event)
        elif rk == "GET /content/{page}" or rk.startswith("GET /content/"):
            response = handle_get_content(event)
        elif rk == "POST /media/presign":
            response = handle_post_media_presign(event)
        elif rk == "GET /media/list":
            response = handle_get_media_list(event)
        elif rk == "DELETE /media/delete":
            response = handle_delete_media(event)
        elif rk == "GET /blog/posts":
            response = handle_get_blog_posts(event)
        elif rk == "GET /blog/feed":
            response = handle_get_blog_feed(event)
        elif rk == "GET /blog/posts/{slug}" or rk.startswith("GET /blog/posts/"):
            response = handle_get_blog_post(event)
        elif rk == "POST /blog/posts":
            response = handle_post_blog_posts(event)
        elif rk == "PUT /blog/posts/{slug}" or rk.startswith("PUT /blog/posts/"):
            response = handle_put_blog_post(event)
        elif rk == "DELETE /blog/posts/{slug}" or rk.startswith("DELETE /blog/posts/"):
            response = handle_delete_blog_post(event)
        else:
            response = _json(404, {"ok": False, "message": "Not found", "code": "NOT_FOUND"})
    except Exception:
        logger.exception("Unhandled exception")
        response = _json(500, {"ok": False, "message": "Internal server error", "code": "INTERNAL_ERROR"})

    latency_ms = int((time.time() - start) * 1000)
    logger.info(json.dumps({
        "event": "request",
        "requestId": request_id,
        "method": method,
        "path": event.get("rawPath", ""),
        "routeKey": rk,
        "status": response["statusCode"],
        "latencyMs": latency_ms,
    }))

    return response
