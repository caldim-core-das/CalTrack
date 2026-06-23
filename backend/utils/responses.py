"""
backend/utils/responses.py
Standardised API response helpers.

Usage:
    from utils.responses import success_response, error_response

    return success_response(data=serializer.data, message="Employee created.")
    return error_response(message="Validation failed.", errors=serializer.errors)
"""
from rest_framework.response import Response
from rest_framework import status as http_status


def success_response(data=None, message="Success.", status=http_status.HTTP_200_OK):
    """
    Return a standardised success envelope:
        {"success": true, "data": ..., "message": "..."}
    """
    return Response(
        {"success": True, "data": data, "message": message},
        status=status,
    )


def error_response(
    message="An error occurred.",
    errors=None,
    status=http_status.HTTP_400_BAD_REQUEST,
):
    """
    Return a standardised error envelope:
        {"success": false, "data": null, "message": "...", "errors": {...}}
    """
    payload = {"success": False, "data": None, "message": message}
    if errors is not None:
        payload["errors"] = errors
    return Response(payload, status=status)
