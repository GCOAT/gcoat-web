"""Database operations — DynamoDB.

Extracted from app.py for single responsibility. All DynamoDB-specific
code lives here. Route handlers import these functions and never touch
boto3 directly.

When PostgreSQL support is added (Month 2), this file becomes the
adapter interface with engine-specific implementations in separate files.
For now, it's just organized DynamoDB operations.
"""
import logging
import os

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

# Cached DynamoDB resource (reused across warm Lambda invocations)
_ddb_resource = None


def _ddb():
    """Get or create the cached DynamoDB resource."""
    global _ddb_resource
    if _ddb_resource is None:
        endpoint = os.environ.get("DYNAMODB_ENDPOINT_OVERRIDE")
        if endpoint:
            _ddb_resource = boto3.resource("dynamodb", endpoint_url=endpoint)
        else:
            _ddb_resource = boto3.resource("dynamodb")
    return _ddb_resource


def put_item(table_name, item):
    """Write an item to DynamoDB. Raises ClientError on failure."""
    _ddb().Table(table_name).put_item(Item=item)


def get_item(table_name, key):
    """Get a single item by key. Returns the item dict or None if not found."""
    resp = _ddb().Table(table_name).get_item(Key=key)
    return resp.get("Item")


def delete_item(table_name, key):
    """Delete an item by key. Raises ClientError on failure."""
    _ddb().Table(table_name).delete_item(Key=key)


def query_items(table_name, key_condition, *, index_name=None,
                scan_forward=True, limit=None, start_key=None,
                filter_expression=None):
    """Query items with pagination support.

    Args:
        table_name: DynamoDB table name.
        key_condition: boto3 Key condition expression
            (e.g., Key("pk").eq("TAG#news") & Key("sk").begins_with("2026-")).
        index_name: GSI name (e.g., "GSI1" or "GSI2"). None for main table.
        scan_forward: True = ascending sort key order, False = descending (newest first).
        limit: Max items to return per page.
        start_key: ExclusiveStartKey for pagination (from a previous response).
        filter_expression: Optional FilterExpression applied after query.

    Returns:
        (items, last_key) — items is a list of dicts, last_key is the
        pagination cursor (None if no more pages).
    """
    kwargs = {
        "KeyConditionExpression": key_condition,
        "ScanIndexForward": scan_forward,
    }
    if index_name:
        kwargs["IndexName"] = index_name
    if limit:
        kwargs["Limit"] = limit
    if start_key:
        kwargs["ExclusiveStartKey"] = start_key
    if filter_expression:
        kwargs["FilterExpression"] = filter_expression

    resp = _ddb().Table(table_name).query(**kwargs)
    items = resp.get("Items", [])
    last_key = resp.get("LastEvaluatedKey")
    return items, last_key
