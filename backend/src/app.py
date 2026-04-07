import html
import json
import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

# Cached clients / cached admin token
_DDB = None
_S3 = None
_SSM = None
_SES = None
_ADMIN_TOKEN = None
_ADMIN_TOKEN_LOADED_AT = 0

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Multi-step email validation (hybrid approach)
_EMAIL_STRUCT_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")
_CONSECUTIVE_DOTS_RE = re.compile(r"\.\.")
_DOT_AT_LOCAL_BOUNDARY_RE = re.compile(r"(^\.|\.$)")
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

ALLOWED_LEAD_FIELDS = {
    "name", "email", "message", "source", "phone", "projectType",
    "budgetRange", "timeline", "companyName", "features", "website",
}

ALLOWED_SOURCES = {"intake", "contact", "signup", "kore-starter"}

# Sources that require name + email + message
SOURCES_REQUIRE_MESSAGE = {"intake", "contact", "kore-starter"}

ALLOWED_EXTS = {"png","jpg","jpeg","webp","gif","mp3","wav","m4a","aac","ogg"}
ALLOWED_MIME = {
    "image/png","image/jpeg","image/webp","image/gif",
    "audio/mpeg","audio/wav","audio/x-wav","audio/mp4","audio/aac","audio/ogg"
}
PRESIGN_EXPIRES_SECONDS = 300  # 5 minutes

def _now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def _json(status, payload, *, cache=None):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Cache-Control": cache if cache else "no-store",
            "Access-Control-Allow-Origin": os.environ.get("ALLOWED_ORIGIN", ""),
            "Access-Control-Allow-Headers": "Content-Type,x-admin-token",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        },
        "body": json.dumps(payload),
    }

def _route_key(event):
    rk = event.get("routeKey")
    if rk:
        return rk
    method = (event.get("requestContext", {}).get("http", {}).get("method") or "").upper()
    path = event.get("rawPath") or event.get("path") or ""
    return f"{method} {path}"

MAX_PRE_DECODE_BYTES = 51_200  # 50KB pre-decode guard

def _body_json(event):
    raw = event.get("body") or ""
    if isinstance(raw, (dict, list)):
        return raw
    # Pre-decode size guard (base64 inflates ~33%)
    if len(raw.encode("utf-8")) > MAX_PRE_DECODE_BYTES:
        return None
    if event.get("isBase64Encoded"):
        import base64
        raw = base64.b64decode(raw).decode("utf-8")
    # Post-decode size check
    if len(raw.encode("utf-8")) > MAX_BODY_BYTES:
        return None
    raw = raw.strip()
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return None

def _ddb():
    global _DDB
    if _DDB is None:
        endpoint = os.environ.get("DYNAMODB_ENDPOINT_OVERRIDE")
        _DDB = boto3.resource("dynamodb", endpoint_url=endpoint) if endpoint else boto3.resource("dynamodb")
    return _DDB

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
    return bool(expected and provided and provided == expected)

def _sanitize_for_email(value):
    """Strip CR/LF to prevent email header injection."""
    if not value:
        return value
    return value.replace("\r", "").replace("\n", "")

def _send_lead_notification(email, name, message, source):
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
              <p style="margin:0;font-size:16px;color:#333333;">We'll be in touch soon.</p>
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
    body_text = f"Thanks for reaching out, {display_name}! We received your submission and appreciate your interest."
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

    try:
        _ddb().Table(table).put_item(Item=item)
        _send_lead_notification(email, name, message, source)
        _send_lead_confirmation(email, name)
        return _json(200, {"ok": True, "data": {"createdAt": created_at}})
    except ClientError:
        return _json(500, {"ok": False, "message": "Failed to store lead", "code": "INTERNAL_ERROR"})

def handle_get_content(event):
    page = ((event.get("pathParameters") or {}).get("page") or "").strip().lower()
    if not page or not re.match(r"^[a-z0-9\-]{1,100}$", page):
        return _json(400, {"ok": False, "message": "Invalid page", "code": "VALIDATION_ERROR"})

    table = os.environ.get("CONTENT_TABLE_NAME") or ""
    if not table:
        return _json(500, {"ok": False, "message": "Server not configured", "code": "INTERNAL_ERROR"})

    key = {"pk": "CONTENT", "sk": f"PAGE#{page}"}
    try:
        resp = _ddb().Table(table).get_item(Key=key)
        item = resp.get("Item")
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

def lambda_handler(event, context):
    start = time.time()
    rk = _route_key(event)
    method = (event.get("requestContext", {}).get("http", {}).get("method") or "").upper()
    request_id = getattr(context, "aws_request_id", None)

    try:
        if method == "OPTIONS":
            response = handle_options(event)
        elif rk == "POST /leads":
            response = handle_post_leads(event)
        elif rk == "GET /content/{page}" or rk.startswith("GET /content/"):
            response = handle_get_content(event)
        elif rk == "POST /media/presign":
            response = handle_post_media_presign(event)
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
