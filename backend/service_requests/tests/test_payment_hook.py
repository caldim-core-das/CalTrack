"""
service_requests/tests/test_payment_hook.py

Integration tests for payment completion hook, wallet crediting, atomic rollback, and PayrollConfig missing guard.
"""

from decimal import Decimal
from unittest.mock import patch
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from companies.models import Company
from employees.models import Employee
from payroll.models import PayrollConfig, WalletTransaction, EmployeeWalletBalance
from payroll.services import save_payroll_config
from payroll.exceptions import PayrollConfigMissingException
from service_requests.models import ServiceRequest, EmployeeJob
from service_requests.services import process_booking_completion_and_payout

User = get_user_model()


class PaymentHookIntegrationTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.company = Company.objects.create(
            company_name="PaymentHook Corp",
            display_id="PHC001"
        )
        self.user = User.objects.create_user(
            username="tech1",
            email="tech1@phc.com",
            password="password123",
            company=self.company
        )
        self.employee = Employee.objects.create(
            user=self.user,
            employee_id="EMP-101",
            company=self.company
        )
        self.client.force_authenticate(user=self.user)

        self.payroll_config = save_payroll_config(
            PayrollConfig(
                org=self.company,
                employee_share_percent=Decimal("80.00"),
                company_share_percent=Decimal("10.00"),
                platform_fee_percent=Decimal("5.00"),
                platform_fee_type=PayrollConfig.PlatformFeeType.PERCENTAGE,
                pf_percent=Decimal("12.00"),
                esi_percent=Decimal("0.75"),
                tds_percent=Decimal("0.00"),
                is_active=True,
            ),
            self.company
        )

        self.booking = ServiceRequest.objects.create(
            company=self.company,
            customer_name="John Customer",
            phone="9876543210",
            issue_title="AC Repair",
            service_category="hvac",
            status=ServiceRequest.Status.IN_PROGRESS,
            payment_method=ServiceRequest.PaymentMethod.ONLINE,
            payment_status=ServiceRequest.PaymentStatus.PAID,
            total_amount=Decimal("1000.00"),
            assigned_employee=self.employee,
        )

    def test_full_payment_completion_flow(self):
        """
        Test full flow: complete booking -> WalletTransaction created with CREDITED status -> EmployeeWalletBalance updated.
        """
        booking, tx = process_booking_completion_and_payout(self.booking)

        self.assertEqual(booking.status, ServiceRequest.Status.COMPLETED)
        self.assertEqual(tx.status, WalletTransaction.Status.CREDITED)
        self.assertEqual(tx.net_credit_amount, Decimal("698.00"))

        balance = EmployeeWalletBalance.objects.get(org=self.company, employee=self.employee)
        self.assertEqual(balance.total_balance, Decimal("698.00"))

    def test_payroll_exception_atomic_rollback(self):
        """
        Simulate exception during payroll calculation, assert booking status is rolled back and NOT saved as COMPLETED.
        """
        initial_status = self.booking.status

        with patch("payroll.services.create_wallet_transaction", side_effect=ValueError("Simulated calculation failure")):
            with self.assertRaises(ValueError):
                process_booking_completion_and_payout(self.booking)

        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, initial_status)
        self.assertFalse(WalletTransaction.objects.filter(booking=self.booking).exists())

    def test_missing_payroll_config_guard_path(self):
        """
        Deactivate PayrollConfig and attempt completion -> assert PayrollConfigMissingException raised.
        """
        self.payroll_config.is_active = False
        self.payroll_config.save()

        with self.assertRaises(PayrollConfigMissingException):
            process_booking_completion_and_payout(self.booking)

        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, ServiceRequest.Status.IN_PROGRESS)
