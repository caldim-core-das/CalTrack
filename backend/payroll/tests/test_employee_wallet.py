"""
payroll/tests/test_employee_wallet.py

Unit and security tests for EmployeeWalletView, EmployeePayslipDownloadView, period filtering, and cross-employee 403 authorization guard.
"""

from decimal import Decimal
from django.utils import timezone
import datetime
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from companies.models import Company
from employees.models import Employee
from payroll.models import PayrollConfig, WalletTransaction, EmployeeWalletBalance
from payroll.services import save_payroll_config

User = get_user_model()


class EmployeeWalletApiTest(TestCase):
    def setUp(self):
        self.company = Company.objects.create(
            company_name="Wallet Test Corp",
            display_id="WTC001"
        )

        # Employee A
        self.user_a = User.objects.create_user(
            username="empa", email="empa@wtc.com", password="password123", company=self.company
        )
        self.employee_a = Employee.objects.create(
            user=self.user_a, employee_id="EMP-A", company=self.company
        )

        # Employee B
        self.user_b = User.objects.create_user(
            username="empb", email="empb@wtc.com", password="password123", company=self.company
        )
        self.employee_b = Employee.objects.create(
            user=self.user_b, employee_id="EMP-B", company=self.company
        )

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

        # Create transactions for Employee A
        self.tx_today = WalletTransaction.objects.create(
            org=self.company,
            employee=self.employee_a,
            payroll_config=self.payroll_config,
            gross_amount=Decimal("1000.00"),
            employee_share_amount=Decimal("800.00"),
            company_share_amount=Decimal("100.00"),
            platform_fee_amount=Decimal("50.00"),
            pf_deduction=Decimal("96.00"),
            esi_deduction=Decimal("6.00"),
            tds_deduction=Decimal("0.00"),
            net_credit_amount=Decimal("698.00"),
            status=WalletTransaction.Status.CREDITED,
            credited_at=timezone.now(),
        )

        # Transaction for Employee B
        self.tx_b = WalletTransaction.objects.create(
            org=self.company,
            employee=self.employee_b,
            payroll_config=self.payroll_config,
            gross_amount=Decimal("2000.00"),
            employee_share_amount=Decimal("1600.00"),
            company_share_amount=Decimal("200.00"),
            platform_fee_amount=Decimal("100.00"),
            pf_deduction=Decimal("192.00"),
            esi_deduction=Decimal("12.00"),
            tds_deduction=Decimal("0.00"),
            net_credit_amount=Decimal("1396.00"),
            status=WalletTransaction.Status.CREDITED,
            credited_at=timezone.now(),
        )

        self.client_a = APIClient()
        self.client_a.force_authenticate(user=self.user_a)

    def test_employee_wallet_view_period_filtering(self):
        """
        Test period parameter filtering (today/all) returns employee A's records only.
        """
        response = self.client_a.get("/api/payroll/my-wallet/?period=today")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])

        data = response.data["data"]
        self.assertEqual(len(data["transactions"]), 1)
        self.assertEqual(data["transactions"][0]["id"], self.tx_today.id)
        self.assertEqual(data["period_summary"]["net_credited"], "698.00")

    def test_cross_employee_isolation_security_guard(self):
        """
        Test Employee A cannot download Employee B's payslip (returns 403 Forbidden).
        """
        response = self.client_a.get(f"/api/payroll/download-payslip/{self.tx_b.id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(response.data["success"])

    def test_payslip_pdf_download_success(self):
        """
        Test downloading payslip for Employee A's transaction returns valid PDF binary.
        """
        response = self.client_a.get(f"/api/payroll/download-payslip/{self.tx_today.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertTrue(response["Content-Disposition"].startswith("attachment;"))
        self.assertGreater(len(response.content), 500)
