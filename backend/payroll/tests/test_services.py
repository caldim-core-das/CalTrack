"""
payroll/tests/test_services.py

Unit tests for payroll service calculation engine, config validation, snapshot persistence, and wallet crediting idempotency.
"""

from decimal import Decimal
from django.test import TestCase
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model

from companies.models import Company
from employees.models import Employee
from payroll.models import PayrollConfig, WalletTransaction, EmployeeWalletBalance
from payroll.services import (
    calculate_service_split,
    save_payroll_config,
    create_wallet_transaction,
    credit_wallet_transaction,
)

User = get_user_model()


class PayrollServicesTest(TestCase):
    def setUp(self):
        self.company = Company.objects.create(
            company_name="Acme Corp",
            display_id="ACME001"
        )
        self.user = User.objects.create_user(
            username="testworker",
            email="worker@acme.com",
            password="password123",
            company=self.company
        )
        self.employee = Employee.objects.create(
            user=self.user,
            employee_id="EMP-001",
            company=self.company
        )
        self.config = save_payroll_config(
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

    def test_calculate_service_split_example(self):
        """
        Test ₹1,000 / 80% / 10% / 5% / 12% PF / 0.75% ESI example.
        Assert net_credit_amount == 698.00 exactly.
        """
        gross = Decimal("1000.00")
        breakdown = calculate_service_split(gross, self.config)

        self.assertEqual(breakdown["employee_share_amount"], Decimal("800.00"))
        self.assertEqual(breakdown["company_share_amount"], Decimal("100.00"))
        self.assertEqual(breakdown["platform_fee_amount"], Decimal("50.00"))
        self.assertEqual(breakdown["pf_deduction"], Decimal("96.00"))
        self.assertEqual(breakdown["esi_deduction"], Decimal("6.00"))
        self.assertEqual(breakdown["tds_deduction"], Decimal("0.00"))
        self.assertEqual(breakdown["net_credit_amount"], Decimal("698.00"))

    def test_config_validation_rejects_shares_exceeding_100(self):
        """
        Test config validation rejects shares summing >100%.
        """
        invalid_config = PayrollConfig(
            org=self.company,
            employee_share_percent=Decimal("80.00"),
            company_share_percent=Decimal("15.00"),
            platform_fee_percent=Decimal("10.00"),  # 80+15+10 = 105%
            platform_fee_type=PayrollConfig.PlatformFeeType.PERCENTAGE,
            is_active=True,
        )
        with self.assertRaises(ValidationError):
            save_payroll_config(invalid_config, self.company)

    def test_create_wallet_transaction_snapshots_config(self):
        """
        Test create_wallet_transaction snapshots active config,
        retaining snapshot reference even after a newer config is activated.
        """
        tx = create_wallet_transaction(
            booking=None,
            gross_amount=Decimal("1000.00"),
            org=self.company,
            employee=self.employee
        )
        self.assertEqual(tx.payroll_config, self.config)
        self.assertEqual(tx.net_credit_amount, Decimal("698.00"))
        self.assertEqual(tx.status, WalletTransaction.Status.PENDING)

        # Create new config version with different split (e.g. 70% emp share)
        new_config = save_payroll_config(
            PayrollConfig(
                org=self.company,
                employee_share_percent=Decimal("70.00"),
                company_share_percent=Decimal("20.00"),
                platform_fee_percent=Decimal("5.00"),
                platform_fee_type=PayrollConfig.PlatformFeeType.PERCENTAGE,
                pf_percent=Decimal("12.00"),
                esi_percent=Decimal("0.75"),
                tds_percent=Decimal("0.00"),
                is_active=True,
            ),
            self.company
        )

        # Verify old transaction still references original config and original calculations
        tx.refresh_from_db()
        self.assertEqual(tx.payroll_config, self.config)
        self.assertEqual(tx.net_credit_amount, Decimal("698.00"))
        self.assertNotEqual(tx.payroll_config, new_config)

    def test_credit_wallet_transaction_idempotency(self):
        """
        Test credit_wallet_transaction transitions PENDING -> CREDITED,
        updates EmployeeWalletBalance, and raises ValidationError when called a second time.
        """
        tx = create_wallet_transaction(
            booking=None,
            gross_amount=Decimal("1000.00"),
            org=self.company,
            employee=self.employee
        )

        # First credit call -> should succeed
        credited_tx = credit_wallet_transaction(tx.id, self.company)
        self.assertEqual(credited_tx.status, WalletTransaction.Status.CREDITED)
        self.assertIsNotNone(credited_tx.credited_at)

        balance = EmployeeWalletBalance.objects.get(org=self.company, employee=self.employee)
        self.assertEqual(balance.total_balance, Decimal("698.00"))

        # Second credit call -> should fail and NOT double-credit
        with self.assertRaises(ValidationError):
            credit_wallet_transaction(tx.id, self.company)

        # Balance should still be 698.00
        balance.refresh_from_db()
        self.assertEqual(balance.total_balance, Decimal("698.00"))
