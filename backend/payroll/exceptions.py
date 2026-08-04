"""
payroll/exceptions.py

Domain exceptions for payroll module.
"""

from rest_framework.exceptions import APIException
from rest_framework import status


class PayrollConfigMissingException(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "PAYROLL_CONFIG_MISSING"
    default_detail = "Active payroll configuration is required before completing bookings or processing payments."

    def __init__(self, detail=None, code=None):
        if detail is None:
            detail = self.default_detail
        if code is None:
            code = self.default_code
        super().__init__(detail, code)
